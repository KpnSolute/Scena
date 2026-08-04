create table public.content_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  source_type text not null default 'webhook' check (source_type in ('webhook')),
  protocol text not null default 'legacy' check (protocol in ('legacy','kpnsolute-events-v1')),
  status text not null default 'active' check (status in ('active','archived')),
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  accepted_event_type text not null default 'menu.updated' check (length(btrim(accepted_event_type)) between 1 and 120),
  external_tenant_id text check (external_tenant_id is null or length(btrim(external_tenant_id)) between 2 and 63),
  kpn_subscription_id text,
  signing_secret_ciphertext text,
  current_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(current_payload) = 'object'),
  current_event_id text,
  current_event_type text,
  current_version bigint not null default 0 check (current_version >= 0),
  last_received_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.content_source_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  source_id uuid not null,
  event_id text not null check (length(btrim(event_id)) between 1 and 160),
  event_type text not null check (length(btrim(event_type)) between 1 and 120),
  occurred_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  received_at timestamptz not null default now(),
  unique (source_id, event_id),
  foreign key (workspace_id, source_id) references public.content_sources(workspace_id, id) on delete cascade
);

create index content_sources_workspace_status_idx on public.content_sources(workspace_id, status, updated_at desc);
create index content_source_events_source_received_idx on public.content_source_events(source_id, received_at desc);

alter table public.content_sources enable row level security;
alter table public.content_sources force row level security;
alter table public.content_source_events enable row level security;
alter table public.content_source_events force row level security;

create policy content_sources_select_member on public.content_sources for select to authenticated
using (private.is_org_member(workspace_id));
create policy content_source_events_select_member on public.content_source_events for select to authenticated
using (private.is_org_member(workspace_id));

revoke all on public.content_sources, public.content_source_events from anon, authenticated;
grant select on public.content_sources, public.content_source_events to authenticated;
grant all on public.content_sources, public.content_source_events to service_role;

create or replace function public.commit_content_source_event(
  target_source_id uuid,
  target_event_id text,
  target_event_type text,
  target_occurred_at timestamptz,
  target_payload jsonb
) returns table(duplicate boolean, version bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_row public.content_sources%rowtype;
begin
  select * into source_row from public.content_sources where id = target_source_id and status = 'active' for update;
  if not found then raise exception 'content source unavailable'; end if;
  if source_row.accepted_event_type <> target_event_type then raise exception 'event type not accepted'; end if;

  insert into public.content_source_events(workspace_id, source_id, event_id, event_type, occurred_at, payload)
  values (source_row.workspace_id, source_row.id, target_event_id, target_event_type, target_occurred_at, target_payload)
  on conflict (source_id, event_id) do nothing;
  if not found then return query select true, source_row.current_version; return; end if;

  update public.content_sources set
    current_payload = target_payload,
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

revoke all on function public.commit_content_source_event(uuid,text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.commit_content_source_event(uuid,text,text,timestamptz,jsonb) to service_role;
