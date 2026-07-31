-- Scena authoritative Session readiness.
--
-- Design decisions recorded in docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md:
--   * ONE implementation, in the database. The manager UI renders this
--     checklist; it does not compute a second opinion. Before this migration
--     readiness was inferred in TypeScript, which meant the button could say
--     "ready" while the activation trigger disagreed.
--   * Every check returns a customer-safe message. Nothing here leaks a device
--     credential, a storage path or a provider error.
--   * `blocking` is separate from `severity` so the UI can show a real warning
--     (for example a Display that is paired but currently offline) without
--     refusing to start a Session that will recover on reconnect.

begin;

create or replace function public.session_readiness(target_session_id uuid)
returns table (
  check_key      text,
  passed         boolean,
  severity       text,
  blocking       boolean,
  message        text,
  resource_type  text,
  resource_id    uuid
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  s          public.display_sessions;
  ent        private.effective_entitlement;
  screens_total    integer := 0;
  screens_enabled  integer := 0;
  unpaired         integer := 0;
  conflicting      integer := 0;
  missing_content  integer := 0;
  unprocessed      integer := 0;
  offline_count    integer := 0;
  holding_others   integer := 0;
  display_total    integer := 0;
  conflict_screen  uuid;
begin
  select * into s from public.display_sessions ds where ds.id = target_session_id;

  if not found then
    return query select 'session_exists', false, 'error', true,
                        'This Session no longer exists.', null::text, null::uuid;
    return;
  end if;

  -- Workspace boundary. A caller who is not a member gets the same answer as a
  -- caller asking about a Session that does not exist.
  if (select auth.uid()) is not null and not private.is_org_member(s.org_id) then
    return query select 'session_exists', false, 'error', true,
                        'This Session no longer exists.', null::text, null::uuid;
    return;
  end if;

  return query select 'session_exists', true, 'info', false,
                      'Session belongs to this Workspace.', 'session', s.id;

  ent := private.effective_entitlements(s.org_id);

  select
    count(*) filter (where dss.assignment_status <> 'removed'),
    count(*) filter (where dss.assignment_status <> 'removed' and dss.is_enabled)
    into screens_total, screens_enabled
    from public.display_session_screens dss
   where dss.session_id = s.id;

  -- 1. At least one enabled Display -------------------------------------------
  return query select 'has_enabled_display', screens_enabled > 0, 'error', true,
    case when screens_enabled > 0
         then format('%s Display(s) enabled in this Session.', screens_enabled)
         else 'Add at least one enabled Display before starting.' end,
    null::text, null::uuid;

  -- 2. Every assigned Display is paired and eligible ---------------------------
  select count(*) into unpaired
    from public.display_session_screens dss
    join public.screens sc on sc.id = dss.screen_id
   where dss.session_id = s.id
     and dss.assignment_status <> 'removed'
     and sc.status is distinct from 'ready';

  return query select 'displays_paired', unpaired = 0, 'error', true,
    case when unpaired = 0 then 'All assigned Displays are paired.'
         else format('%s assigned Display(s) are not paired or have been revoked.', unpaired) end,
    null::text, null::uuid;

  -- 3. No Display is held by another live Session ------------------------------
  -- No min(uuid) aggregate exists; take the first conflicting Display so the
  -- UI can link straight to it.
  select count(*), (array_agg(other.screen_id))[1] into conflicting, conflict_screen
    from public.display_session_screens dss
    join public.display_session_screens other
      on other.screen_id = dss.screen_id
     and other.session_id <> dss.session_id
     and other.assignment_status <> 'removed'
    join public.display_sessions os on os.id = other.session_id
   where dss.session_id = s.id
     and dss.assignment_status <> 'removed'
     and dss.is_enabled
     and private.session_state_holds_displays(os.status);

  return query select 'no_assignment_conflict', conflicting = 0, 'error', true,
    case when conflicting = 0 then 'No Display is in use by another live Session.'
         else 'A Display in this Session is already showing another live Session.' end,
    case when conflicting > 0 then 'screen' end, conflict_screen;

  -- 4. Display mode is valid for the enabled count -----------------------------
  return query select 'display_mode_valid',
    case when s.display_mode = 'single' then screens_enabled = 1 else screens_enabled >= 1 end,
    'error', true,
    case when s.display_mode = 'single' and screens_enabled <> 1
         then 'Single mode requires exactly one enabled Display.'
         when screens_enabled = 0 then 'Enable a Display for this mode.'
         else format('%s mode is valid for %s enabled Display(s).', s.display_mode, screens_enabled) end,
    null::text, null::uuid;

  -- 5. Shared vs per-screen content assignment ---------------------------------
  if s.display_mode in ('duplicate', 'extend') then
    return query select 'shared_layout_assigned', s.shared_layout_id is not null, 'error', true,
      case when s.shared_layout_id is not null
           then 'A shared Board is assigned for this mode.'
           else format('%s mode requires a shared Board.', s.display_mode) end,
      'layout', s.shared_layout_id;
  else
    if s.board_id is null then
      select count(*) into missing_content
        from public.display_session_screens dss
       where dss.session_id = s.id
         and dss.assignment_status <> 'removed'
         and dss.is_enabled
         and dss.layout_id is null;
    else
      missing_content := 0;
    end if;

    return query select 'per_screen_content_assigned', missing_content = 0, 'error', true,
      case when missing_content = 0 then 'Every enabled Display has content assigned.'
           else format('%s enabled Display(s) have no Board assigned.', missing_content) end,
      null::text, null::uuid;
  end if;

  -- 6. Content exists and is usable --------------------------------------------
  return query select 'content_available',
    (s.board_id is not null or s.shared_layout_id is not null
     or exists (select 1 from public.display_session_screens dss
                 where dss.session_id = s.id and dss.assignment_status <> 'removed'
                   and dss.is_enabled and dss.layout_id is not null)),
    'error', true,
    case when s.board_id is not null then 'A Board is assigned to this Session.'
         when s.shared_layout_id is not null then 'A shared Layout is assigned.'
         else 'Assign a Board before starting this Session.' end,
    case when s.board_id is not null then 'board' end, s.board_id;

  -- 7. Referenced Assets have finished processing -------------------------------
  if s.board_id is not null then
    select count(*) into unprocessed
      from public.scene_elements se
      join public.assets a on a.id = se.asset_id
     where se.board_id = s.board_id
       and se.is_visible
       and a.status not in ('ready', 'archived');
  end if;

  return query select 'content_processing_complete', unprocessed = 0, 'error', true,
    case when unprocessed = 0 then 'All Assets used by this Board are ready.'
         else format('%s Asset(s) on this Board are still processing.', unprocessed) end,
    null::text, null::uuid;

  -- 8. Plan capacity: Displays in this Session ----------------------------------
  return query select 'displays_per_session_within_limit',
    screens_total <= coalesce(ent.max_displays_per_session, 4), 'error', true,
    format('%s of %s Displays used in this Session.',
           screens_total, coalesce(ent.max_displays_per_session, 4)),
    null::text, null::uuid;

  -- 9. Plan capacity: Workspace Displays -----------------------------------------
  select count(*) into display_total
    from public.screens sc where sc.org_id = s.org_id and sc.status <> 'revoked';

  return query select 'workspace_display_capacity',
    display_total <= coalesce(ent.max_displays, display_total), 'warning', false,
    format('%s of %s Workspace Displays in use.', display_total, coalesce(ent.max_displays, 0)),
    null::text, null::uuid;

  -- 10. Concurrent Session allowance ----------------------------------------------
  select count(*) into holding_others
    from public.display_sessions os
   where os.org_id = s.org_id
     and os.id <> s.id
     and private.session_state_holds_displays(os.status);

  return query select 'concurrent_session_capacity',
    holding_others < coalesce(ent.max_concurrent_sessions, 1), 'error', true,
    case when holding_others < coalesce(ent.max_concurrent_sessions, 1)
         then format('%s of %s concurrent Sessions in use.',
                     holding_others, coalesce(ent.max_concurrent_sessions, 1))
         else format('This plan allows %s concurrent Session(s). Stop another Session first.',
                     coalesce(ent.max_concurrent_sessions, 1)) end,
    null::text, null::uuid;

  -- 11. Caller may operate this Session ---------------------------------------------
  return query select 'operator_permission',
    ((select auth.uid()) is null
      or private.has_org_role(s.org_id, array['owner', 'admin', 'operator'])),
    'error', true,
    'Your Workspace role allows Session control.',
    null::text, null::uuid;

  -- 12. Fallback content is valid ----------------------------------------------------
  return query select 'fallback_content_valid',
    (s.fallback_policy <> 'fallback_board'
     or exists (select 1 from public.boards b
                 where b.id = s.fallback_board_id
                   and b.workspace_id = s.org_id
                   and b.status = 'active')),
    'error', true,
    case when s.fallback_policy = 'fallback_board' and s.fallback_board_id is null
         then 'Choose a fallback Board or change the fallback policy.'
         when s.fallback_policy = 'fallback_board'
         then 'Fallback Board is available.'
         else format('Fallback policy: %s.', replace(s.fallback_policy, '_', ' ')) end,
    case when s.fallback_board_id is not null then 'board' end, s.fallback_board_id;

  -- 13. Current connectivity (advisory: a Session may start before Displays wake) ----
  select count(*) into offline_count
    from public.display_session_screens dss
    left join public.display_health dh on dh.screen_id = dss.screen_id
   where dss.session_id = s.id
     and dss.assignment_status <> 'removed'
     and dss.is_enabled
     and coalesce(dh.connection_state, 'unknown') <> 'online';

  return query select 'displays_online', offline_count = 0, 'warning', false,
    case when offline_count = 0 then 'All enabled Displays are reporting in.'
         else format('%s enabled Display(s) are offline or have not reported yet. '
                     'The Session can still start; they will pick up content when they reconnect.',
                     offline_count) end,
    null::text, null::uuid;
end;
$$;

revoke all on function public.session_readiness(uuid) from public, anon;
grant execute on function public.session_readiness(uuid) to authenticated;

comment on function public.session_readiness(uuid) is
  'Authoritative Session readiness checklist. The manager UI renders these rows; it must not compute its own verdict.';

-- Aggregate form, for list views and the start button.
create or replace function public.session_readiness_summary(target_session_id uuid)
returns table (is_ready boolean, blocking_failures integer, warnings integer, checks_total integer)
language sql
stable
security definer
set search_path to ''
as $$
  select
    count(*) filter (where not passed and blocking) = 0,
    count(*) filter (where not passed and blocking)::integer,
    count(*) filter (where not passed and not blocking)::integer,
    count(*)::integer
  from public.session_readiness(target_session_id);
$$;

revoke all on function public.session_readiness_summary(uuid) from public, anon;
grant execute on function public.session_readiness_summary(uuid) to authenticated;

-- Refresh the cached readiness_state on display_sessions. Advisory cache only.
create or replace function public.refresh_session_readiness(target_session_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  ready boolean;
  org uuid;
begin
  select ds.org_id into org from public.display_sessions ds where ds.id = target_session_id;
  if org is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;
  if (select auth.uid()) is not null and not private.is_org_member(org) then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  select r.is_ready into ready from public.session_readiness_summary(target_session_id) r;

  update public.display_sessions
     set readiness_state = case when ready then 'ready' else 'not_ready' end,
         readiness_checked_at = now()
   where id = target_session_id;

  return case when ready then 'ready' else 'not_ready' end;
end;
$$;

revoke all on function public.refresh_session_readiness(uuid) from public, anon;
grant execute on function public.refresh_session_readiness(uuid) to authenticated;

-- A Session may only enter 'starting' when the authority says it is ready.
-- This is the gate that makes readiness enforceable rather than decorative.
create or replace function public.enforce_session_start_readiness()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  -- Deliberately NOT named `blocking`: session_readiness returns a column with
  -- that name, and PL/pgSQL would not know which one the WHERE clause meant.
  blocking_count integer;
  first_failure text;
begin
  if new.status <> 'starting' or old.status = 'starting' then
    return new;
  end if;

  select count(*), min(r.message)
    into blocking_count, first_failure
    from public.session_readiness(new.id) r
   where not r.passed and r.blocking;

  if blocking_count > 0 then
    raise exception 'This Session is not ready to start: %', first_failure
      using errcode = '23514', hint = 'session_not_ready';
  end if;

  new.readiness_state := 'ready';
  new.readiness_checked_at := now();
  return new;
end;
$$;

drop trigger if exists display_sessions_enforce_start_readiness on public.display_sessions;
-- Named to sort after display_sessions_enforce_transition so the transition
-- table has already validated the move before readiness is evaluated.
create trigger display_sessions_enforce_start_readiness
  before update on public.display_sessions
  for each row execute function public.enforce_session_start_readiness();

commit;
