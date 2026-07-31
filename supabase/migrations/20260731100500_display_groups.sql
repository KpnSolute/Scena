-- Scena Display Groups (Max plan).
--
-- SOP Purpose §6.3 grants Display Groups to Max only. SOP Roadmap §7 Stage 2
-- caps a group at four Displays and requires Team isolation plus group health.
--
-- Design decisions recorded in docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md:
--   * The entitlement is enforced in the DATABASE, not the UI. A Plus Workspace
--     calling PostgREST directly still cannot create a group.
--   * Group membership NEVER bypasses Display ownership, location scope, active
--     Session conflicts or plan limits. A group is a reusable targeting handle,
--     not a permission escalation.
--   * Groups are archived, never hard-deleted while they have history.

begin;

create table if not exists public.display_groups (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  location_id       uuid not null references public.locations(id) on delete cascade,
  name              text not null check (length(btrim(name)) > 0 and length(name) <= 120),
  description       text check (description is null or length(description) <= 1000),
  status            text not null default 'active' check (status in ('active', 'archived')),
  fallback_board_id uuid references public.boards(id) on delete set null,
  created_by        uuid default auth.uid(),
  updated_by        uuid,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint display_groups_archive_shape_check
    check ((status = 'archived' and archived_at is not null)
        or (status = 'active' and archived_at is null))
);

create unique index if not exists display_groups_org_name_active_idx
  on public.display_groups (org_id, lower(name)) where status = 'active';
create index if not exists display_groups_org_status_idx
  on public.display_groups (org_id, status, created_at desc);
create index if not exists display_groups_location_idx on public.display_groups (location_id);

create table if not exists public.display_group_members (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.display_groups(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  screen_id    uuid not null references public.screens(id) on delete cascade,
  member_order integer not null default 0 check (member_order >= 0),
  added_by     uuid default auth.uid(),
  added_at     timestamptz not null default now(),
  constraint display_group_members_unique unique (group_id, screen_id)
);

create index if not exists display_group_members_group_order_idx
  on public.display_group_members (group_id, member_order);
create index if not exists display_group_members_screen_idx
  on public.display_group_members (screen_id);
create index if not exists display_group_members_org_idx
  on public.display_group_members (org_id);

-- ---------------------------------------------------------------------------
-- Entitlement and integrity enforcement
-- ---------------------------------------------------------------------------

create or replace function public.enforce_display_group_entitlement()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  ent private.effective_entitlement;
  group_count integer;
begin
  ent := private.effective_entitlements(new.org_id);

  if ent.org_id is null or not ent.allow_display_groups then
    raise exception 'Display Groups are available on the Max plan'
      using errcode = '42501', hint = 'entitlement_display_groups';
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'active' then
      perform pg_advisory_xact_lock(hashtextextended('display_groups:' || new.org_id::text, 0));
      select count(*) into group_count
        from public.display_groups g
       where g.org_id = new.org_id and g.status = 'active' and g.id <> new.id;

      if group_count >= ent.max_display_groups then
        raise exception 'This plan allows % Display Group(s)', ent.max_display_groups
          using errcode = '23514', hint = 'entitlement_display_group_limit';
      end if;
    end if;
  end if;

  -- The Location must belong to the same Workspace as the group.
  if not exists (select 1 from public.locations l
                  where l.id = new.location_id and l.org_id = new.org_id) then
    raise exception 'That Location does not belong to this Workspace' using errcode = '42501';
  end if;

  if new.fallback_board_id is not null
     and not exists (select 1 from public.boards b
                      where b.id = new.fallback_board_id and b.workspace_id = new.org_id) then
    raise exception 'That Board does not belong to this Workspace' using errcode = '42501';
  end if;

  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists display_groups_enforce_entitlement on public.display_groups;
create trigger display_groups_enforce_entitlement
  before insert or update on public.display_groups
  for each row execute function public.enforce_display_group_entitlement();

create or replace function public.enforce_display_group_membership()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  ent private.effective_entitlement;
  grp public.display_groups;
  member_count integer;
  screen_row public.screens;
begin
  select * into grp from public.display_groups g where g.id = new.group_id;
  if not found then
    raise exception 'Display Group not found' using errcode = 'P0002';
  end if;

  -- Cross-Workspace references are rejected outright.
  if grp.org_id <> new.org_id then
    raise exception 'Display Group belongs to a different Workspace' using errcode = '42501';
  end if;

  if grp.status <> 'active' then
    raise exception 'Displays cannot be added to an archived Display Group';
  end if;

  ent := private.effective_entitlements(new.org_id);
  if ent.org_id is null or not ent.allow_display_groups then
    raise exception 'Display Groups are available on the Max plan'
      using errcode = '42501', hint = 'entitlement_display_groups';
  end if;

  select * into screen_row from public.screens s where s.id = new.screen_id;
  if not found or screen_row.org_id is distinct from new.org_id then
    raise exception 'That Display does not belong to this Workspace' using errcode = '42501';
  end if;
  if screen_row.status <> 'ready' then
    raise exception 'Only paired, ready Displays can join a Display Group';
  end if;
  -- Location scope: a group targets one Location, so its members must live there.
  if screen_row.location_id is distinct from grp.location_id then
    raise exception 'That Display is not at this Display Group''s Location';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('display_group_members:' || new.group_id::text, 0));
  select count(*) into member_count
    from public.display_group_members m
   where m.group_id = new.group_id and m.id <> new.id;

  if member_count >= ent.max_displays_per_display_group then
    raise exception 'A Display Group holds at most % Display(s)', ent.max_displays_per_display_group
      using errcode = '23514', hint = 'entitlement_display_group_size';
  end if;

  return new;
end;
$$;

drop trigger if exists display_group_members_enforce on public.display_group_members;
create trigger display_group_members_enforce
  before insert or update on public.display_group_members
  for each row execute function public.enforce_display_group_membership();

-- ---------------------------------------------------------------------------
-- Group health rollup
-- ---------------------------------------------------------------------------

create or replace view public.display_group_health
with (security_invoker = true)
as
  select
    g.id as group_id,
    g.org_id,
    g.name,
    g.status,
    count(m.id)                                                      as displays_total,
    count(dh.screen_id) filter (where dh.connection_state = 'online') as displays_online,
    count(dh.screen_id) filter (where dh.health_state = 'healthy')    as displays_healthy,
    count(dh.screen_id) filter (where dh.health_state in
      ('degraded', 'configuration_mismatch', 'content_update_pending')) as displays_degraded,
    count(distinct dss.session_id) filter (
      where dss.assignment_status <> 'removed'
        and private.session_state_holds_displays(ds.status))          as live_sessions_touched,
    max(dh.last_heartbeat_at)                                         as last_heartbeat_at,
    case
      when count(m.id) = 0                                                          then 'unknown'
      when count(dh.screen_id) filter (where dh.connection_state = 'online') = 0     then 'offline'
      when count(dh.screen_id) filter (where dh.health_state in
             ('degraded', 'configuration_mismatch', 'content_update_pending')) > 0
        or count(m.id) <> count(dh.screen_id) filter (where dh.connection_state = 'online')
                                                                                     then 'degraded'
      else 'healthy'
    end                                                                              as health_state
  from public.display_groups g
  left join public.display_group_members m on m.group_id = g.id
  left join public.display_health dh on dh.screen_id = m.screen_id
  left join public.display_session_screens dss on dss.screen_id = m.screen_id
  left join public.display_sessions ds on ds.id = dss.session_id
  group by g.id, g.org_id, g.name, g.status;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.display_groups enable row level security;
alter table public.display_group_members enable row level security;

drop policy if exists display_groups_select_member on public.display_groups;
create policy display_groups_select_member on public.display_groups
  for select to authenticated using (private.is_org_member(org_id));

drop policy if exists display_groups_insert_operator on public.display_groups;
create policy display_groups_insert_operator on public.display_groups
  for insert to authenticated
  with check (private.has_org_role(org_id, array['owner', 'admin', 'operator']));

drop policy if exists display_groups_update_operator on public.display_groups;
create policy display_groups_update_operator on public.display_groups
  for update to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin', 'operator']))
  with check (private.has_org_role(org_id, array['owner', 'admin', 'operator']));

-- Only owners and admins may destroy a group outright; operators archive.
drop policy if exists display_groups_delete_admin on public.display_groups;
create policy display_groups_delete_admin on public.display_groups
  for delete to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin']));

drop policy if exists display_group_members_select_member on public.display_group_members;
create policy display_group_members_select_member on public.display_group_members
  for select to authenticated using (private.is_org_member(org_id));

drop policy if exists display_group_members_write_operator_insert on public.display_group_members;
create policy display_group_members_write_operator_insert on public.display_group_members
  for insert to authenticated
  with check (private.has_org_role(org_id, array['owner', 'admin', 'operator']));

drop policy if exists display_group_members_write_operator_update on public.display_group_members;
create policy display_group_members_write_operator_update on public.display_group_members
  for update to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin', 'operator']))
  with check (private.has_org_role(org_id, array['owner', 'admin', 'operator']));

drop policy if exists display_group_members_write_operator_delete on public.display_group_members;
create policy display_group_members_write_operator_delete on public.display_group_members
  for delete to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin', 'operator']));

drop trigger if exists display_groups_set_updated_at on public.display_groups;
create trigger display_groups_set_updated_at
  before update on public.display_groups
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.display_groups        to authenticated;
grant select, insert, update, delete on public.display_group_members to authenticated;
grant select on public.display_group_health to authenticated;

commit;
