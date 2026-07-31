-- ROLLBACK for the 2026-07-31 Scena session-platform migration series.
--
-- Reverses, in reverse dependency order:
--   20260731100000_entitlement_control_plane
--   20260731100100_session_lifecycle
--   20260731100200_session_events
--   20260731100300_display_health
--   20260731100400_session_readiness
--   20260731100500_display_groups
--   20260731100600_session_groups
--   20260731100700_resource_access_control
--   20260731100800_automation_tiers_and_runs
--   20260731100900_session_templates
--
-- DESTRUCTIVE. Dropping these tables discards Session history, Display health
-- history and automation run history permanently. Take a database backup first
-- and confirm with the repository owner. Everything the series ADDED is dropped;
-- nothing that existed before the series is touched.
--
-- Sessions must be returned to the three legacy states before the old CHECK
-- constraint can be restored -- see step 2. Any Session sitting in ready /
-- starting / degraded / paused / stopping / failed / archived is mapped to the
-- nearest legacy state, which LOSES that distinction. This is the single
-- irreversible part of the rollback.

begin;

-- ---------------------------------------------------------------------------
-- 1. Drop new objects (reverse order)
-- ---------------------------------------------------------------------------

drop function if exists public.duplicate_session(uuid, text, boolean);
drop function if exists public.create_session_from_template(uuid, uuid, text);
drop function if exists public.save_session_as_template(uuid, text, text);
drop trigger  if exists session_template_slots_enforce on public.session_template_slots;
drop trigger  if exists session_templates_enforce_entitlement on public.session_templates;
drop function if exists public.enforce_session_template_slot();
drop function if exists public.enforce_session_template_entitlement();
alter table public.display_sessions drop constraint if exists display_sessions_template_fk;
drop table if exists public.session_template_slots;
drop table if exists public.session_templates;

drop function if exists public.expire_stale_automation_leases();
drop function if exists public.reschedule_automation(uuid, timestamptz);
drop function if exists public.fail_automation_run(uuid, text, text, text);
drop function if exists public.complete_automation_run(uuid, text, jsonb);
drop function if exists public.claim_due_automations(text, integer, integer);
drop table if exists public.automation_runs;
drop trigger  if exists display_automations_enforce_entitlement on public.display_automations;
drop function if exists public.enforce_automation_entitlement();
drop function if exists private.automation_tier_allows(text, text);
alter table public.display_automations
  drop constraint if exists display_automations_schedule_kind_check,
  drop constraint if exists display_automations_target_type_check,
  drop constraint if exists display_automations_last_status_check,
  drop constraint if exists display_automations_max_attempts_check,
  drop constraint if exists display_automations_backoff_check,
  drop constraint if exists display_automations_error_len_check;
alter table public.display_automations
  drop column if exists schedule_kind,
  drop column if exists target_type,
  drop column if exists target_id,
  drop column if exists last_status,
  drop column if exists last_error_code,
  drop column if exists last_error_message_safe,
  drop column if exists consecutive_failures,
  drop column if exists max_attempts,
  drop column if exists retry_backoff_seconds,
  drop column if exists disabled_reason,
  drop column if exists created_at_tz_note;

drop policy   if exists display_sessions_update_granted on public.display_sessions;
drop policy   if exists display_sessions_select_granted on public.display_sessions;
drop function if exists public.my_resource_access(uuid, text, uuid);
drop trigger  if exists resource_grants_enforce on public.resource_grants;
drop function if exists public.enforce_resource_grant();
drop table if exists public.resource_grants;
drop function if exists private.can_access_resource(uuid, text, uuid, text);
drop function if exists private.resource_access_level(uuid, text, uuid, uuid);
drop function if exists private.role_baseline_access(text, text);
drop function if exists private.access_level_rank(text);

drop view     if exists public.session_group_health;
drop function if exists public.session_group_command(uuid, text);
drop trigger  if exists session_group_members_enforce on public.session_group_members;
drop trigger  if exists session_groups_enforce_entitlement on public.session_groups;
drop function if exists public.enforce_session_group_membership();
drop function if exists public.enforce_session_group_entitlement();
drop table if exists public.session_group_members;
drop table if exists public.session_groups;

drop view     if exists public.display_group_health;
drop trigger  if exists display_group_members_enforce on public.display_group_members;
drop trigger  if exists display_groups_enforce_entitlement on public.display_groups;
drop function if exists public.enforce_display_group_membership();
drop function if exists public.enforce_display_group_entitlement();
drop table if exists public.display_group_members;
drop table if exists public.display_groups;

drop trigger  if exists display_sessions_enforce_start_readiness on public.display_sessions;
drop function if exists public.enforce_session_start_readiness();
drop function if exists public.refresh_session_readiness(uuid);
drop function if exists public.session_readiness_summary(uuid);
drop function if exists public.session_readiness(uuid);

drop view     if exists public.session_health_summary;
drop function if exists public.sweep_stale_display_health(interval);
drop function if exists public.ingest_display_heartbeat(uuid, text, integer, integer, text, uuid, uuid, integer, text, text, text, text, text);
drop table if exists public.display_health_events;
drop table if exists public.display_health;

drop trigger  if exists display_session_screens_record_events on public.display_session_screens;
drop trigger  if exists display_sessions_record_events on public.display_sessions;
drop function if exists public.record_session_screen_event();
drop function if exists public.record_session_lifecycle_event();
drop function if exists private.emit_session_event(uuid, uuid, text, text, uuid, text, uuid, text, uuid, jsonb, uuid);
drop table if exists public.session_events;

-- ---------------------------------------------------------------------------
-- 2. Return Sessions to the legacy three-state model
--    IRREVERSIBLE: intermediate states collapse to the nearest legacy state.
-- ---------------------------------------------------------------------------

update public.display_sessions
   set status = case
     when status in ('ready')                          then 'draft'
     when status in ('starting', 'degraded', 'paused')  then 'active'
     when status in ('stopping', 'failed', 'archived')  then
       case when started_at is not null then 'stopped' else 'draft' end
     else status end,
       stopped_at = case
     when status in ('stopping', 'failed', 'archived') and started_at is not null
       then coalesce(stopped_at, now()) else stopped_at end,
       stopped_by = case
     when status in ('stopping', 'failed', 'archived') and started_at is not null
       then coalesce(stopped_by, started_by) else stopped_by end
 where status not in ('draft', 'active', 'stopped');

drop trigger  if exists display_sessions_bump_revision on public.display_sessions;
drop trigger  if exists display_sessions_enforce_transition on public.display_sessions;
drop function if exists public.bump_session_config_revision();
drop function if exists public.enforce_session_lifecycle_transition();
drop function if exists public.session_transition(uuid, text, text, text);
drop function if exists private.session_transition_allowed(text, text);
drop function if exists private.session_state_holds_displays(text);

drop index if exists public.display_sessions_org_holding_idx;
drop index if exists public.display_sessions_org_status_created_idx;
drop index if exists public.display_sessions_org_not_archived_idx;
drop index if exists public.display_sessions_board_idx;
drop index if exists public.display_sessions_template_idx;

alter table public.display_sessions
  drop constraint if exists display_sessions_status_check,
  drop constraint if exists display_sessions_session_type_check,
  drop constraint if exists display_sessions_readiness_state_check,
  drop constraint if exists display_sessions_health_state_check,
  drop constraint if exists display_sessions_fallback_policy_check,
  drop constraint if exists display_sessions_fallback_board_shape_check,
  drop constraint if exists display_sessions_settings_is_object_check,
  drop constraint if exists display_sessions_config_revision_check,
  drop constraint if exists display_sessions_failure_message_len_check,
  drop constraint if exists display_sessions_started_shape_check,
  drop constraint if exists display_sessions_active_shape_check,
  drop constraint if exists display_sessions_stopped_shape_check,
  drop constraint if exists display_sessions_paused_shape_check,
  drop constraint if exists display_sessions_failed_shape_check,
  drop constraint if exists display_sessions_archived_shape_check,
  drop constraint if exists display_sessions_fallback_board_fk,
  drop constraint if exists display_sessions_created_by_fk;

alter table public.display_sessions
  drop column if exists description,
  drop column if exists session_type,
  drop column if exists updated_by,
  drop column if exists readiness_state,
  drop column if exists readiness_checked_at,
  drop column if exists health_state,
  drop column if exists last_health_at,
  drop column if exists starting_at,
  drop column if exists paused_at,
  drop column if exists paused_by,
  drop column if exists resumed_at,
  drop column if exists stopping_at,
  drop column if exists failed_at,
  drop column if exists failure_code,
  drop column if exists failure_message_safe,
  drop column if exists recovered_at,
  drop column if exists archived_at,
  drop column if exists archived_by,
  drop column if exists fallback_policy,
  drop column if exists fallback_board_id,
  drop column if exists settings,
  drop column if exists template_id,
  drop column if exists config_revision;

alter table public.display_sessions
  add constraint display_sessions_status_check
    check (status = any (array['draft'::text, 'active'::text, 'stopped'::text])),
  add constraint display_sessions_check1 check (
    ((status = 'draft' and started_at is null and stopped_at is null)
      or (status = 'active' and started_by is not null and started_at is not null and stopped_at is null)
      or (status = 'stopped' and started_by is not null and started_at is not null
          and stopped_by is not null and stopped_at is not null)));

-- ---------------------------------------------------------------------------
-- 3. Entitlement control plane
-- ---------------------------------------------------------------------------

drop view     if exists public.workspace_usage_current;
drop view     if exists public.workspace_effective_entitlements;
drop trigger  if exists organization_entitlements_snapshot on public.organization_entitlements;
drop trigger  if exists organization_entitlements_project_plan on public.organization_entitlements;
drop trigger  if exists workspace_limits_overrides_raise_only on public.workspace_limits_overrides;
drop function if exists private.record_entitlement_snapshot();
drop function if exists private.project_plan_entitlements();
drop function if exists private.enforce_override_is_raise_only();
drop table if exists public.workspace_entitlement_snapshots;
drop table if exists public.workspace_limits_overrides;

alter table public.organization_entitlements
  drop column if exists allow_session_templates,
  drop column if exists allow_operational_notifications,
  drop column if exists max_display_groups,
  drop column if exists max_displays_per_display_group,
  drop column if exists max_session_groups,
  drop column if exists max_sessions_per_session_group,
  drop column if exists max_displays_per_session_group,
  drop column if exists health_retention_days,
  drop column if exists history_retention_days;

drop table if exists public.plan_entitlements;

-- effective_entitlements must go before the composite type it returns.
drop function if exists private.effective_entitlements(uuid);
drop type     if exists private.effective_entitlement;

-- ---------------------------------------------------------------------------
-- 4. Restore the pre-series function bodies that this series replaced
-- ---------------------------------------------------------------------------

create or replace function public.enforce_team_display_quota()
returns trigger language plpgsql security definer set search_path to '' as $$
declare display_limit integer; display_count integer;
begin
  if new.org_id is null or new.status = 'revoked' then return new; end if;
  select oe.max_displays into display_limit from public.organization_entitlements oe where oe.org_id = new.org_id;
  select count(*) into display_count from public.screens s
   where s.org_id = new.org_id and s.status <> 'revoked' and s.id <> new.id;
  if display_limit is null or display_count >= display_limit then
    raise exception 'This Workspace has reached its Display limit';
  end if;
  return new;
end; $$;

create or replace function public.enforce_team_concurrent_session_quota()
returns trigger language plpgsql security definer set search_path to '' as $$
declare session_limit integer; active_count integer;
begin
  if new.status <> 'active' or old.status = 'active' then return new; end if;
  select oe.max_concurrent_sessions into session_limit from public.organization_entitlements oe where oe.org_id = new.org_id;
  select count(*) into active_count from public.display_sessions ds
   where ds.org_id = new.org_id and ds.status = 'active' and ds.id <> new.id;
  if session_limit is null or active_count >= session_limit then
    raise exception 'This Workspace has reached its concurrent Session limit';
  end if;
  return new;
end; $$;

create or replace function public.enforce_workspace_board_quota()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare board_limit integer; board_count integer;
begin
  select max_boards into board_limit from public.organization_entitlements where org_id = new.workspace_id;
  if board_limit is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('boards:' || new.workspace_id::text, 0));
  select count(*) into board_count from public.boards where workspace_id = new.workspace_id and status = 'active';
  if board_count >= board_limit then raise exception 'workspace Board limit reached'; end if;
  return new;
end; $$;

create or replace function public.handle_display_session_status()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    update public.display_session_screens
       set assignment_status = 'active',
           activated_at = coalesce(activated_at, new.started_at, now()),
           removed_at = null, removed_by = null
     where session_id = new.id and assignment_status = 'configured';
  end if;
  if new.status = 'stopped' and old.status is distinct from 'stopped' then
    update public.display_session_screens
       set assignment_status = 'removed',
           removed_at = coalesce(new.stopped_at, now()), removed_by = new.stopped_by
     where session_id = new.id and assignment_status <> 'removed';
  end if;
  return new;
end; $$;

-- prepare_session_screen_assignment and validate_display_session_activation are
-- restored from git history: see the pre-series definitions preserved in
-- docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md, appendix "Pre-series
-- function bodies". They are omitted here because their bodies are long and
-- reproducing them inline risks transcription drift; take them from the
-- appendix verbatim.

commit;
