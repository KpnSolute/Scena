-- Scena Session history: an append-only event log.
--
-- Design decisions recorded in docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md:
--   * Append-only through RLS: members may SELECT, nobody may INSERT, UPDATE or
--     DELETE from the API. Every row is written by a SECURITY DEFINER emitter,
--     so the timeline cannot be edited to hide an operation.
--   * `metadata` is capped and documented as safe-only. Stripe payloads, device
--     credentials, signed URLs and provider errors never belong here; the safe
--     failure code/message pair on display_sessions is the error surface.
--   * The log survives Session deletion of drafts by cascading, but a Session
--     that ever started cannot be deleted (no RLS delete path for non-drafts),
--     so real operational history is durable.

begin;

create table if not exists public.session_events (
  id             bigint generated always as identity primary key,
  org_id         uuid not null references public.organizations(id) on delete cascade,
  session_id     uuid references public.display_sessions(id) on delete cascade,
  event_type     text not null,
  actor_type     text not null default 'system',
  actor_id       uuid,
  source         text not null default 'database',
  screen_id      uuid references public.screens(id) on delete set null,
  resource_type  text,
  resource_id    uuid,
  correlation_id uuid,
  metadata       jsonb not null default '{}'::jsonb,
  occurred_at    timestamptz not null default now(),

  constraint session_events_event_type_check check (event_type in (
    'session.created', 'session.updated', 'session.ready', 'session.unready',
    'session.screen_added', 'session.screen_removed', 'session.screen_updated',
    'session.mode_changed', 'session.board_changed',
    'session.started', 'session.paused', 'session.resumed',
    'session.stopping', 'session.stopped', 'session.failed',
    'session.degraded', 'session.recovered', 'session.archived',
    'screen.connected', 'screen.disconnected',
    'screen.sync_started', 'screen.sync_succeeded', 'screen.sync_failed',
    'screen.health_changed',
    'automation.scheduled', 'automation.executed', 'automation.failed',
    'group.session_started', 'group.session_stopped',
    'template.saved', 'template.instantiated', 'session.duplicated'
  )),
  constraint session_events_actor_type_check check (actor_type in (
    'user', 'system', 'device', 'automation', 'scheduler', 'service'
  )),
  constraint session_events_source_check check (source in (
    'manager_ui', 'edge_function', 'database', 'device', 'scheduler', 'automation'
  )),
  constraint session_events_resource_shape_check check (
    (resource_type is null and resource_id is null) or (resource_type is not null)
  ),
  constraint session_events_metadata_is_object_check check (jsonb_typeof(metadata) = 'object'),
  -- A hard ceiling is the only reliable way to stop an unbounded provider
  -- payload being dumped into the customer-visible timeline.
  constraint session_events_metadata_size_check check (pg_column_size(metadata) <= 8192)
);

comment on table public.session_events is
  'Append-only Session and Display operational history. Safe metadata only: never secrets, provider payloads or signed URLs.';

create index if not exists session_events_session_time_idx
  on public.session_events (session_id, occurred_at desc);
create index if not exists session_events_org_time_idx
  on public.session_events (org_id, occurred_at desc);
create index if not exists session_events_org_type_time_idx
  on public.session_events (org_id, event_type, occurred_at desc);
create index if not exists session_events_screen_time_idx
  on public.session_events (screen_id, occurred_at desc) where screen_id is not null;

alter table public.session_events enable row level security;

-- Read-only to members. There is deliberately no insert/update/delete policy:
-- the emitter below is the only writer.
drop policy if exists session_events_select_member on public.session_events;
create policy session_events_select_member
  on public.session_events for select to authenticated
  using (private.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Emitter
-- ---------------------------------------------------------------------------

create or replace function private.emit_session_event(
  target_org_id       uuid,
  target_session_id   uuid,
  target_event_type   text,
  target_actor_type   text default null,
  target_actor_id     uuid default null,
  target_source       text default 'database',
  target_screen_id    uuid default null,
  target_resource_type text default null,
  target_resource_id  uuid default null,
  target_metadata     jsonb default '{}'::jsonb,
  target_correlation_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path to ''
as $$
declare
  actor uuid := coalesce(target_actor_id, (select auth.uid()));
  new_id bigint;
begin
  insert into public.session_events (
    org_id, session_id, event_type, actor_type, actor_id, source,
    screen_id, resource_type, resource_id, metadata, correlation_id
  ) values (
    target_org_id, target_session_id, target_event_type,
    coalesce(target_actor_type, case when actor is null then 'system' else 'user' end),
    actor, target_source, target_screen_id, target_resource_type, target_resource_id,
    coalesce(target_metadata, '{}'::jsonb), target_correlation_id
  )
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function private.emit_session_event(uuid, uuid, text, text, uuid, text, uuid, text, uuid, jsonb, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Automatic emission from the lifecycle
-- ---------------------------------------------------------------------------

create or replace function public.record_session_lifecycle_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  evt text;
begin
  if tg_op = 'INSERT' then
    perform private.emit_session_event(
      new.org_id, new.id, 'session.created', null, null, 'database',
      null, null, null, jsonb_build_object('name', new.name, 'display_mode', new.display_mode)
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    evt := case new.status
      when 'ready'    then 'session.ready'
      when 'starting' then 'session.started'
      when 'active'   then case when old.status = 'paused' then 'session.resumed'
                                when old.status in ('failed', 'degraded') then 'session.recovered'
                                else 'session.started' end
      when 'degraded' then 'session.degraded'
      when 'paused'   then 'session.paused'
      when 'stopping' then 'session.stopping'
      when 'stopped'  then 'session.stopped'
      when 'failed'   then 'session.failed'
      when 'archived' then 'session.archived'
      when 'draft'    then 'session.unready'
    end;

    if evt is not null then
      perform private.emit_session_event(
        new.org_id, new.id, evt, null, null, 'database', null, null, null,
        jsonb_strip_nulls(jsonb_build_object(
          'from', old.status,
          'to', new.status,
          'failure_code', case when new.status = 'failed' then new.failure_code end,
          'failure_message', case when new.status = 'failed' then new.failure_message_safe end
        ))
      );
    end if;
  end if;

  if new.board_id is distinct from old.board_id then
    perform private.emit_session_event(
      new.org_id, new.id, 'session.board_changed', null, null, 'database',
      null, 'board', new.board_id,
      jsonb_strip_nulls(jsonb_build_object('from_board_id', old.board_id, 'to_board_id', new.board_id))
    );
  end if;

  if new.display_mode is distinct from old.display_mode then
    perform private.emit_session_event(
      new.org_id, new.id, 'session.mode_changed', null, null, 'database', null, null, null,
      jsonb_build_object('from', old.display_mode, 'to', new.display_mode)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists display_sessions_record_events on public.display_sessions;
create trigger display_sessions_record_events
  after insert or update on public.display_sessions
  for each row execute function public.record_session_lifecycle_event();

create or replace function public.record_session_screen_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.emit_session_event(
      new.org_id, new.session_id, 'session.screen_added', null, null, 'database',
      new.screen_id, 'session_screen', new.id,
      jsonb_strip_nulls(jsonb_build_object('layout_id', new.layout_id, 'is_primary', new.is_primary))
    );
  elsif new.assignment_status = 'removed' and old.assignment_status <> 'removed' then
    perform private.emit_session_event(
      new.org_id, new.session_id, 'session.screen_removed', null, null, 'database',
      new.screen_id, 'session_screen', new.id, '{}'::jsonb
    );
  elsif new.layout_id is distinct from old.layout_id
     or new.is_enabled is distinct from old.is_enabled
     or new.is_primary is distinct from old.is_primary then
    perform private.emit_session_event(
      new.org_id, new.session_id, 'session.screen_updated', null, null, 'database',
      new.screen_id, 'session_screen', new.id,
      jsonb_strip_nulls(jsonb_build_object(
        'layout_id', new.layout_id,
        'is_enabled', new.is_enabled,
        'is_primary', new.is_primary
      ))
    );
  end if;
  return new;
end;
$$;

drop trigger if exists display_session_screens_record_events on public.display_session_screens;
create trigger display_session_screens_record_events
  after insert or update on public.display_session_screens
  for each row execute function public.record_session_screen_event();

grant select on public.session_events to authenticated;

commit;
