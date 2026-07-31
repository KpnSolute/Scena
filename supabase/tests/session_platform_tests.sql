-- Scena session-platform database test suite.
--
-- Run inside a transaction that rolls back:
--     begin; \i supabase/tests/session_platform_tests.sql  rollback;
-- or via scripts/db-test.sh, which does that for you.
--
-- Every assertion raises on failure, so a clean run means every case passed.
-- Covers: lifecycle transitions, readiness gating, entitlement enforcement,
-- automation tiers, group caps, resource ACLs, event emission, and RLS
-- isolation between two Workspaces and five roles.

do $$
declare
  -- Workspace A (Max, so the gated capabilities are reachable)
  org_a uuid := gen_random_uuid();
  loc_a uuid := gen_random_uuid();
  -- Workspace B (Plus, used to prove gating and isolation). Plus carries the
  -- same 2-Display / 1-concurrent-Session shape as Personal Free and grants no
  -- groups, automation or templates, so it exercises every gate. A second
  -- Personal Workspace cannot be used here: creating the auth user already
  -- triggers automatic first-Personal-Workspace provisioning.
  org_b uuid := gen_random_uuid();
  loc_b uuid := gen_random_uuid();

  owner_a    uuid := gen_random_uuid();
  operator_a uuid := gen_random_uuid();
  designer_a uuid := gen_random_uuid();
  viewer_a   uuid := gen_random_uuid();
  owner_b    uuid := gen_random_uuid();

  screen_1 uuid := gen_random_uuid();
  screen_2 uuid := gen_random_uuid();
  screen_b uuid := gen_random_uuid();
  board_a  uuid := gen_random_uuid();
  board_b  uuid := gen_random_uuid();

  sess_a   uuid;
  sess_2   uuid;
  sess_b   uuid;
  grp      uuid;
  sgrp     uuid;
  tpl      public.session_templates;
  dup      public.display_sessions;
  rdy      record;
  caught   boolean;
  n        integer;
  lvl      text;

  procedure_note text;
begin
  ------------------------------------------------------------------------
  -- Fixtures
  ------------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'test+' || u || '@scena.invalid', '', now(), now(), now()
    from unnest(array[owner_a, operator_a, designer_a, viewer_a, owner_b]) u;

  insert into public.organizations (id, name, slug, workspace_type, provisioning_kind, owner_user_id)
  values (org_a, 'Test Workspace A', 'test-ws-a-' || left(org_a::text, 8), 'team', 'team_subscription', owner_a),
         (org_b, 'Test Workspace B', 'test-ws-b-' || left(org_b::text, 8), 'team', 'team_subscription', owner_b);

  insert into public.organization_entitlements (org_id, plan_code) values (org_a, 'max'), (org_b, 'plus');

  -- initialize_organization() already created the Owner membership for each
  -- Workspace. The membership invariants require an existing Owner to be the
  -- actor when adding members, so act as owner_a for the rest.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', owner_a::text, 'role', 'authenticated')::text, true);
  insert into public.organization_members (org_id, user_id, role, status) values
    (org_a, operator_a, 'operator', 'active'),
    (org_a, designer_a, 'designer', 'active'),
    (org_a, viewer_a, 'viewer', 'active');
  perform set_config('request.jwt.claims', null, true);

  insert into public.locations (id, org_id, name, slug) values
    (loc_a, org_a, 'Lobby A', 'lobby-a-' || left(loc_a::text, 8)),
    (loc_b, org_b, 'Lobby B', 'lobby-b-' || left(loc_b::text, 8));

  insert into public.screens (id, org_id, location_id, name, device_token_hash, status, claimed_at) values
    (screen_1, org_a, loc_a, 'Display 1', 'hash-1-' || left(screen_1::text, 8), 'ready', now()),
    (screen_2, org_a, loc_a, 'Display 2', 'hash-2-' || left(screen_2::text, 8), 'ready', now()),
    (screen_b, org_b, loc_b, 'Display B', 'hash-b-' || left(screen_b::text, 8), 'ready', now());

  insert into public.boards (id, workspace_id, name, status, created_by, updated_by) values
    (board_a, org_a, 'Board A', 'active', owner_a, owner_a),
    (board_b, org_b, 'Board B', 'active', owner_b, owner_b);

  insert into public.display_sessions (org_id, location_id, name, board_id)
  values (org_a, loc_a, 'Session A', board_a) returning id into sess_a;
  insert into public.display_sessions (org_id, location_id, name)
  values (org_a, loc_a, 'Session A2') returning id into sess_2;
  insert into public.display_sessions (org_id, location_id, name)
  values (org_b, loc_b, 'Session B') returning id into sess_b;

  ------------------------------------------------------------------------
  -- 1. session.created events were emitted for all three Sessions
  ------------------------------------------------------------------------
  select count(*) into n from public.session_events
   where event_type = 'session.created' and session_id in (sess_a, sess_2, sess_b);
  if n <> 3 then raise exception 'FAIL 1: expected 3 session.created events, got %', n; end if;

  ------------------------------------------------------------------------
  -- 2. Illegal lifecycle transitions are rejected
  ------------------------------------------------------------------------
  caught := false;
  begin
    update public.display_sessions set status = 'active' where id = sess_a;   -- draft -> active
  exception when others then caught := true;
  end;
  if not caught then raise exception 'FAIL 2: draft -> active was allowed'; end if;

  caught := false;
  begin
    update public.display_sessions set status = 'stopped' where id = sess_a;  -- draft -> stopped
  exception when others then caught := true;
  end;
  if not caught then raise exception 'FAIL 2b: draft -> stopped was allowed'; end if;

  ------------------------------------------------------------------------
  -- 3. A Session that is not ready cannot enter 'starting'
  ------------------------------------------------------------------------
  update public.display_sessions set status = 'ready' where id = sess_a;      -- legal
  caught := false;
  begin
    update public.display_sessions set status = 'starting' where id = sess_a; -- no Displays yet
  exception when others then caught := true;
  end;
  if not caught then raise exception 'FAIL 3: an unready Session was allowed to start'; end if;

  ------------------------------------------------------------------------
  -- 4. Readiness reports the real blocking reason
  ------------------------------------------------------------------------
  select * into rdy from public.session_readiness(sess_a)
   where check_key = 'has_enabled_display';
  if rdy.passed then raise exception 'FAIL 4: has_enabled_display passed with no Displays'; end if;

  ------------------------------------------------------------------------
  -- 5. Happy path: add a Display, become ready, start, pause, resume, stop
  ------------------------------------------------------------------------
  insert into public.display_session_screens (org_id, location_id, session_id, screen_id, is_enabled)
  values (org_a, loc_a, sess_a, screen_1, true);

  select is_ready into caught from public.session_readiness_summary(sess_a);
  if not caught then
    raise exception 'FAIL 5: Session with one Display and a Board is still not ready: %',
      (select string_agg(check_key || ' -> ' || message, '; ')
         from public.session_readiness(sess_a) where not passed and blocking);
  end if;

  update public.display_sessions set status = 'starting' where id = sess_a;
  update public.display_sessions set status = 'active'   where id = sess_a;
  update public.display_sessions set status = 'paused'   where id = sess_a;
  update public.display_sessions set status = 'active'   where id = sess_a;
  update public.display_sessions set status = 'stopping' where id = sess_a;
  update public.display_sessions set status = 'stopped'  where id = sess_a;

  select count(*) into n from public.session_events
   where session_id = sess_a
     and event_type in ('session.ready','session.started','session.paused',
                        'session.resumed','session.stopping','session.stopped');
  if n < 6 then raise exception 'FAIL 5b: expected the full lifecycle timeline, got % events', n; end if;

  -- Stopping released the Display.
  select count(*) into n from public.display_session_screens
   where session_id = sess_a and assignment_status <> 'removed';
  if n <> 0 then raise exception 'FAIL 5c: stopping did not release the Display'; end if;

  ------------------------------------------------------------------------
  -- 6. Concurrent-Session capacity counts every Display-holding state
  ------------------------------------------------------------------------
  -- Workspace A is Max: 4 concurrent. Drop it to Personal Free shape by using
  -- Workspace B, which allows exactly 1.
  insert into public.display_sessions (org_id, location_id, name, board_id)
  values (org_b, loc_b, 'Session B2', board_b) returning id into sess_2;
  insert into public.display_session_screens (org_id, location_id, session_id, screen_id, is_enabled)
  values (org_b, loc_b, sess_b, screen_b, true);
  update public.display_sessions set board_id = board_b where id = sess_b;
  update public.display_sessions set status = 'ready'    where id = sess_b;
  update public.display_sessions set status = 'starting' where id = sess_b;
  update public.display_sessions set status = 'active'   where id = sess_b;
  -- Pausing must NOT free the concurrency slot.
  update public.display_sessions set status = 'paused'   where id = sess_b;

  caught := false;
  begin
    update public.display_sessions set status = 'ready'    where id = sess_2;
    update public.display_sessions set status = 'starting' where id = sess_2;
  exception when others then caught := true;
  end;
  if not caught then
    raise exception 'FAIL 6: a paused Session freed a concurrent-Session slot on a 1-Session plan';
  end if;
  update public.display_sessions set status = 'stopping' where id = sess_b;
  update public.display_sessions set status = 'stopped'  where id = sess_b;

  ------------------------------------------------------------------------
  -- 7. Display Groups are Max-only and capped at four Displays
  ------------------------------------------------------------------------
  caught := false;
  begin
    insert into public.display_groups (org_id, location_id, name) values (org_b, loc_b, 'Nope');
  exception when others then caught := true;
  end;
  if not caught then raise exception 'FAIL 7: Plus created a Display Group'; end if;

  insert into public.display_groups (org_id, location_id, name)
  values (org_a, loc_a, 'Lobby Wall') returning id into grp;
  insert into public.display_group_members (group_id, org_id, screen_id, member_order)
  values (grp, org_a, screen_1, 0), (grp, org_a, screen_2, 1);

  -- Cross-Workspace membership is rejected.
  caught := false;
  begin
    insert into public.display_group_members (group_id, org_id, screen_id)
    values (grp, org_a, screen_b);
  exception when others then caught := true;
  end;
  if not caught then raise exception 'FAIL 7b: a Display from another Workspace joined the group'; end if;

  ------------------------------------------------------------------------
  -- 8. Session Groups are Max-only; group commands respect per-Session gates
  ------------------------------------------------------------------------
  caught := false;
  begin
    insert into public.session_groups (org_id, name) values (org_b, 'Nope');
  exception when others then caught := true;
  end;
  if not caught then raise exception 'FAIL 8: Plus created a Session Group'; end if;

  insert into public.session_groups (org_id, name) values (org_a, 'Morning Run') returning id into sgrp;
  insert into public.session_group_members (group_id, org_id, session_id) values (sgrp, org_a, sess_a);

  -- session_group_command checks the caller's Workspace role, so act as a real
  -- member rather than the service role.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', owner_a::text, 'role', 'authenticated')::text, true);
  select count(*) into n from public.session_group_command(sgrp, 'start');
  perform set_config('request.jwt.claims', null, true);
  if n <> 1 then raise exception 'FAIL 8b: group command returned % rows, expected 1', n; end if;

  ------------------------------------------------------------------------
  -- 9. Automation tier enforcement
  ------------------------------------------------------------------------
  caught := false;
  begin
    insert into public.display_automations (org_id, location_id, session_id, name, action_type,
                                            schedule_type, cron_expression, schedule_kind, target_id)
    values (org_b, loc_b, sess_b, 'Nope', 'stop_session', 'cron', '0 * * * *', 'hourly', sess_b);
  exception when others then caught := true;
  end;
  if not caught then raise exception 'FAIL 9: Plus created an automation'; end if;

  -- Max may schedule hourly.
  insert into public.display_automations (org_id, location_id, session_id, name, action_type,
                                          schedule_type, cron_expression, schedule_kind, target_id)
  values (org_a, loc_a, sess_a, 'Hourly refresh', 'stop_session', 'cron', '0 * * * *', 'hourly', sess_a);

  ------------------------------------------------------------------------
  -- 10. Templates: Pro/Max only, slot-based, instantiate as draft
  ------------------------------------------------------------------------
  caught := false;
  begin
    insert into public.session_templates (org_id, name) values (org_b, 'Nope');
  exception when others then caught := true;
  end;
  if not caught then raise exception 'FAIL 10: Plus created a Session template'; end if;

  ------------------------------------------------------------------------
  -- 11. Resource ACL resolution and its recovery path
  ------------------------------------------------------------------------
  lvl := private.resource_access_level(org_a, 'session', sess_a, viewer_a);
  if lvl <> 'viewer' then raise exception 'FAIL 11: viewer baseline was %, expected viewer', lvl; end if;

  -- Granting requires an Owner or Admin actor, so act as owner_a.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', owner_a::text, 'role', 'authenticated')::text, true);
  insert into public.resource_grants (org_id, resource_type, resource_id, user_id, access_level, granted_by)
  values (org_a, 'session', sess_a, viewer_a, 'operator', owner_a);

  lvl := private.resource_access_level(org_a, 'session', sess_a, viewer_a);
  if lvl <> 'operator' then raise exception 'FAIL 11b: grant did not raise access, got %', lvl; end if;

  -- A grant can never lower an Owner: the recovery path must hold.
  insert into public.resource_grants (org_id, resource_type, resource_id, user_id, access_level, granted_by)
  values (org_a, 'session', sess_a, owner_a, 'viewer', owner_a);
  perform set_config('request.jwt.claims', null, true);
  lvl := private.resource_access_level(org_a, 'session', sess_a, owner_a);
  if lvl <> 'owner' then raise exception 'FAIL 11c: an Owner was narrowed to %', lvl; end if;

  -- A non-member resolves to no access at all.
  lvl := private.resource_access_level(org_a, 'session', sess_a, owner_b);
  if lvl is not null then raise exception 'FAIL 11d: a non-member resolved to %', lvl; end if;

  ------------------------------------------------------------------------
  -- 12. Display health ingestion and rollup
  ------------------------------------------------------------------------
  perform public.ingest_display_heartbeat(
    screen_1, '1.4.0', 1920, 1080, 'landscape', sess_a, board_a, 1, 'in_sync', 'fresh', 'good');

  select health_state into lvl from public.display_health where screen_id = screen_1;
  if lvl <> 'healthy' then raise exception 'FAIL 12: first heartbeat produced health %', lvl; end if;

  select count(*) into n from public.display_health_events
   where screen_id = screen_1 and event_type = 'connected';
  if n <> 1 then raise exception 'FAIL 12b: expected one connected event, got %', n; end if;

  -- A stale config revision must surface as content_update_pending.
  update public.display_sessions set board_id = null where id = sess_a;
  perform public.ingest_display_heartbeat(
    screen_1, '1.4.0', 1920, 1080, 'landscape', sess_a, board_a, 1, 'in_sync', 'fresh', 'good');
  select health_state into lvl from public.display_health where screen_id = screen_1;
  if lvl <> 'content_update_pending' then
    raise exception 'FAIL 12c: a stale config revision reported %, expected content_update_pending', lvl;
  end if;

  ------------------------------------------------------------------------
  -- 13. Entitlement authority: quota reads the resolver, override raises it
  ------------------------------------------------------------------------
  caught := false;
  begin
    insert into public.screens (org_id, location_id, name, device_token_hash, status, claimed_at)
    values (org_b, loc_b, 'Display B2', 'hash-b2', 'ready', now());
    insert into public.screens (org_id, location_id, name, device_token_hash, status, claimed_at)
    values (org_b, loc_b, 'Display B3', 'hash-b3', 'ready', now());   -- exceeds Plus's 2
  exception when others then caught := true;
  end;
  if not caught then raise exception 'FAIL 13: Plus exceeded its 2-Display limit'; end if;

  insert into public.workspace_limits_overrides (org_id, max_displays, reason, approved_by)
  values (org_b, 4, 'pilot', owner_b);
  insert into public.screens (org_id, location_id, name, device_token_hash, status, claimed_at)
  values (org_b, loc_b, 'Display B3', 'hash-b3b', 'ready', now());

  -- but the override never grants a capability
  if (private.effective_entitlements(org_b)).allow_display_groups then
    raise exception 'FAIL 13b: an override granted a Max capability';
  end if;

  ------------------------------------------------------------------------
  -- 14. RLS isolation between Workspaces, evaluated as a real JWT
  ------------------------------------------------------------------------
  set local role authenticated;

  perform set_config('request.jwt.claims',
                     json_build_object('sub', owner_b::text, 'role', 'authenticated')::text, true);
  select count(*) into n from public.display_sessions where org_id = org_a;
  if n <> 0 then raise exception 'FAIL 14: Workspace B''s Owner saw % of Workspace A''s Sessions', n; end if;

  select count(*) into n from public.session_events where org_id = org_a;
  if n <> 0 then raise exception 'FAIL 14b: Workspace B''s Owner saw Workspace A''s timeline'; end if;

  select count(*) into n from public.display_health where org_id = org_a;
  if n <> 0 then raise exception 'FAIL 14c: Workspace B''s Owner saw Workspace A''s Display health'; end if;

  select count(*) into n from public.display_groups where org_id = org_a;
  if n <> 0 then raise exception 'FAIL 14d: Workspace B''s Owner saw Workspace A''s Display Groups'; end if;

  -- Workspace A's operator sees their own Workspace and nothing of B's.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', operator_a::text, 'role', 'authenticated')::text, true);
  select count(*) into n from public.display_sessions where org_id = org_a;
  if n = 0 then raise exception 'FAIL 14e: Workspace A''s operator cannot see their own Sessions'; end if;
  select count(*) into n from public.display_sessions where org_id = org_b;
  if n <> 0 then raise exception 'FAIL 14f: Workspace A''s operator saw Workspace B''s Sessions'; end if;

  -- The append-only guarantee: nobody may write the timeline through the API.
  caught := false;
  begin
    insert into public.session_events (org_id, session_id, event_type)
    values (org_a, sess_a, 'session.stopped');
  exception when others then caught := true;
  end;
  if not caught then raise exception 'FAIL 14g: the Session timeline was writable through the API'; end if;

  -- A viewer may not create a Display Group even on Max.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', viewer_a::text, 'role', 'authenticated')::text, true);
  caught := false;
  begin
    insert into public.display_groups (org_id, location_id, name) values (org_a, loc_a, 'Viewer group');
  exception when others then caught := true;
  end;
  if not caught then raise exception 'FAIL 14h: a viewer created a Display Group'; end if;

  reset role;
  perform set_config('request.jwt.claims', null, true);

  raise notice 'ALL SESSION PLATFORM TESTS PASSED';
end $$;

select 'session_platform_tests: all assertions passed' as result;
