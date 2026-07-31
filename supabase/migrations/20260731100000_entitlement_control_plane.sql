-- Scena entitlement control plane.
--
-- Establishes four distinct authorities that were previously conflated in the
-- single `organization_entitlements` table:
--
--   1. plans                        -- commercial catalogue (Stripe wiring)
--   2. plan_entitlements            -- DESIGNED capability of each plan (SOP §6 as data)
--   3. organization_entitlements    -- plan-derived baseline for one Workspace
--   4. workspace_limits_overrides   -- approved, raise-only numeric deviations
--
--   private.effective_entitlements(org_id) resolves 3 + 4 into the single
--   authority every server-side check must consult.
--
-- Design decisions recorded in docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md:
--   * organization_entitlements is a DERIVED PROJECTION of plan_entitlements.
--     A trigger overwrites every capability column on write, so a Workspace row
--     can never drift from its plan. The pre-existing plan_shape_check stays in
--     place as defence in depth.
--   * Overrides may only RAISE numeric limits. They may never grant a gated
--     capability (Display Groups, Session Groups, resource ACL, templates,
--     automation tier) -- otherwise Max features could be handed out without a
--     Max subscription, which SOP Roadmap §3.1 forbids.
--   * Usage is a VIEW, not a counter table. Counter tables drift; at Scena's
--     data volume a view cannot. See workspace_usage_current below.

begin;

-- ---------------------------------------------------------------------------
-- 1. Designed plan capability matrix
-- ---------------------------------------------------------------------------

create table if not exists public.plan_entitlements (
  plan_code                     text primary key
    check (plan_code in ('personal_free', 'plus', 'pro', 'max')),

  -- Core capacity (SOP Purpose §5-§6)
  max_displays                  integer not null check (max_displays > 0),
  max_boards                    integer not null check (max_boards > 0),
  max_members                   integer not null check (max_members > 0),
  max_concurrent_sessions       integer not null check (max_concurrent_sessions > 0),
  max_displays_per_session      integer not null default 4
    check (max_displays_per_session = 4),          -- SOP Purpose §6.4, universal
  max_asset_uploads_per_month   integer
    check (max_asset_uploads_per_month is null or max_asset_uploads_per_month > 0),

  -- Automation (SOP Purpose §6, Roadmap §7 Stage 2)
  automation_tier               text not null default 'none'
    check (automation_tier in ('none', 'basic', 'advanced')),

  -- Gated capabilities. NEVER grantable through an override.
  allow_display_groups          boolean not null default false,
  allow_session_groups          boolean not null default false,
  allow_resource_access_controls boolean not null default false,
  allow_session_templates       boolean not null default false,
  allow_operational_notifications boolean not null default false,

  -- Group shape (SOP Roadmap §7 Stage 2)
  max_display_groups            integer not null default 0 check (max_display_groups >= 0),
  max_displays_per_display_group integer not null default 4
    check (max_displays_per_display_group between 1 and 4),
  max_session_groups            integer not null default 0 check (max_session_groups >= 0),
  max_sessions_per_session_group integer not null default 3
    check (max_sessions_per_session_group between 1 and 3),
  max_displays_per_session_group integer not null default 12
    check (max_displays_per_session_group between 1 and 12),

  -- Retention for the health/history surfaces introduced by this program.
  health_retention_days         integer not null default 7 check (health_retention_days > 0),
  history_retention_days        integer not null default 30 check (history_retention_days > 0),

  -- Commercial availability is a PRODUCT decision, separate from plan design.
  -- SOP Roadmap §6: "A Stripe price existing in the database does not prove the
  -- plan is ready to sell."
  availability                  text not null default 'unavailable'
    check (availability in ('generally_available', 'limited', 'pilot', 'waitlist', 'unavailable')),
  availability_note             text,

  updated_at                    timestamptz not null default now(),

  -- Capability/tier coherence: a plan that grants groups must grant capacity
  -- for at least one group, and vice versa.
  constraint plan_entitlements_display_group_shape
    check ((allow_display_groups and max_display_groups > 0)
        or ((not allow_display_groups) and max_display_groups = 0)),
  constraint plan_entitlements_session_group_shape
    check ((allow_session_groups and max_session_groups > 0)
        or ((not allow_session_groups) and max_session_groups = 0))
);

comment on table public.plan_entitlements is
  'Designed capability of each Scena plan. Authoritative source for organization_entitlements. Edited only through a migration.';
comment on column public.plan_entitlements.availability is
  'Commercial availability, independent of implementation. Max stays non-sellable until SOP Roadmap Stage 2 exit conditions are met.';

-- SOP Purpose §5.1, §6.1-§6.4 verbatim.
insert into public.plan_entitlements (
  plan_code, max_displays, max_boards, max_members, max_concurrent_sessions,
  max_asset_uploads_per_month, automation_tier,
  allow_display_groups, allow_session_groups, allow_resource_access_controls,
  allow_session_templates, allow_operational_notifications,
  max_display_groups, max_session_groups,
  health_retention_days, history_retention_days,
  availability, availability_note
) values
  ('personal_free', 2,  5,  1,  1, 5,    'none',     false, false, false, false, false, 0, 0,  7,  30,
   'generally_available', 'Free Personal Workspace granted to every authenticated account.'),
  ('plus',          2,  10, 5,  1, null, 'none',     false, false, false, false, false, 0, 0,  14, 60,
   'limited', 'Sellable once Plus Checkout, Team provisioning and one concurrent Session are verified end to end.'),
  ('pro',           5,  30, 10, 2, null, 'basic',    false, false, false, true,  false, 0, 0,  30, 90,
   'limited', 'Sellable once Plus is stable and daily/weekly automation executes reliably.'),
  ('max',           15, 50, 25, 4, null, 'advanced', true,  true,  true,  true,  true,  8, 4,  90, 365,
   'unavailable', 'SOP Roadmap §6 and §17: Max stays unavailable until Display Groups, Session Groups, advanced automation and resource ACL are complete AND Stage 2 entry conditions are met.')
on conflict (plan_code) do nothing;

alter table public.plan_entitlements enable row level security;

-- The plan matrix is public product information; every authenticated user may
-- read it to render an honest plan comparison. Nobody may write it from the API.
drop policy if exists plan_entitlements_select_authenticated on public.plan_entitlements;
create policy plan_entitlements_select_authenticated
  on public.plan_entitlements for select to authenticated using (true);

drop trigger if exists plan_entitlements_set_updated_at on public.plan_entitlements;
create trigger plan_entitlements_set_updated_at
  before update on public.plan_entitlements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Extend the per-Workspace baseline with the new dimensions
-- ---------------------------------------------------------------------------

alter table public.organization_entitlements
  add column if not exists allow_session_templates        boolean not null default false,
  add column if not exists allow_operational_notifications boolean not null default false,
  add column if not exists max_display_groups             integer not null default 0,
  add column if not exists max_displays_per_display_group integer not null default 4,
  add column if not exists max_session_groups             integer not null default 0,
  add column if not exists max_sessions_per_session_group integer not null default 3,
  add column if not exists max_displays_per_session_group integer not null default 12,
  add column if not exists health_retention_days          integer not null default 7,
  add column if not exists history_retention_days         integer not null default 30;

-- organization_entitlements is a projection of plan_entitlements. This trigger
-- makes drift structurally impossible: every capability column is overwritten
-- from the plan on every insert and update, whatever the caller supplied.
create or replace function private.project_plan_entitlements()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  plan public.plan_entitlements%rowtype;
begin
  select * into plan from public.plan_entitlements pe where pe.plan_code = new.plan_code;
  if not found then
    raise exception 'Unknown plan code %', new.plan_code
      using errcode = '23514';
  end if;

  new.max_displays                    := plan.max_displays;
  new.max_boards                      := plan.max_boards;
  new.max_members                     := plan.max_members;
  new.max_concurrent_sessions         := plan.max_concurrent_sessions;
  new.max_displays_per_session        := plan.max_displays_per_session;
  new.max_asset_uploads_per_month     := plan.max_asset_uploads_per_month;
  new.automation_tier                 := plan.automation_tier;
  new.allow_display_groups            := plan.allow_display_groups;
  new.allow_session_groups            := plan.allow_session_groups;
  new.allow_resource_access_controls  := plan.allow_resource_access_controls;
  new.allow_session_templates         := plan.allow_session_templates;
  new.allow_operational_notifications := plan.allow_operational_notifications;
  new.max_display_groups              := plan.max_display_groups;
  new.max_displays_per_display_group  := plan.max_displays_per_display_group;
  new.max_session_groups              := plan.max_session_groups;
  new.max_sessions_per_session_group  := plan.max_sessions_per_session_group;
  new.max_displays_per_session_group  := plan.max_displays_per_session_group;
  new.health_retention_days           := plan.health_retention_days;
  new.history_retention_days          := plan.history_retention_days;
  new.updated_at                      := now();

  return new;
end;
$$;

revoke all on function private.project_plan_entitlements() from public, anon, authenticated;

drop trigger if exists organization_entitlements_project_plan on public.organization_entitlements;
create trigger organization_entitlements_project_plan
  before insert or update on public.organization_entitlements
  for each row execute function private.project_plan_entitlements();

-- ---------------------------------------------------------------------------
-- 3. Approved, raise-only numeric overrides
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_limits_overrides (
  org_id                       uuid primary key
    references public.organizations(id) on delete cascade,
  max_displays                 integer check (max_displays > 0),
  max_boards                   integer check (max_boards > 0),
  max_members                  integer check (max_members > 0),
  max_concurrent_sessions      integer check (max_concurrent_sessions > 0),
  max_asset_uploads_per_month  integer check (max_asset_uploads_per_month > 0),
  reason                       text not null check (length(btrim(reason)) > 0),
  approved_by                  uuid references auth.users(id) on delete set null,
  approved_at                  timestamptz not null default now(),
  expires_at                   timestamptz,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  constraint workspace_limits_overrides_expiry_check
    check (expires_at is null or expires_at > approved_at),
  -- An override that changes nothing is a mistake, not a no-op record.
  constraint workspace_limits_overrides_not_empty check (
    max_displays is not null or max_boards is not null or max_members is not null
    or max_concurrent_sessions is not null or max_asset_uploads_per_month is not null
  )
);

comment on table public.workspace_limits_overrides is
  'Approved raise-only numeric limit deviations. Cannot grant gated capabilities: see private.effective_entitlements.';

-- max_displays_per_session is deliberately absent: SOP Purpose §6.4 makes the
-- four-Display Session cap universal and non-negotiable across every plan.

create or replace function private.enforce_override_is_raise_only()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  base public.organization_entitlements%rowtype;
begin
  select * into base from public.organization_entitlements oe where oe.org_id = new.org_id;
  if not found then
    raise exception 'Cannot override limits for a Workspace with no entitlement record';
  end if;

  if new.max_displays is not null and new.max_displays < base.max_displays then
    raise exception 'A limit override may only raise max_displays (plan grants %)', base.max_displays;
  end if;
  if new.max_boards is not null and new.max_boards < base.max_boards then
    raise exception 'A limit override may only raise max_boards (plan grants %)', base.max_boards;
  end if;
  if new.max_members is not null and new.max_members < base.max_members then
    raise exception 'A limit override may only raise max_members (plan grants %)', base.max_members;
  end if;
  if new.max_concurrent_sessions is not null
     and new.max_concurrent_sessions < base.max_concurrent_sessions then
    raise exception 'A limit override may only raise max_concurrent_sessions (plan grants %)',
      base.max_concurrent_sessions;
  end if;
  -- A null plan value means unlimited; an override cannot improve on that.
  if new.max_asset_uploads_per_month is not null
     and base.max_asset_uploads_per_month is null then
    raise exception 'This plan already grants unlimited monthly Asset uploads';
  end if;
  if new.max_asset_uploads_per_month is not null
     and new.max_asset_uploads_per_month < base.max_asset_uploads_per_month then
    raise exception 'A limit override may only raise max_asset_uploads_per_month (plan grants %)',
      base.max_asset_uploads_per_month;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.enforce_override_is_raise_only() from public, anon, authenticated;

drop trigger if exists workspace_limits_overrides_raise_only on public.workspace_limits_overrides;
create trigger workspace_limits_overrides_raise_only
  before insert or update on public.workspace_limits_overrides
  for each row execute function private.enforce_override_is_raise_only();

alter table public.workspace_limits_overrides enable row level security;

-- Members may see that their Workspace has an approved override and why.
-- Nobody may create or change one from the API: overrides are a migration or
-- service-role operation with a recorded approver.
drop policy if exists workspace_limits_overrides_select_member on public.workspace_limits_overrides;
create policy workspace_limits_overrides_select_member
  on public.workspace_limits_overrides for select to authenticated
  using (private.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- 4. Entitlement change audit
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_entitlement_snapshots (
  id             bigint generated always as identity primary key,
  org_id         uuid not null references public.organizations(id) on delete cascade,
  plan_code      text not null,
  entitlements   jsonb not null,
  changed_by     uuid,
  recorded_at    timestamptz not null default now()
);

comment on table public.workspace_entitlement_snapshots is
  'Append-only record of what entitlements were in effect for a Workspace and when.';

create index if not exists workspace_entitlement_snapshots_org_time_idx
  on public.workspace_entitlement_snapshots (org_id, recorded_at desc);

create or replace function private.record_entitlement_snapshot()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;
  insert into public.workspace_entitlement_snapshots (org_id, plan_code, entitlements, changed_by)
  values (new.org_id, new.plan_code, to_jsonb(new), auth.uid());
  return new;
end;
$$;

revoke all on function private.record_entitlement_snapshot() from public, anon, authenticated;

drop trigger if exists organization_entitlements_snapshot on public.organization_entitlements;
create trigger organization_entitlements_snapshot
  after insert or update on public.organization_entitlements
  for each row execute function private.record_entitlement_snapshot();

alter table public.workspace_entitlement_snapshots enable row level security;

drop policy if exists workspace_entitlement_snapshots_select_manager
  on public.workspace_entitlement_snapshots;
create policy workspace_entitlement_snapshots_select_manager
  on public.workspace_entitlement_snapshots for select to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin']));

-- Re-project every existing Workspace so the new columns hold real plan values
-- rather than column defaults. Runs after the snapshot trigger exists so the
-- audit trail starts with a correct baseline for every live Workspace.
update public.organization_entitlements set plan_code = plan_code;

-- ---------------------------------------------------------------------------
-- 5. The single effective-entitlement authority
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'private' and t.typname = 'effective_entitlement'
  ) then
    create type private.effective_entitlement as (
  org_id                          uuid,
  plan_code                       text,
  max_displays                    integer,
  max_boards                      integer,
  max_members                     integer,
  max_concurrent_sessions         integer,
  max_displays_per_session        integer,
  max_asset_uploads_per_month     integer,
  automation_tier                 text,
  allow_display_groups            boolean,
  allow_session_groups            boolean,
  allow_resource_access_controls  boolean,
  allow_session_templates         boolean,
  allow_operational_notifications boolean,
  max_display_groups              integer,
  max_displays_per_display_group  integer,
  max_session_groups              integer,
  max_sessions_per_session_group  integer,
  max_displays_per_session_group  integer,
  health_retention_days           integer,
  history_retention_days          integer,
  has_override                    boolean
);
  end if;
end;
$$;

-- Every server-side capacity or capability check MUST read this function.
-- Reading organization_entitlements directly bypasses approved overrides.
create or replace function private.effective_entitlements(target_org_id uuid)
returns private.effective_entitlement
language sql
stable
security definer
set search_path to ''
as $$
  select row(
    oe.org_id,
    oe.plan_code,
    greatest(oe.max_displays,            coalesce(ov.max_displays,            oe.max_displays)),
    greatest(oe.max_boards,              coalesce(ov.max_boards,              oe.max_boards)),
    greatest(oe.max_members,             coalesce(ov.max_members,             oe.max_members)),
    greatest(oe.max_concurrent_sessions, coalesce(ov.max_concurrent_sessions, oe.max_concurrent_sessions)),
    oe.max_displays_per_session,   -- universal cap, never overridable
    case
      when oe.max_asset_uploads_per_month is null then null
      else greatest(oe.max_asset_uploads_per_month,
                    coalesce(ov.max_asset_uploads_per_month, oe.max_asset_uploads_per_month))
    end,
    -- Capabilities come from the plan alone. An override can never grant them.
    oe.automation_tier,
    oe.allow_display_groups,
    oe.allow_session_groups,
    oe.allow_resource_access_controls,
    oe.allow_session_templates,
    oe.allow_operational_notifications,
    oe.max_display_groups,
    oe.max_displays_per_display_group,
    oe.max_session_groups,
    oe.max_sessions_per_session_group,
    oe.max_displays_per_session_group,
    oe.health_retention_days,
    oe.history_retention_days,
    (ov.org_id is not null)
  )::private.effective_entitlement
  from public.organization_entitlements oe
  left join public.workspace_limits_overrides ov
    on ov.org_id = oe.org_id
   and (ov.expires_at is null or ov.expires_at > now())
  where oe.org_id = target_org_id
    -- Authorisation guard. The function is SECURITY DEFINER and executable by
    -- `authenticated`, so it must not become an entitlement oracle for other
    -- Workspaces. Three callers, all correct:
    --   * a trigger fired by an authenticated member  -> auth.uid() set, member
    --   * a service-role Edge Function or the scheduler -> auth.uid() null
    --   * an authenticated user probing a foreign org  -> no row returned
    and ((select auth.uid()) is null or private.is_org_member(target_org_id));
$$;

revoke all on function private.effective_entitlements(uuid) from public, anon;
comment on function private.effective_entitlements(uuid) is
  'Plan baseline merged with any live approved raise-only override. The only authority for capacity and capability checks.';

-- Read-only projection so the manager UI can render the same numbers the
-- database enforces, without reimplementing the merge in TypeScript.
create or replace view public.workspace_effective_entitlements
with (security_invoker = true)
as
  select (private.effective_entitlements(oe.org_id)).*
    from public.organization_entitlements oe
   where private.is_org_member(oe.org_id);

comment on view public.workspace_effective_entitlements is
  'Effective entitlements for every Workspace the caller belongs to. Mirrors what the database enforces.';

-- ---------------------------------------------------------------------------
-- 6. Live usage, computed rather than counted
-- ---------------------------------------------------------------------------

create or replace view public.workspace_usage_current
with (security_invoker = true)
as
  select
    o.id as org_id,
    (select count(*) from public.screens s
      where s.org_id = o.id and s.status <> 'revoked')                     as displays_used,
    (select count(*) from public.boards b
      where b.workspace_id = o.id and b.status = 'active')                 as boards_used,
    (select count(*) from public.organization_members m
      where m.org_id = o.id and m.status = 'active')                       as members_used,
    (select count(*) from public.display_sessions ds
      where ds.org_id = o.id and ds.status = 'active')                     as active_sessions_used,
    (select count(*) from public.asset_upload_events ae
      where ae.workspace_id = o.id
        and ae.quota_month = date_trunc('month', now() at time zone 'utc')::date)
                                                                          as asset_uploads_this_month,
    date_trunc('month', now() at time zone 'utc')::date                    as quota_month
  from public.organizations o
  where private.is_org_member(o.id);

comment on view public.workspace_usage_current is
  'Live Workspace usage against plan limits. Computed, never stored -- a stored counter can drift, this cannot.';

-- ---------------------------------------------------------------------------
-- 7. Point existing quota enforcement at the effective authority
-- ---------------------------------------------------------------------------

create or replace function public.enforce_team_display_quota()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  ent private.effective_entitlement;
  display_count integer;
begin
  if new.org_id is null or new.status = 'revoked' then return new; end if;

  ent := private.effective_entitlements(new.org_id);
  if ent.org_id is null then
    raise exception 'This Workspace has reached its Display limit';
  end if;

  select count(*) into display_count
    from public.screens s
   where s.org_id = new.org_id and s.status <> 'revoked' and s.id <> new.id;

  if display_count >= ent.max_displays then
    raise exception 'This Workspace has reached its Display limit';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_team_concurrent_session_quota()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  ent private.effective_entitlement;
  active_count integer;
begin
  -- 'active' is the only state that consumes concurrent-Session capacity.
  -- Transitional states (starting/degraded/paused) are handled by the session
  -- lifecycle migration, which calls this same authority.
  if new.status <> 'active' or old.status = 'active' then return new; end if;

  ent := private.effective_entitlements(new.org_id);
  if ent.org_id is null then
    raise exception 'This Workspace has reached its concurrent Session limit';
  end if;

  select count(*) into active_count
    from public.display_sessions ds
   where ds.org_id = new.org_id and ds.status = 'active' and ds.id <> new.id;

  if active_count >= ent.max_concurrent_sessions then
    raise exception 'This Workspace has reached its concurrent Session limit';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_workspace_board_quota()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  ent private.effective_entitlement;
  board_count integer;
begin
  ent := private.effective_entitlements(new.workspace_id);
  if ent.org_id is null then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended('boards:' || new.workspace_id::text, 0));

  select count(*) into board_count
    from public.boards
   where workspace_id = new.workspace_id and status = 'active';

  if board_count >= ent.max_boards then
    raise exception 'workspace Board limit reached';
  end if;
  return new;
end;
$$;

-- The per-Session Display cap is universal; read it from the resolver so a
-- future plan change flows through one place.
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

    -- A screen has usable content if it carries its own Layout OR the Session
    -- carries a Board. Requiring a Layout unconditionally made the Board
    -- content model unusable in independent and single mode.
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
-- 8. Grants
-- ---------------------------------------------------------------------------

grant select on public.plan_entitlements                to authenticated;
grant select on public.workspace_limits_overrides       to authenticated;
grant select on public.workspace_entitlement_snapshots  to authenticated;
grant select on public.workspace_effective_entitlements to authenticated;
grant select on public.workspace_usage_current          to authenticated;
grant execute on function private.effective_entitlements(uuid) to authenticated;

commit;
