-- Scena Display health and synchronisation.
--
-- Design decisions recorded in docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md:
--   * Two shapes, not one. `display_health` holds exactly one current-state row
--     per Display (upserted by heartbeat); `display_health_events` is the
--     append-only trail. Writing a full event per heartbeat would produce
--     enormous write amplification for a fleet that heartbeats every few
--     seconds, so events are emitted only on a STATE CHANGE or a sync outcome.
--   * Session health is a VIEW rolled up from Display health, not a stored
--     column that has to be kept in step. `display_sessions.health_state` is a
--     cache the ingestion path refreshes; the view is authoritative.
--   * Heartbeat ingestion is SECURITY DEFINER and reachable only by the service
--     role, because the caller is display-gateway acting for a device token.
--     Devices never hold an `authenticated` JWT.

begin;

-- ---------------------------------------------------------------------------
-- 1. Current state, one row per Display
-- ---------------------------------------------------------------------------

create table if not exists public.display_health (
  screen_id             uuid primary key references public.screens(id) on delete cascade,
  org_id                uuid not null references public.organizations(id) on delete cascade,
  connection_state      text not null default 'unknown',
  health_state          text not null default 'unknown',
  last_heartbeat_at     timestamptz,
  player_version        text,
  resolution_width      integer check (resolution_width is null or resolution_width > 0),
  resolution_height     integer check (resolution_height is null or resolution_height > 0),
  orientation           text,
  current_session_id    uuid references public.display_sessions(id) on delete set null,
  current_board_id      uuid references public.boards(id) on delete set null,
  current_config_revision integer,
  sync_state            text not null default 'unknown',
  last_sync_started_at  timestamptz,
  last_sync_success_at  timestamptz,
  last_error_code       text,
  last_error_message_safe text,
  network_quality       text,
  cached_content_state  text not null default 'unknown',
  updated_at            timestamptz not null default now(),

  constraint display_health_connection_state_check
    check (connection_state in ('online', 'offline', 'unknown')),
  constraint display_health_health_state_check
    check (health_state in ('healthy', 'degraded', 'offline', 'configuration_mismatch',
                            'content_update_pending', 'reconnecting', 'unknown')),
  constraint display_health_orientation_check
    check (orientation is null or orientation in ('landscape', 'portrait')),
  constraint display_health_sync_state_check
    check (sync_state in ('in_sync', 'pending', 'syncing', 'failed', 'unknown')),
  constraint display_health_network_quality_check
    check (network_quality is null or network_quality in ('good', 'fair', 'poor')),
  constraint display_health_cached_content_state_check
    check (cached_content_state in ('fresh', 'stale', 'absent', 'unknown')),
  constraint display_health_error_message_len_check
    check (last_error_message_safe is null or length(last_error_message_safe) <= 500)
);

comment on table public.display_health is
  'Current operational state of each Display. One row per Display, upserted by heartbeat ingestion.';

create index if not exists display_health_org_state_idx
  on public.display_health (org_id, health_state);
create index if not exists display_health_session_idx
  on public.display_health (current_session_id) where current_session_id is not null;
create index if not exists display_health_stale_idx
  on public.display_health (last_heartbeat_at)
  where connection_state = 'online';

alter table public.display_health enable row level security;

drop policy if exists display_health_select_member on public.display_health;
create policy display_health_select_member
  on public.display_health for select to authenticated
  using (private.is_org_member(org_id));

-- No write policy: only the SECURITY DEFINER ingestion path below writes here.

-- ---------------------------------------------------------------------------
-- 2. Append-only health trail
-- ---------------------------------------------------------------------------

create table if not exists public.display_health_events (
  id            bigint generated always as identity primary key,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  screen_id     uuid not null references public.screens(id) on delete cascade,
  session_id    uuid references public.display_sessions(id) on delete set null,
  event_type    text not null,
  from_state    text,
  to_state      text,
  error_code    text,
  error_message_safe text,
  metadata      jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now(),

  constraint display_health_events_event_type_check check (event_type in (
    'connected', 'disconnected', 'health_changed',
    'sync_started', 'sync_succeeded', 'sync_failed',
    'configuration_mismatch', 'content_update_pending', 'recovered'
  )),
  constraint display_health_events_metadata_is_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint display_health_events_metadata_size_check
    check (pg_column_size(metadata) <= 4096),
  constraint display_health_events_message_len_check
    check (error_message_safe is null or length(error_message_safe) <= 500)
);

comment on table public.display_health_events is
  'Append-only Display health trail. Written on state change and sync outcome only -- never once per heartbeat.';

create index if not exists display_health_events_screen_time_idx
  on public.display_health_events (screen_id, occurred_at desc);
create index if not exists display_health_events_org_time_idx
  on public.display_health_events (org_id, occurred_at desc);
create index if not exists display_health_events_session_time_idx
  on public.display_health_events (session_id, occurred_at desc) where session_id is not null;

alter table public.display_health_events enable row level security;

drop policy if exists display_health_events_select_member on public.display_health_events;
create policy display_health_events_select_member
  on public.display_health_events for select to authenticated
  using (private.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- 3. Heartbeat ingestion
-- ---------------------------------------------------------------------------

create or replace function public.ingest_display_heartbeat(
  target_screen_id        uuid,
  target_player_version   text default null,
  target_resolution_width integer default null,
  target_resolution_height integer default null,
  target_orientation      text default null,
  target_session_id       uuid default null,
  target_board_id         uuid default null,
  target_config_revision  integer default null,
  target_sync_state       text default null,
  target_cached_content_state text default null,
  target_network_quality  text default null,
  target_error_code       text default null,
  target_error_message_safe text default null
)
returns public.display_health
language plpgsql
security definer
set search_path to ''
as $$
declare
  screen_org uuid;
  previous public.display_health;
  resolved_health text;
  resolved_sync text;
  result public.display_health;
begin
  select s.org_id into screen_org
    from public.screens s
   where s.id = target_screen_id and s.status = 'ready';

  if screen_org is null then
    raise exception 'Display is not paired' using errcode = 'P0002';
  end if;

  select * into previous from public.display_health dh where dh.screen_id = target_screen_id;

  resolved_sync := coalesce(target_sync_state, previous.sync_state, 'unknown');

  -- Health is derived here, once, rather than in each client.
  resolved_health := case
    when target_error_code is not null                              then 'degraded'
    when resolved_sync = 'failed'                                   then 'degraded'
    when target_session_id is not null
         and target_config_revision is not null
         and target_config_revision < (
           select ds.config_revision from public.display_sessions ds where ds.id = target_session_id
         )                                                          then 'content_update_pending'
    when target_session_id is null and previous.current_session_id is not null
                                                                    then 'configuration_mismatch'
    when resolved_sync in ('pending', 'syncing')                    then 'content_update_pending'
    else 'healthy'
  end;

  insert into public.display_health as dh (
    screen_id, org_id, connection_state, health_state, last_heartbeat_at,
    player_version, resolution_width, resolution_height, orientation,
    current_session_id, current_board_id, current_config_revision,
    sync_state, last_sync_success_at, last_error_code, last_error_message_safe,
    network_quality, cached_content_state, updated_at
  ) values (
    target_screen_id, screen_org, 'online', resolved_health, now(),
    target_player_version, target_resolution_width, target_resolution_height, target_orientation,
    target_session_id, target_board_id, target_config_revision,
    resolved_sync,
    case when resolved_sync = 'in_sync' then now() end,
    target_error_code, left(target_error_message_safe, 500),
    target_network_quality, coalesce(target_cached_content_state, 'unknown'), now()
  )
  on conflict (screen_id) do update set
    connection_state        = 'online',
    health_state            = resolved_health,
    last_heartbeat_at       = now(),
    player_version          = coalesce(excluded.player_version, dh.player_version),
    resolution_width        = coalesce(excluded.resolution_width, dh.resolution_width),
    resolution_height       = coalesce(excluded.resolution_height, dh.resolution_height),
    orientation             = coalesce(excluded.orientation, dh.orientation),
    current_session_id      = excluded.current_session_id,
    current_board_id        = excluded.current_board_id,
    current_config_revision = excluded.current_config_revision,
    sync_state              = resolved_sync,
    last_sync_success_at    = coalesce(excluded.last_sync_success_at, dh.last_sync_success_at),
    last_error_code         = excluded.last_error_code,
    last_error_message_safe = excluded.last_error_message_safe,
    network_quality         = coalesce(excluded.network_quality, dh.network_quality),
    cached_content_state    = coalesce(excluded.cached_content_state, dh.cached_content_state),
    updated_at              = now()
  returning * into result;

  update public.screens set last_seen_at = now() where id = target_screen_id;

  -- Emit only on a real change, so the trail stays readable and small.
  if previous.screen_id is null or previous.connection_state <> 'online' then
    insert into public.display_health_events (org_id, screen_id, session_id, event_type, from_state, to_state)
    values (screen_org, target_screen_id, target_session_id, 'connected',
            previous.connection_state, 'online');
    perform private.emit_session_event(
      screen_org, target_session_id, 'screen.connected', 'device', null, 'device',
      target_screen_id, null, null, '{}'::jsonb);
  end if;

  if previous.screen_id is not null and previous.health_state is distinct from resolved_health then
    insert into public.display_health_events (
      org_id, screen_id, session_id, event_type, from_state, to_state, error_code, error_message_safe)
    values (screen_org, target_screen_id, target_session_id, 'health_changed',
            previous.health_state, resolved_health, target_error_code,
            left(target_error_message_safe, 500));
    perform private.emit_session_event(
      screen_org, target_session_id, 'screen.health_changed', 'device', null, 'device',
      target_screen_id, null, null,
      jsonb_build_object('from', previous.health_state, 'to', resolved_health));
  end if;

  if previous.screen_id is not null and previous.sync_state is distinct from resolved_sync then
    insert into public.display_health_events (org_id, screen_id, session_id, event_type, from_state, to_state)
    values (screen_org, target_screen_id, target_session_id,
            case resolved_sync
              when 'syncing'  then 'sync_started'
              when 'in_sync'  then 'sync_succeeded'
              when 'failed'   then 'sync_failed'
              else 'health_changed' end,
            previous.sync_state, resolved_sync);
  end if;

  return result;
end;
$$;

revoke all on function public.ingest_display_heartbeat(uuid, text, integer, integer, text, uuid, uuid, integer, text, text, text, text, text)
  from public, anon, authenticated;

comment on function public.ingest_display_heartbeat is
  'Service-role only. Called by display-gateway on behalf of a device token; devices never hold an authenticated JWT.';

-- ---------------------------------------------------------------------------
-- 4. Marking silent Displays offline
-- ---------------------------------------------------------------------------

create or replace function public.sweep_stale_display_health(stale_after interval default interval '3 minutes')
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  affected integer;
begin
  with stale as (
    update public.display_health dh
       set connection_state = 'offline',
           health_state     = 'offline',
           updated_at       = now()
     where dh.connection_state = 'online'
       and (dh.last_heartbeat_at is null or dh.last_heartbeat_at < now() - stale_after)
    returning dh.org_id, dh.screen_id, dh.current_session_id
  ), logged as (
    insert into public.display_health_events (org_id, screen_id, session_id, event_type, from_state, to_state)
    select org_id, screen_id, current_session_id, 'disconnected', 'online', 'offline' from stale
    returning 1
  )
  select count(*) into affected from logged;
  return affected;
end;
$$;

revoke all on function public.sweep_stale_display_health(interval) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Session health rollup
-- ---------------------------------------------------------------------------

create or replace view public.session_health_summary
with (security_invoker = true)
as
  select
    ds.id                                   as session_id,
    ds.org_id,
    ds.status,
    count(dss.id) filter (where dss.assignment_status <> 'removed')      as screens_assigned,
    count(dss.id) filter (where dss.assignment_status <> 'removed'
                            and dss.is_enabled)                          as screens_enabled,
    count(dh.screen_id) filter (where dh.connection_state = 'online')     as screens_online,
    count(dh.screen_id) filter (where dh.health_state = 'healthy')        as screens_healthy,
    count(dh.screen_id) filter (where dh.health_state in
      ('degraded', 'configuration_mismatch', 'content_update_pending'))   as screens_degraded,
    count(dh.screen_id) filter (where dh.health_state = 'offline'
                                   or dh.connection_state = 'offline')    as screens_offline,
    max(dh.last_heartbeat_at)                                             as last_heartbeat_at,
    case
      when count(dss.id) filter (where dss.assignment_status <> 'removed' and dss.is_enabled) = 0
        then 'unknown'
      when count(dh.screen_id) filter (where dh.connection_state = 'online') = 0
        then 'offline'
      when count(dh.screen_id) filter (where dh.health_state in
             ('degraded', 'configuration_mismatch', 'content_update_pending')) > 0
        then 'degraded'
      when count(dh.screen_id) filter (where dh.connection_state = 'offline') > 0
        then 'degraded'
      when count(dh.screen_id) filter (where dh.health_state = 'healthy') > 0
        then 'healthy'
      else 'unknown'
    end                                                                   as health_state
  from public.display_sessions ds
  left join public.display_session_screens dss
    on dss.session_id = ds.id and dss.assignment_status <> 'removed'
  left join public.display_health dh
    on dh.screen_id = dss.screen_id
  group by ds.id, ds.org_id, ds.status;

comment on view public.session_health_summary is
  'Authoritative Session health, rolled up from Display health. display_sessions.health_state is a cache of this.';

grant select on public.display_health         to authenticated;
grant select on public.display_health_events  to authenticated;
grant select on public.session_health_summary to authenticated;

commit;
