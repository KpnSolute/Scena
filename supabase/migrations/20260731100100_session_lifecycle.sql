-- Scena Session lifecycle state machine.
--
-- Replaces the three-state draft/active/stopped model with the full ten-state
-- lifecycle, enforced in the database so no browser can put a Session into a
-- state it did not legally reach.
--
--   draft -> ready -> starting -> active -> paused -> active
--                                  |  \        \
--                                  |   degraded  stopping -> stopped -> archived
--                                  \-> failed -> ready (recovered)
--
-- Design decisions recorded in docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md:
--
--   * `status` is kept as the lifecycle column rather than adding a parallel
--     `lifecycle_state`. Two columns describing one thing is how drift starts,
--     and every existing caller already reads `status`.
--   * starting / active / degraded / paused all HOLD Displays, so all four
--     consume concurrent-Session capacity. A paused Session has not released
--     its screens; treating it as free capacity would let a Plus Workspace hold
--     two Sessions' worth of Displays against a one-Session entitlement.
--   * Activation content validity now accepts EITHER a per-screen Layout OR a
--     Session-level Board. Before this migration a Session with a Board but no
--     legacy Layout could not activate in independent/single mode -- the
--     board-to-Display bridge was reachable only through duplicate/extend.

begin;

-- ---------------------------------------------------------------------------
-- 1. Lifecycle vocabulary
-- ---------------------------------------------------------------------------

-- States in which a Session still owns its Displays and therefore consumes
-- concurrent-Session capacity.
create or replace function private.session_state_holds_displays(state text)
returns boolean
language sql
immutable
set search_path to ''
as $$ select state in ('starting', 'active', 'degraded', 'paused'); $$;

-- The single authority for legal lifecycle movement.
create or replace function private.session_transition_allowed(from_state text, to_state text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select case
    when from_state = to_state then true                      -- idempotent no-op
    when from_state = 'draft'    then to_state in ('ready', 'archived')
    when from_state = 'ready'    then to_state in ('draft', 'starting', 'archived')
    when from_state = 'starting' then to_state in ('active', 'failed', 'stopping')
    when from_state = 'active'   then to_state in ('degraded', 'paused', 'stopping', 'failed')
    when from_state = 'degraded' then to_state in ('active', 'paused', 'stopping', 'failed')
    when from_state = 'paused'   then to_state in ('active', 'stopping', 'failed')
    when from_state = 'stopping' then to_state in ('stopped', 'failed')
    -- A stopped Session may be relaunched; its history is preserved either way.
    when from_state = 'stopped'  then to_state in ('ready', 'archived')
    -- Recovery from failure returns to 'ready', never straight to 'active':
    -- readiness must be re-proven before Displays are driven again.
    when from_state = 'failed'   then to_state in ('ready', 'stopping', 'stopped', 'archived')
    when from_state = 'archived' then false                   -- terminal
    else false
  end;
$$;

comment on function private.session_transition_allowed(text, text) is
  'Authoritative Session lifecycle transition table. The UI mirrors this; it does not define it.';

-- ---------------------------------------------------------------------------
-- 2. Extend display_sessions
-- ---------------------------------------------------------------------------

alter table public.display_sessions
  add column if not exists description            text,
  add column if not exists session_type           text not null default 'standard',
  add column if not exists updated_by             uuid,
  add column if not exists readiness_state        text not null default 'unknown',
  add column if not exists readiness_checked_at   timestamptz,
  add column if not exists health_state           text not null default 'unknown',
  add column if not exists last_health_at         timestamptz,
  add column if not exists starting_at            timestamptz,
  add column if not exists paused_at              timestamptz,
  add column if not exists paused_by              uuid,
  add column if not exists resumed_at             timestamptz,
  add column if not exists stopping_at            timestamptz,
  add column if not exists failed_at              timestamptz,
  add column if not exists failure_code           text,
  add column if not exists failure_message_safe   text,
  add column if not exists recovered_at           timestamptz,
  add column if not exists archived_at            timestamptz,
  add column if not exists archived_by            uuid,
  add column if not exists fallback_policy        text not null default 'last_valid_content',
  add column if not exists fallback_board_id      uuid,
  add column if not exists settings               jsonb not null default '{}'::jsonb,
  -- Populated with a foreign key in the session-templates migration; declared
  -- here so the lifecycle table shape is complete in one place.
  add column if not exists template_id            uuid,
  add column if not exists config_revision        integer not null default 1;

do $$ begin
  execute 'alter table public.display_sessions add constraint display_sessions_created_by_fk
             foreign key (created_by) references auth.users(id) on delete set null';
exception when duplicate_object or duplicate_table then null;
end $$;

-- The old constraint pinned timestamps to draft/active/stopped only.
alter table public.display_sessions drop constraint if exists display_sessions_status_check;
alter table public.display_sessions drop constraint if exists display_sessions_check1;

alter table public.display_sessions
  add constraint display_sessions_status_check check (status in (
    'draft', 'ready', 'starting', 'active', 'degraded',
    'paused', 'stopping', 'stopped', 'failed', 'archived'
  ));

alter table public.display_sessions
  add constraint display_sessions_session_type_check
    check (session_type in ('standard', 'template_instance', 'group_member')),
  add constraint display_sessions_readiness_state_check
    check (readiness_state in ('unknown', 'not_ready', 'ready')),
  add constraint display_sessions_health_state_check
    check (health_state in ('unknown', 'healthy', 'degraded', 'offline',
                            'configuration_mismatch', 'content_update_pending', 'reconnecting')),
  add constraint display_sessions_fallback_policy_check
    check (fallback_policy in ('last_valid_content', 'blank', 'fallback_board')),
  add constraint display_sessions_fallback_board_shape_check
    check ((fallback_policy = 'fallback_board' and fallback_board_id is not null)
        or (fallback_policy <> 'fallback_board' and fallback_board_id is null)),
  add constraint display_sessions_settings_is_object_check
    check (jsonb_typeof(settings) = 'object'),
  add constraint display_sessions_config_revision_check
    check (config_revision > 0),
  -- Safe error surface only: no provider payloads, no stack traces.
  add constraint display_sessions_failure_message_len_check
    check (failure_message_safe is null or length(failure_message_safe) <= 500);

-- Timestamp coherence, expressed per-state rather than as one giant OR.
alter table public.display_sessions
  add constraint display_sessions_started_shape_check check (
    (status in ('draft', 'ready') and started_at is null and stopped_at is null)
    or status not in ('draft', 'ready')
  ),
  -- started_by is deliberately NOT required. An automation or the scheduler can
  -- legitimately start a Session with no human actor; attribution for those
  -- lives in session_events, which always records actor_type. Requiring a user
  -- here would make scheduled starts impossible.
  add constraint display_sessions_active_shape_check check (
    status <> 'active' or (started_at is not null and stopped_at is null)
  ),
  add constraint display_sessions_stopped_shape_check check (
    status <> 'stopped' or (started_at is not null and stopped_at is not null)
  ),
  add constraint display_sessions_paused_shape_check check (
    status <> 'paused' or (paused_at is not null and started_at is not null)
  ),
  add constraint display_sessions_failed_shape_check check (
    status <> 'failed' or failed_at is not null
  ),
  add constraint display_sessions_archived_shape_check check (
    status <> 'archived' or archived_at is not null
  );

do $$ begin
  execute 'alter table public.display_sessions add constraint display_sessions_fallback_board_fk
             foreign key (fallback_board_id) references public.boards(id) on delete set null';
exception when duplicate_object or duplicate_table then null;
end $$;

comment on column public.display_sessions.config_revision is
  'Incremented whenever content or topology changes. Displays compare this to decide whether a resync is required.';
comment on column public.display_sessions.readiness_state is
  'Cached result of public.session_readiness(). Advisory only -- the function is authoritative.';

-- ---------------------------------------------------------------------------
-- 3. Transition enforcement
-- ---------------------------------------------------------------------------

create or replace function public.enforce_session_lifecycle_transition()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if new.status is distinct from old.status then
    if not private.session_transition_allowed(old.status, new.status) then
      raise exception 'A Session cannot move from % to %', old.status, new.status
        using errcode = '23514', hint = 'session_transition_invalid';
    end if;

    -- Stamp the transition metadata the caller is not trusted to set itself.
    if new.status = 'starting' then
      new.starting_at := now();
      new.started_by  := coalesce(new.started_by, actor);
    elsif new.status = 'active' then
      new.started_at   := coalesce(new.started_at, now());
      new.started_by   := coalesce(new.started_by, actor, old.started_by);
      new.stopped_at   := null;
      new.stopped_by   := null;
      if old.status = 'paused' then new.resumed_at := now(); end if;
      if old.status in ('failed', 'degraded') then new.recovered_at := now(); end if;
      new.failure_code         := null;
      new.failure_message_safe := null;
      new.paused_at := null;
      new.paused_by := null;
    elsif new.status = 'paused' then
      new.paused_at := now();
      new.paused_by := coalesce(new.paused_by, actor);
    elsif new.status = 'stopping' then
      new.stopping_at := now();
    elsif new.status = 'stopped' then
      new.stopped_at := coalesce(new.stopped_at, now());
      new.stopped_by := coalesce(new.stopped_by, actor);
      new.paused_at  := null;
      new.paused_by  := null;
    elsif new.status = 'failed' then
      new.failed_at := now();
      if new.failure_code is null then
        new.failure_code := 'session_failed';
      end if;
    elsif new.status = 'archived' then
      new.archived_at := now();
      new.archived_by := coalesce(new.archived_by, actor);
    elsif new.status = 'ready' then
      -- Returning to ready clears a prior failure but keeps its history in
      -- session_events; the row itself stops advertising a stale error.
      new.failure_code         := null;
      new.failure_message_safe := null;
      if old.status = 'failed' then new.recovered_at := now(); end if;
    elsif new.status = 'draft' then
      new.readiness_state := 'unknown';
    end if;
  end if;

  new.updated_by := coalesce(actor, new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists display_sessions_enforce_transition on public.display_sessions;
create trigger display_sessions_enforce_transition
  before update on public.display_sessions
  for each row execute function public.enforce_session_lifecycle_transition();

-- Any change to content or topology invalidates cached readiness and forces
-- connected Displays to resync.
create or replace function public.bump_session_config_revision()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.board_id           is distinct from old.board_id
     or new.display_mode    is distinct from old.display_mode
     or new.shared_layout_id is distinct from old.shared_layout_id
     or new.fallback_policy is distinct from old.fallback_policy
     or new.fallback_board_id is distinct from old.fallback_board_id then
    new.config_revision := old.config_revision + 1;
    new.readiness_state := 'unknown';
  end if;
  return new;
end;
$$;

drop trigger if exists display_sessions_bump_revision on public.display_sessions;
create trigger display_sessions_bump_revision
  before update on public.display_sessions
  for each row execute function public.bump_session_config_revision();

-- ---------------------------------------------------------------------------
-- 4. Teach the existing session triggers the new states
-- ---------------------------------------------------------------------------

-- Concurrency is consumed by every Display-holding state, not just 'active'.
create or replace function public.enforce_team_concurrent_session_quota()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  ent private.effective_entitlement;
  holding_count integer;
begin
  if not private.session_state_holds_displays(new.status) then return new; end if;
  if tg_op = 'UPDATE' and private.session_state_holds_displays(old.status) then
    return new;  -- already counted; moving between holding states frees nothing
  end if;

  ent := private.effective_entitlements(new.org_id);
  if ent.org_id is null then
    raise exception 'This Workspace has reached its concurrent Session limit';
  end if;

  select count(*) into holding_count
    from public.display_sessions ds
   where ds.org_id = new.org_id
     and ds.id <> new.id
     and private.session_state_holds_displays(ds.status);

  if holding_count >= ent.max_concurrent_sessions then
    raise exception 'This Workspace has reached its concurrent Session limit';
  end if;
  return new;
end;
$$;

-- Screen assignment follows the lifecycle: activate on entry to a live state,
-- release only when the Session truly stops.
create or replace function public.handle_display_session_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    update public.display_session_screens
       set assignment_status = 'active',
           activated_at = coalesce(activated_at, new.started_at, now()),
           removed_at = null,
           removed_by = null
     where session_id = new.id
       and assignment_status = 'configured';
  end if;

  -- A paused Session keeps its screens assigned: pausing is a content decision,
  -- not a release of the Displays. Only stopped/archived release them.
  if new.status in ('stopped', 'archived') and old.status not in ('stopped', 'archived') then
    update public.display_session_screens
       set assignment_status = 'removed',
           removed_at = coalesce(new.stopped_at, new.archived_at, now()),
           removed_by = coalesce(new.stopped_by, new.archived_by)
     where session_id = new.id
       and assignment_status <> 'removed';
  end if;

  return new;
end;
$$;

-- Activation validity, corrected for the Board content model.
create or replace function public.validate_display_session_activation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  enabled_count integer;
  missing_content_count integer;
begin
  -- Checked on entry to 'starting' (the gate before Displays are driven) and
  -- on any content change while live.
  if new.status not in ('starting', 'active')
     or (old.status = new.status
         and old.display_mode is not distinct from new.display_mode
         and old.shared_layout_id is not distinct from new.shared_layout_id
         and old.board_id is not distinct from new.board_id) then
    return new;
  end if;

  select count(*) into enabled_count
    from public.display_session_screens dss
   where dss.session_id = new.id
     and dss.assignment_status <> 'removed'
     and dss.is_enabled;

  if enabled_count = 0 then
    raise exception 'An active session needs at least one enabled screen';
  end if;

  if new.display_mode = 'single' and enabled_count <> 1 then
    raise exception 'Single display mode requires exactly one enabled screen';
  end if;

  if new.display_mode in ('independent', 'single') then
    -- A screen has usable content if it carries its own Layout OR the Session
    -- carries a Board. Requiring a Layout unconditionally made the Board
    -- content model unusable in these two modes.
    if new.board_id is null then
      select count(*) into missing_content_count
        from public.display_session_screens dss
       where dss.session_id = new.id
         and dss.assignment_status <> 'removed'
         and dss.is_enabled
         and dss.layout_id is null;

      if missing_content_count > 0 then
        raise exception '% mode requires every enabled screen to have a Board or Layout', new.display_mode;
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Lifecycle command surface
-- ---------------------------------------------------------------------------

-- One transactional entry point for every lifecycle move. Edge Functions and
-- the manager UI call this instead of writing `status` directly, so the
-- permission check, entitlement check and audit all happen in one place.
create or replace function public.session_transition(
  target_session_id uuid,
  target_status text,
  failure_code text default null,
  failure_message_safe text default null
)
returns public.display_sessions
language plpgsql
security definer
set search_path to ''
as $$
declare
  session_row public.display_sessions;
begin
  select * into session_row
    from public.display_sessions ds
   where ds.id = target_session_id
   for update;

  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if not private.has_org_role(session_row.org_id, array['owner', 'admin', 'operator']) then
    raise exception 'You do not have permission to control this Session'
      using errcode = '42501';
  end if;

  update public.display_sessions ds
     set status = target_status,
         failure_code = case when target_status = 'failed'
                             then coalesce(session_transition.failure_code, 'session_failed')
                             else ds.failure_code end,
         failure_message_safe = case when target_status = 'failed'
                                     then left(session_transition.failure_message_safe, 500)
                                     else ds.failure_message_safe end
   where ds.id = target_session_id
  returning * into session_row;

  return session_row;
end;
$$;

revoke all on function public.session_transition(uuid, text, text, text) from public, anon;
grant execute on function public.session_transition(uuid, text, text, text) to authenticated;

comment on function public.session_transition(uuid, text, text, text) is
  'Authoritative Session lifecycle command. Checks Workspace role, applies the transition table, records the audit event.';

-- ---------------------------------------------------------------------------
-- 6. Indexes supporting the new lifecycle predicates
-- ---------------------------------------------------------------------------

-- Concurrent-capacity checks and the Sessions list both filter on holding states.
create index if not exists display_sessions_org_holding_idx
  on public.display_sessions (org_id)
  where status in ('starting', 'active', 'degraded', 'paused');

create index if not exists display_sessions_org_status_created_idx
  on public.display_sessions (org_id, status, created_at desc);

create index if not exists display_sessions_org_not_archived_idx
  on public.display_sessions (org_id, updated_at desc)
  where status <> 'archived';

create index if not exists display_sessions_board_idx
  on public.display_sessions (board_id) where board_id is not null;

commit;
