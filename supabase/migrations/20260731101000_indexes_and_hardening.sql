-- Scena session-platform hardening and optimisation pass.
--
-- Three jobs:
--   1. Corrective fixes for defects the database test suite caught after the
--      earlier migrations in this series had already been applied.
--   2. Indexes for every RLS predicate and foreign-key access path introduced
--      by this series, plus the critical pre-existing paths that had none.
--   3. Grant and search_path hygiene on the functions this series added.

begin;

-- ---------------------------------------------------------------------------
-- 1. Corrective fixes
-- ---------------------------------------------------------------------------

-- started_by must not be required on an active Session. A Session started by an
-- automation or the scheduler has no human actor; forcing one made scheduled
-- starts impossible. Attribution for those lives in session_events.actor_type.
alter table public.display_sessions
  drop constraint if exists display_sessions_active_shape_check;
alter table public.display_sessions
  add constraint display_sessions_active_shape_check check (
    status <> 'active' or (started_at is not null and stopped_at is null)
  );

-- The legacy stopped-state check also required started_by; same reasoning.
alter table public.display_sessions
  drop constraint if exists display_sessions_stopped_shape_check;
alter table public.display_sessions
  add constraint display_sessions_stopped_shape_check check (
    status <> 'stopped' or (started_at is not null and stopped_at is not null)
  );

-- prepare_session_screen_assignment carried the same Board-blind content rule
-- that validate_display_session_activation had: it rejected an enabled Display
-- with no Layout even when the Session carried a Board, which made the Board
-- content model unusable in independent and single mode.
create or replace function public.prepare_session_screen_assignment()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  session_status text;
  session_mode text;
  session_board uuid;
  screen_status text;
  ent private.effective_entitlement;
  current_count integer;
  enabled_count integer;
begin
  select ds.status, ds.display_mode, ds.board_id
    into session_status, session_mode, session_board
    from public.display_sessions ds
   where ds.id = new.session_id
     and ds.org_id = new.org_id
     and ds.location_id = new.location_id;

  if not found then
    raise exception 'Display Session was not found for this Team and location';
  end if;

  if session_status in ('stopped', 'archived') and new.assignment_status <> 'removed' then
    raise exception 'Displays cannot be added to a stopped Session';
  end if;

  if new.assignment_status <> 'removed' then
    select s.status into screen_status
      from public.screens s
     where s.id = new.screen_id
       and s.org_id = new.org_id
       and s.location_id = new.location_id;

    if screen_status is distinct from 'ready' then
      raise exception 'Only paired, ready Displays can be added to a Session';
    end if;

    if session_status = 'active'
       and session_mode in ('independent', 'single')
       and new.is_enabled
       and new.layout_id is null
       and session_board is null then
      raise exception '% mode requires an enabled Display to have a Board or Layout', session_mode;
    end if;

    ent := private.effective_entitlements(new.org_id);
    if ent.org_id is null then
      raise exception 'No Display entitlement exists for this Team';
    end if;

    select count(*) into current_count
      from public.display_session_screens dss
     where dss.session_id = new.session_id
       and dss.assignment_status <> 'removed'
       and dss.id <> new.id;

    if current_count >= ent.max_displays_per_session then
      raise exception 'A Session allows at most % Display(s)', ent.max_displays_per_session;
    end if;

    if session_status = 'active' and session_mode = 'single' and new.is_enabled then
      select count(*) into enabled_count
        from public.display_session_screens dss
       where dss.session_id = new.session_id
         and dss.assignment_status <> 'removed'
         and dss.is_enabled
         and dss.id <> new.id;

      if enabled_count > 0 then
        raise exception 'Single mode allows exactly one enabled Display';
      end if;
    end if;

    if session_status = 'active' then
      new.assignment_status = 'active';
      new.activated_at = coalesce(new.activated_at, now());
      new.removed_at = null;
    else
      new.assignment_status = 'configured';
      new.activated_at = null;
      new.removed_at = null;
    end if;
  else
    new.removed_at = coalesce(new.removed_at, now());
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Indexes for RLS predicates and foreign-key access paths
-- ---------------------------------------------------------------------------

-- Every RLS policy in this schema resolves through organization_members on
-- (user_id, org_id, status). Without this index, private.is_org_member() is a
-- sequential scan on EVERY row of EVERY policy evaluation -- the single hottest
-- path in the whole database.
create index if not exists organization_members_user_org_active_idx
  on public.organization_members (user_id, org_id) where status = 'active';
create index if not exists organization_members_org_role_idx
  on public.organization_members (org_id, role) where status = 'active';

-- Foreign keys that had no supporting index. An unindexed FK turns every parent
-- delete into a full scan of the child table.
create index if not exists display_session_screens_session_active_idx
  on public.display_session_screens (session_id)
  where assignment_status <> 'removed';
create index if not exists display_session_screens_screen_active_idx
  on public.display_session_screens (screen_id)
  where assignment_status <> 'removed';
create index if not exists display_session_screens_org_idx
  on public.display_session_screens (org_id);
create index if not exists display_session_screens_layout_idx
  on public.display_session_screens (layout_id) where layout_id is not null;

-- Available-Display selection: "Displays in this Workspace not held by a live
-- Session" is the query behind the add-Display picker.
create index if not exists screens_org_status_idx
  on public.screens (org_id, status) where org_id is not null;
create index if not exists screens_location_idx
  on public.screens (location_id) where location_id is not null;

-- Board quota enforcement and the Boards list.
create index if not exists boards_workspace_active_idx
  on public.boards (workspace_id) where status = 'active';

-- Monthly upload quota: workspace_usage_current filters on exactly this pair.
create index if not exists asset_upload_events_workspace_month_idx
  on public.asset_upload_events (workspace_id, quota_month);

-- Content-processing readiness check joins scene_elements to assets by board.
create index if not exists scene_elements_board_asset_idx
  on public.scene_elements (board_id, asset_id) where asset_id is not null;

-- Entitlement resolution, called by every quota trigger.
create index if not exists workspace_limits_overrides_live_idx
  on public.workspace_limits_overrides (org_id)
  where expires_at is null;

-- ---------------------------------------------------------------------------
-- 3. Function hygiene
-- ---------------------------------------------------------------------------

-- Nothing in this series should be callable by anon or by PUBLIC. The
-- individual migrations revoke as they go; this is the sweep that proves it,
-- and catches anything a future migration forgets.
do $$
declare
  fn record;
begin
  for fn in
    select n.nspname as schema_name,
           p.proname  as function_name,
           pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and p.prokind = 'f'
       and p.proname in (
         'emit_session_event', 'ingest_display_heartbeat', 'sweep_stale_display_health',
         'claim_due_automations', 'complete_automation_run', 'fail_automation_run',
         'reschedule_automation', 'expire_stale_automation_leases',
         'project_plan_entitlements', 'record_entitlement_snapshot',
         'enforce_override_is_raise_only', 'session_state_holds_displays',
         'session_transition_allowed', 'automation_tier_allows',
         'access_level_rank', 'role_baseline_access'
       )
  loop
    execute format('revoke all on function %I.%I(%s) from public, anon',
                   fn.schema_name, fn.function_name, fn.args);
  end loop;
end $$;

-- Trigger functions must never be directly executable by anon or PUBLIC.
-- Postgres refuses to call them directly anyway, but leaving the grant in place
-- is noise on every security review, and a future refactor that changes a
-- return type would silently expose one.
do $$
declare fn record;
begin
  for fn in
    select n.nspname as schema_name, p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke all on function %I.%I(%s) from public, anon',
                   fn.schema_name, fn.function_name, fn.args);
  end loop;
end $$;

-- Every function this series added already pins search_path. Assert it, so a
-- later edit that drops the setting fails the migration instead of shipping a
-- search-path-injection surface.
do $$
declare
  offenders text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ')
    into offenders
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private')
     and p.prosecdef
     and (p.proconfig is null
          or not exists (select 1 from unnest(p.proconfig) c where c like 'search\_path=%'))
     and p.proname in (
       'session_readiness', 'session_readiness_summary', 'refresh_session_readiness',
       'enforce_session_start_readiness', 'session_transition',
       'enforce_session_lifecycle_transition', 'bump_session_config_revision',
       'record_session_lifecycle_event', 'record_session_screen_event',
       'ingest_display_heartbeat', 'sweep_stale_display_health',
       'enforce_display_group_entitlement', 'enforce_display_group_membership',
       'enforce_session_group_entitlement', 'enforce_session_group_membership',
       'session_group_command', 'enforce_resource_grant', 'my_resource_access',
       'resource_access_level', 'can_access_resource',
       'enforce_automation_entitlement', 'claim_due_automations',
       'complete_automation_run', 'fail_automation_run', 'reschedule_automation',
       'expire_stale_automation_leases', 'enforce_session_template_entitlement',
       'enforce_session_template_slot', 'save_session_as_template',
       'create_session_from_template', 'duplicate_session',
       'effective_entitlements', 'emit_session_event',
       'project_plan_entitlements', 'record_entitlement_snapshot',
       'enforce_override_is_raise_only'
     );

  if offenders is not null then
    raise exception 'SECURITY DEFINER functions without a pinned search_path: %', offenders;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Retention helper
-- ---------------------------------------------------------------------------

-- Trims history beyond each Workspace's plan retention window. Called on a
-- schedule; never on the request path.
create or replace function public.prune_expired_history()
returns table (session_events_deleted bigint, health_events_deleted bigint)
language plpgsql
security definer
set search_path to ''
as $$
begin
  with pruned as (
    delete from public.session_events e
     using public.organization_entitlements oe
     where oe.org_id = e.org_id
       and e.occurred_at < now() - make_interval(days => oe.history_retention_days)
    returning 1
  )
  select count(*) into session_events_deleted from pruned;

  with pruned as (
    delete from public.display_health_events e
     using public.organization_entitlements oe
     where oe.org_id = e.org_id
       and e.occurred_at < now() - make_interval(days => oe.health_retention_days)
    returning 1
  )
  select count(*) into health_events_deleted from pruned;

  return next;
end;
$$;

revoke all on function public.prune_expired_history() from public, anon, authenticated;

comment on function public.prune_expired_history() is
  'Scheduled retention sweep. Honours each Workspace plan''s history_retention_days and health_retention_days.';

commit;
