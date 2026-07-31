-- Scena resource-level access control (Max plan).
--
-- SOP Purpose §6.3 grants resource-level access control to Max only.
--
-- Design decisions recorded in docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md:
--
--   * Grants are ADDITIVE ONLY. A grant can raise a member's access to one
--     resource; it can never lower it below the access their Workspace role
--     already carries. SOP Purpose §9 defines what each role may do across the
--     Workspace, and a per-resource deny would silently contradict that. It
--     would also create lockouts with no safe recovery.
--   * Workspace Owners and Admins always resolve to 'owner' on every resource.
--     This is the recovery path required by SOP Purpose §9.1: an Owner can
--     never be locked out of their own Workspace by a grant someone else made.
--   * NO RECURSIVE RLS. private.resource_access_level() reads
--     organization_members and resource_grants only. resource_grants' own
--     policies use private.is_org_member / private.has_org_role -- never
--     resource_access_level -- so evaluation always terminates.
--   * The whole layer is inert unless the plan grants it. On Personal Free,
--     Plus and Pro the Workspace-role baseline is the entire answer, which is
--     exactly today's behaviour.

begin;

-- ---------------------------------------------------------------------------
-- 1. Ordered access levels
-- ---------------------------------------------------------------------------

create or replace function private.access_level_rank(level text)
returns integer
language sql
immutable
set search_path to ''
as $$
  select case level
    when 'viewer'   then 10
    when 'editor'   then 20
    when 'operator' then 30
    when 'manager'  then 40
    when 'owner'    then 50
    else 0
  end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Grants
-- ---------------------------------------------------------------------------

create table if not exists public.resource_grants (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  resource_type text not null,
  resource_id   uuid not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  access_level  text not null,
  granted_by    uuid references auth.users(id) on delete set null,
  granted_at    timestamptz not null default now(),
  expires_at    timestamptz,
  note          text check (note is null or length(note) <= 500),

  constraint resource_grants_resource_type_check check (resource_type in (
    'board', 'asset', 'display', 'session', 'display_group',
    'session_group', 'location', 'automation', 'session_template'
  )),
  constraint resource_grants_access_level_check check (access_level in (
    'viewer', 'editor', 'operator', 'manager', 'owner'
  )),
  constraint resource_grants_expiry_check check (expires_at is null or expires_at > granted_at),
  constraint resource_grants_unique unique (org_id, resource_type, resource_id, user_id)
);

comment on table public.resource_grants is
  'Additive per-resource access grants (Max). A grant may raise a member''s access to one resource; it can never lower it.';

-- Indexes chosen for the two hot paths: "what may this user reach" (the RLS
-- predicate) and "who may reach this resource" (the permissions panel).
create index if not exists resource_grants_lookup_idx
  on public.resource_grants (user_id, org_id, resource_type, resource_id);
create index if not exists resource_grants_resource_idx
  on public.resource_grants (org_id, resource_type, resource_id);
create index if not exists resource_grants_live_idx
  on public.resource_grants (org_id, user_id) where expires_at is null;

-- ---------------------------------------------------------------------------
-- 3. Role baseline (SOP Purpose §9)
-- ---------------------------------------------------------------------------

create or replace function private.role_baseline_access(member_role text, resource_type text)
returns text
language sql
immutable
set search_path to ''
as $$
  select case
    when member_role in ('owner', 'admin') then 'owner'
    when member_role = 'operator' then
      case when resource_type in ('display', 'session', 'display_group',
                                  'session_group', 'location', 'automation')
           then 'operator' else 'viewer' end
    when member_role = 'designer' then
      case when resource_type in ('board', 'asset', 'session_template')
           then 'editor' else 'viewer' end
    when member_role = 'viewer' then 'viewer'
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The resolver
-- ---------------------------------------------------------------------------

create or replace function private.resource_access_level(
  target_org_id uuid,
  target_resource_type text,
  target_resource_id uuid,
  target_user_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  uid           uuid := coalesce(target_user_id, (select auth.uid()));
  member_role   text;
  baseline      text;
  granted       text;
  acl_enabled   boolean;
begin
  if uid is null then
    return null;
  end if;

  select om.role into member_role
    from public.organization_members om
   where om.org_id = target_org_id and om.user_id = uid and om.status = 'active';

  if member_role is null then
    return null;   -- not a member: no Workspace, no grant, no access
  end if;

  baseline := private.role_baseline_access(member_role, target_resource_type);

  -- Owners and admins are never narrowed and never need a grant lookup.
  if member_role in ('owner', 'admin') then
    return 'owner';
  end if;

  select (private.effective_entitlements(target_org_id)).allow_resource_access_controls
    into acl_enabled;

  if not coalesce(acl_enabled, false) then
    return baseline;   -- plan does not include ACLs: role baseline is the answer
  end if;

  select rg.access_level into granted
    from public.resource_grants rg
   where rg.org_id = target_org_id
     and rg.resource_type = target_resource_type
     and rg.resource_id = target_resource_id
     and rg.user_id = uid
     and (rg.expires_at is null or rg.expires_at > now());

  -- Additive: whichever is higher wins.
  if granted is not null
     and private.access_level_rank(granted) > private.access_level_rank(coalesce(baseline, '')) then
    return granted;
  end if;

  return baseline;
end;
$$;

revoke all on function private.resource_access_level(uuid, text, uuid, uuid) from public, anon;
grant execute on function private.resource_access_level(uuid, text, uuid, uuid) to authenticated;

create or replace function private.can_access_resource(
  target_org_id uuid,
  target_resource_type text,
  target_resource_id uuid,
  required_level text
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.access_level_rank(
           private.resource_access_level(target_org_id, target_resource_type, target_resource_id)
         ) >= private.access_level_rank(required_level);
$$;

revoke all on function private.can_access_resource(uuid, text, uuid, text) from public, anon;
grant execute on function private.can_access_resource(uuid, text, uuid, text) to authenticated;

comment on function private.can_access_resource(uuid, text, uuid, text) is
  'Testable permission predicate. Used by RLS policies, Edge Functions and the domain layer so all three agree.';

-- Read-only projection of the caller''s own effective access, so the UI can
-- disable controls it knows will fail instead of rendering a control that
-- silently errors.
create or replace function public.my_resource_access(
  target_org_id uuid,
  target_resource_type text,
  target_resource_id uuid
)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select private.resource_access_level(target_org_id, target_resource_type, target_resource_id);
$$;

revoke all on function public.my_resource_access(uuid, text, uuid) from public, anon;
grant execute on function public.my_resource_access(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Grant integrity
-- ---------------------------------------------------------------------------

create or replace function public.enforce_resource_grant()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  ent           private.effective_entitlement;
  target_exists boolean;
begin
  ent := private.effective_entitlements(new.org_id);
  if ent.org_id is null or not ent.allow_resource_access_controls then
    raise exception 'Resource permissions are available on the Max plan'
      using errcode = '42501', hint = 'entitlement_resource_acl';
  end if;

  -- The grantee must already be a member of this Workspace. A grant is not a
  -- way to hand an outsider a door into the tenant.
  if not exists (select 1 from public.organization_members om
                  where om.org_id = new.org_id and om.user_id = new.user_id
                    and om.status = 'active') then
    raise exception 'That person is not an active member of this Workspace'
      using errcode = '42501';
  end if;

  -- The resource must live in this Workspace. Cross-Workspace references are
  -- rejected for every supported resource type.
  target_exists := case new.resource_type
    when 'board'            then exists (select 1 from public.boards t
                                          where t.id = new.resource_id and t.workspace_id = new.org_id)
    when 'asset'            then exists (select 1 from public.assets t
                                          where t.id = new.resource_id and t.workspace_id = new.org_id)
    when 'display'          then exists (select 1 from public.screens t
                                          where t.id = new.resource_id and t.org_id = new.org_id)
    when 'session'          then exists (select 1 from public.display_sessions t
                                          where t.id = new.resource_id and t.org_id = new.org_id)
    when 'display_group'    then exists (select 1 from public.display_groups t
                                          where t.id = new.resource_id and t.org_id = new.org_id)
    when 'session_group'    then exists (select 1 from public.session_groups t
                                          where t.id = new.resource_id and t.org_id = new.org_id)
    when 'location'         then exists (select 1 from public.locations t
                                          where t.id = new.resource_id and t.org_id = new.org_id)
    when 'automation'       then exists (select 1 from public.display_automations t
                                          where t.id = new.resource_id and t.org_id = new.org_id)
    when 'session_template' then true   -- validated by FK once templates exist
    else false
  end;

  if not target_exists then
    raise exception 'That resource does not belong to this Workspace' using errcode = '42501';
  end if;

  -- Only Owners and Admins may hand out access.
  if not private.has_org_role(new.org_id, array['owner', 'admin']) then
    raise exception 'Only Workspace Owners and Admins can change resource permissions'
      using errcode = '42501';
  end if;

  new.granted_by := coalesce(new.granted_by, (select auth.uid()));
  return new;
end;
$$;

drop trigger if exists resource_grants_enforce on public.resource_grants;
create trigger resource_grants_enforce
  before insert or update on public.resource_grants
  for each row execute function public.enforce_resource_grant();

-- ---------------------------------------------------------------------------
-- 6. RLS on the grants themselves (deliberately NOT self-referential)
-- ---------------------------------------------------------------------------

alter table public.resource_grants enable row level security;

-- A member sees grants that concern them; owners and admins see all of them.
drop policy if exists resource_grants_select on public.resource_grants;
create policy resource_grants_select on public.resource_grants
  for select to authenticated
  using (
    private.has_org_role(org_id, array['owner', 'admin'])
    or (private.is_org_member(org_id) and user_id = (select auth.uid()))
  );

drop policy if exists resource_grants_insert_admin on public.resource_grants;
create policy resource_grants_insert_admin on public.resource_grants
  for insert to authenticated
  with check (private.has_org_role(org_id, array['owner', 'admin']));

drop policy if exists resource_grants_update_admin on public.resource_grants;
create policy resource_grants_update_admin on public.resource_grants
  for update to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin']))
  with check (private.has_org_role(org_id, array['owner', 'admin']));

drop policy if exists resource_grants_delete_admin on public.resource_grants;
create policy resource_grants_delete_admin on public.resource_grants
  for delete to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- 7. First enforcement surface: Sessions
-- ---------------------------------------------------------------------------

-- Additive policies. The existing role-based policies are untouched, so nobody
-- loses access; these grant the extra reach an explicit grant is supposed to
-- confer -- for example a Designer given operator access to one Session.
drop policy if exists display_sessions_select_granted on public.display_sessions;
create policy display_sessions_select_granted on public.display_sessions
  for select to authenticated
  using (private.can_access_resource(org_id, 'session', id, 'viewer'));

drop policy if exists display_sessions_update_granted on public.display_sessions;
create policy display_sessions_update_granted on public.display_sessions
  for update to authenticated
  using (private.can_access_resource(org_id, 'session', id, 'operator'))
  with check (private.can_access_resource(org_id, 'session', id, 'operator'));

grant select, insert, update, delete on public.resource_grants to authenticated;

commit;
