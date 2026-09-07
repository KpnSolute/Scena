begin;

-- A Connection is one logical provider snapshot and may consume more than one
-- event type. Keep accepted_event_type for backwards-compatible clients while
-- making the array the enforcement authority.
alter table public.content_sources
  add column if not exists accepted_event_types text[] not null
    default array['menu.updated']::text[];

update public.content_sources
   set accepted_event_types = case
     when protocol = 'kpnsolute-events-v1' then array[
       'com.kpnsolute.compute.menu.day.updated.v1',
       'com.kpnsolute.compute.menu.cycle.updated.v1'
     ]::text[]
     else array[accepted_event_type]::text[]
   end;

alter table public.content_sources
  drop constraint if exists content_sources_accepted_event_types_check;
alter table public.content_sources
  add constraint content_sources_accepted_event_types_check
  check (
    cardinality(accepted_event_types) between 1 and 16
    and array_position(accepted_event_types, null) is null
  );

-- Preserve last-known-good fields from sibling event types. A day update
-- replaces the current menu, while a cycle update replaces the cycle; neither
-- erases the other half of the provider snapshot.
create or replace function public.commit_content_source_event(
  target_source_id uuid,
  target_event_id text,
  target_event_type text,
  target_occurred_at timestamptz,
  target_payload jsonb
) returns table(duplicate boolean, version bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.content_sources%rowtype;
begin
  if jsonb_typeof(target_payload) is distinct from 'object' then
    raise exception 'content source payload must be an object';
  end if;

  select * into source_row
    from public.content_sources
   where id = target_source_id and status = 'active'
   for update;
  if not found then raise exception 'content source unavailable'; end if;
  if not (target_event_type = any(source_row.accepted_event_types)) then
    raise exception 'event type not accepted';
  end if;

  insert into public.content_source_events(
    workspace_id, source_id, event_id, event_type, occurred_at, payload
  ) values (
    source_row.workspace_id, source_row.id, target_event_id,
    target_event_type, target_occurred_at, target_payload
  ) on conflict (source_id, event_id) do nothing;

  if not found then
    return query select true, source_row.current_version;
    return;
  end if;

  update public.content_sources set
    current_payload = current_payload || target_payload,
    current_event_id = target_event_id,
    current_event_type = target_event_type,
    current_version = current_version + 1,
    last_received_at = now(),
    updated_at = now()
  where id = source_row.id
  returning current_version into source_row.current_version;

  return query select false, source_row.current_version;
end;
$$;

revoke all on function public.commit_content_source_event(uuid,text,text,timestamptz,jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_content_source_event(uuid,text,text,timestamptz,jsonb)
  to service_role;

-- Correct the live Session count to match the lifecycle quota trigger and add
-- an informational, currently-unmetered Connected Content resource count.
create or replace view public.workspace_usage_current
with (security_invoker = true)
as
  select
    o.id as org_id,
    (select count(*) from public.screens s
      where s.org_id = o.id and s.status <> 'revoked') as displays_used,
    (select count(*) from public.boards b
      where b.workspace_id = o.id and b.status = 'active') as boards_used,
    (select count(*) from public.organization_members m
      where m.org_id = o.id and m.status = 'active') as members_used,
    (select count(*) from public.display_sessions ds
      where ds.org_id = o.id
        and ds.status in ('starting', 'active', 'degraded', 'paused'))
      as active_sessions_used,
    (select count(*) from public.asset_upload_events ae
      where ae.workspace_id = o.id
        and ae.quota_month = date_trunc('month', now() at time zone 'utc')::date)
      as asset_uploads_this_month,
    date_trunc('month', now() at time zone 'utc')::date as quota_month,
    (select count(*) from public.content_sources cs
      where cs.workspace_id = o.id and cs.status = 'active') as content_sources_used
  from public.organizations o
  where private.is_org_member(o.id);

comment on view public.workspace_usage_current is
  'Live Workspace usage against enforced plan limits plus informational unmetered resource counts. Computed rather than stored.';

grant select on public.workspace_usage_current to authenticated;

commit;
