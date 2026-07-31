-- Scena Session Groups (Max plan).
--
-- SOP Purpose §6.3 grants Session Groups to Max only. SOP Purpose §6.4 is
-- explicit: "Session Groups do not provide additional concurrent-Session
-- capacity." SOP Roadmap §7 Stage 2 caps a group at three Sessions and twelve
-- Displays, with defined partial-failure behaviour.
--
-- Design decisions recorded in docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md:
--   * Group start is a LOOP over public.session_transition(), never a bulk
--     UPDATE. Every per-Session gate -- readiness, concurrency, role, per-Session
--     Display cap -- therefore still fires. A group cannot become a way around
--     the plan.
--   * Partial failure is the defined behaviour, not an error: the command
--     returns a per-Session outcome so the operator sees exactly what started
--     and what did not, and the timeline records both.

begin;

create table if not exists public.session_groups (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null check (length(btrim(name)) > 0 and length(name) <= 120),
  description  text check (description is null or length(description) <= 1000),
  status       text not null default 'active' check (status in ('active', 'archived')),
  created_by   uuid default auth.uid(),
  updated_by   uuid,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint session_groups_archive_shape_check
    check ((status = 'archived' and archived_at is not null)
        or (status = 'active' and archived_at is null))
);

create unique index if not exists session_groups_org_name_active_idx
  on public.session_groups (org_id, lower(name)) where status = 'active';
create index if not exists session_groups_org_status_idx
  on public.session_groups (org_id, status, created_at desc);

create table if not exists public.session_group_members (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.session_groups(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  session_id   uuid not null references public.display_sessions(id) on delete cascade,
  member_order integer not null default 0 check (member_order >= 0),
  added_by     uuid default auth.uid(),
  added_at     timestamptz not null default now(),
  constraint session_group_members_unique unique (group_id, session_id)
);

create index if not exists session_group_members_group_order_idx
  on public.session_group_members (group_id, member_order);
create index if not exists session_group_members_session_idx
  on public.session_group_members (session_id);
create index if not exists session_group_members_org_idx
  on public.session_group_members (org_id);

-- ---------------------------------------------------------------------------
-- Entitlement and integrity enforcement
-- ---------------------------------------------------------------------------

create or replace function public.enforce_session_group_entitlement()
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
  if ent.org_id is null or not ent.allow_session_groups then
    raise exception 'Session Groups are available on the Max plan'
      using errcode = '42501', hint = 'entitlement_session_groups';
  end if;

  if new.status = 'active' then
    perform pg_advisory_xact_lock(hashtextextended('session_groups:' || new.org_id::text, 0));
    select count(*) into group_count
      from public.session_groups g
     where g.org_id = new.org_id and g.status = 'active' and g.id <> new.id;

    if group_count >= ent.max_session_groups then
      raise exception 'This plan allows % Session Group(s)', ent.max_session_groups
        using errcode = '23514', hint = 'entitlement_session_group_limit';
    end if;
  end if;

  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists session_groups_enforce_entitlement on public.session_groups;
create trigger session_groups_enforce_entitlement
  before insert or update on public.session_groups
  for each row execute function public.enforce_session_group_entitlement();

create or replace function public.enforce_session_group_membership()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  ent          private.effective_entitlement;
  grp          public.session_groups;
  member_count integer;
  display_total integer;
  session_org  uuid;
  session_displays integer;
begin
  select * into grp from public.session_groups g where g.id = new.group_id;
  if not found then
    raise exception 'Session Group not found' using errcode = 'P0002';
  end if;
  if grp.org_id <> new.org_id then
    raise exception 'Session Group belongs to a different Workspace' using errcode = '42501';
  end if;
  if grp.status <> 'active' then
    raise exception 'Sessions cannot be added to an archived Session Group';
  end if;

  ent := private.effective_entitlements(new.org_id);
  if ent.org_id is null or not ent.allow_session_groups then
    raise exception 'Session Groups are available on the Max plan'
      using errcode = '42501', hint = 'entitlement_session_groups';
  end if;

  select ds.org_id into session_org
    from public.display_sessions ds where ds.id = new.session_id;
  if session_org is distinct from new.org_id then
    raise exception 'That Session does not belong to this Workspace' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('session_group_members:' || new.group_id::text, 0));

  select count(*) into member_count
    from public.session_group_members m
   where m.group_id = new.group_id and m.id <> new.id;

  if member_count >= ent.max_sessions_per_session_group then
    raise exception 'A Session Group holds at most % Session(s)', ent.max_sessions_per_session_group
      using errcode = '23514', hint = 'entitlement_session_group_size';
  end if;

  -- Twelve-Display ceiling across the whole group (SOP Roadmap §7 Stage 2).
  select count(*) into display_total
    from public.session_group_members m
    join public.display_session_screens dss
      on dss.session_id = m.session_id and dss.assignment_status <> 'removed'
   where m.group_id = new.group_id and m.id <> new.id;

  select count(*) into session_displays
    from public.display_session_screens dss
   where dss.session_id = new.session_id and dss.assignment_status <> 'removed';

  if display_total + session_displays > ent.max_displays_per_session_group then
    raise exception 'A Session Group covers at most % Display(s)', ent.max_displays_per_session_group
      using errcode = '23514', hint = 'entitlement_session_group_displays';
  end if;

  return new;
end;
$$;

drop trigger if exists session_group_members_enforce on public.session_group_members;
create trigger session_group_members_enforce
  before insert or update on public.session_group_members
  for each row execute function public.enforce_session_group_membership();

-- ---------------------------------------------------------------------------
-- Group commands
-- ---------------------------------------------------------------------------

-- Returns one row per member Session so partial failure is visible rather than
-- swallowed. Each member goes through public.session_transition(), so every
-- per-Session gate still applies -- a group can never exceed the plan.
create or replace function public.session_group_command(
  target_group_id uuid,
  command text
)
returns table (session_id uuid, session_name text, succeeded boolean, resulting_status text, message text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  grp        public.session_groups;
  member     record;
  target_state text;
  updated    public.display_sessions;
begin
  select * into grp from public.session_groups g where g.id = target_group_id;
  if not found then
    raise exception 'Session Group not found' using errcode = 'P0002';
  end if;

  if not private.has_org_role(grp.org_id, array['owner', 'admin', 'operator']) then
    raise exception 'You do not have permission to control this Session Group'
      using errcode = '42501';
  end if;

  target_state := case command
    when 'start'  then 'starting'
    when 'pause'  then 'paused'
    when 'resume' then 'active'
    when 'stop'   then 'stopping'
    else null
  end;

  if target_state is null then
    raise exception 'Unsupported Session Group command: %', command using errcode = '22023';
  end if;

  for member in
    select m.session_id, ds.name
      from public.session_group_members m
      join public.display_sessions ds on ds.id = m.session_id
     where m.group_id = target_group_id
     order by m.member_order, ds.name
  loop
    begin
      updated := public.session_transition(member.session_id, target_state);
      perform private.emit_session_event(
        grp.org_id, member.session_id,
        case when command = 'stop' then 'group.session_stopped' else 'group.session_started' end,
        null, null, 'manager_ui', null, 'session_group', target_group_id,
        jsonb_build_object('command', command, 'group_name', grp.name));

      session_id := member.session_id;
      session_name := member.name;
      succeeded := true;
      resulting_status := updated.status;
      message := format('%s succeeded.', command);
      return next;
    exception when others then
      -- Partial failure is defined behaviour: report it, do not abort the group.
      session_id := member.session_id;
      session_name := member.name;
      succeeded := false;
      resulting_status := (select ds.status from public.display_sessions ds where ds.id = member.session_id);
      message := left(sqlerrm, 300);
      return next;
    end;
  end loop;
end;
$$;

revoke all on function public.session_group_command(uuid, text) from public, anon;
grant execute on function public.session_group_command(uuid, text) to authenticated;

comment on function public.session_group_command(uuid, text) is
  'Runs a lifecycle command across a Session Group member by member. Returns per-Session outcomes; partial failure is expected and reported, never hidden.';

-- Preview of what a group command would touch, so the operator sees the blast
-- radius before committing to it.
create or replace view public.session_group_health
with (security_invoker = true)
as
  select
    g.id as group_id,
    g.org_id,
    g.name,
    g.status,
    count(distinct m.session_id)                                        as sessions_total,
    count(distinct m.session_id) filter (
      where private.session_state_holds_displays(ds.status))             as sessions_live,
    count(distinct dss.screen_id) filter (
      where dss.assignment_status <> 'removed')                          as displays_total,
    count(distinct dh.screen_id) filter (where dh.connection_state = 'online') as displays_online,
    case
      when count(distinct m.session_id) = 0                              then 'unknown'
      when count(distinct m.session_id) filter (
             where private.session_state_holds_displays(ds.status)) = 0  then 'stopped'
      when count(distinct m.session_id) filter (where ds.status in ('degraded', 'failed')) > 0
                                                                         then 'degraded'
      when count(distinct m.session_id) filter (
             where private.session_state_holds_displays(ds.status))
           = count(distinct m.session_id)                                then 'live'
      else 'partial'
    end                                                                  as group_state
  from public.session_groups g
  left join public.session_group_members m on m.group_id = g.id
  left join public.display_sessions ds on ds.id = m.session_id
  left join public.display_session_screens dss
    on dss.session_id = m.session_id and dss.assignment_status <> 'removed'
  left join public.display_health dh on dh.screen_id = dss.screen_id
  group by g.id, g.org_id, g.name, g.status;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.session_groups enable row level security;
alter table public.session_group_members enable row level security;

drop policy if exists session_groups_select_member on public.session_groups;
create policy session_groups_select_member on public.session_groups
  for select to authenticated using (private.is_org_member(org_id));

drop policy if exists session_groups_insert_operator on public.session_groups;
create policy session_groups_insert_operator on public.session_groups
  for insert to authenticated
  with check (private.has_org_role(org_id, array['owner', 'admin', 'operator']));

drop policy if exists session_groups_update_operator on public.session_groups;
create policy session_groups_update_operator on public.session_groups
  for update to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin', 'operator']))
  with check (private.has_org_role(org_id, array['owner', 'admin', 'operator']));

drop policy if exists session_groups_delete_admin on public.session_groups;
create policy session_groups_delete_admin on public.session_groups
  for delete to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin']));

drop policy if exists session_group_members_select_member on public.session_group_members;
create policy session_group_members_select_member on public.session_group_members
  for select to authenticated using (private.is_org_member(org_id));

drop policy if exists session_group_members_insert_operator on public.session_group_members;
create policy session_group_members_insert_operator on public.session_group_members
  for insert to authenticated
  with check (private.has_org_role(org_id, array['owner', 'admin', 'operator']));

drop policy if exists session_group_members_update_operator on public.session_group_members;
create policy session_group_members_update_operator on public.session_group_members
  for update to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin', 'operator']))
  with check (private.has_org_role(org_id, array['owner', 'admin', 'operator']));

drop policy if exists session_group_members_delete_operator on public.session_group_members;
create policy session_group_members_delete_operator on public.session_group_members
  for delete to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin', 'operator']));

drop trigger if exists session_groups_set_updated_at on public.session_groups;
create trigger session_groups_set_updated_at
  before update on public.session_groups
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.session_groups        to authenticated;
grant select, insert, update, delete on public.session_group_members to authenticated;
grant select on public.session_group_health to authenticated;

commit;
