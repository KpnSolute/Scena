-- Scena Session templates and duplication.
--
-- Design decisions recorded in docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md:
--   * A template stores SCREEN SLOTS, not Display IDs. Baking a device into a
--     template means instantiating it later either fails (the Display was
--     revoked) or silently seizes a Display that is showing something else.
--     A slot describes the role -- order, primary, viewport, rotation, content --
--     and the operator binds a real Display at instantiation time.
--   * Templates never cross a Workspace boundary. There is no approved copy or
--     transfer product behaviour (SOP Purpose §8), so instantiation validates
--     that every referenced Board and Layout belongs to the target Workspace.
--   * Instantiation always produces a DRAFT. A template cannot start a Session;
--     readiness still has to be proven.

begin;

create table if not exists public.session_templates (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  name              text not null check (length(btrim(name)) > 0 and length(name) <= 120),
  description       text check (description is null or length(description) <= 1000),
  display_mode      text not null default 'independent'
    check (display_mode in ('independent', 'duplicate', 'extend', 'single')),
  board_id          uuid references public.boards(id) on delete set null,
  shared_layout_id  uuid references public.display_layouts(id) on delete set null,
  fallback_policy   text not null default 'last_valid_content'
    check (fallback_policy in ('last_valid_content', 'blank', 'fallback_board')),
  fallback_board_id uuid references public.boards(id) on delete set null,
  settings          jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  version           integer not null default 1 check (version > 0),
  status            text not null default 'active' check (status in ('active', 'archived')),
  source_session_id uuid references public.display_sessions(id) on delete set null,
  created_by        uuid default auth.uid(),
  updated_by        uuid,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint session_templates_shared_layout_shape_check
    check ((display_mode in ('duplicate', 'extend') and shared_layout_id is not null)
        or (display_mode in ('independent', 'single') and shared_layout_id is null)),
  constraint session_templates_fallback_shape_check
    check ((fallback_policy = 'fallback_board' and fallback_board_id is not null)
        or (fallback_policy <> 'fallback_board' and fallback_board_id is null)),
  constraint session_templates_archive_shape_check
    check ((status = 'archived' and archived_at is not null)
        or (status = 'active' and archived_at is null))
);

create unique index if not exists session_templates_org_name_active_idx
  on public.session_templates (org_id, lower(name)) where status = 'active';
create index if not exists session_templates_org_status_idx
  on public.session_templates (org_id, status, updated_at desc);

create table if not exists public.session_template_slots (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.session_templates(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  slot_order    integer not null default 0 check (slot_order >= 0),
  slot_label    text check (slot_label is null or length(slot_label) <= 80),
  layout_id     uuid references public.display_layouts(id) on delete set null,
  is_primary    boolean not null default false,
  is_enabled    boolean not null default true,
  rotation_degrees integer not null default 0 check (rotation_degrees in (0, 90, 180, 270)),
  viewport_x_percent      numeric not null default 0   check (viewport_x_percent between 0 and 100),
  viewport_y_percent      numeric not null default 0   check (viewport_y_percent between 0 and 100),
  viewport_width_percent  numeric not null default 100 check (viewport_width_percent > 0 and viewport_width_percent <= 100),
  viewport_height_percent numeric not null default 100 check (viewport_height_percent > 0 and viewport_height_percent <= 100),
  created_at    timestamptz not null default now(),
  constraint session_template_slots_order_unique unique (template_id, slot_order),
  constraint session_template_slots_x_extent_check
    check (viewport_x_percent + viewport_width_percent <= 100),
  constraint session_template_slots_y_extent_check
    check (viewport_y_percent + viewport_height_percent <= 100)
);

comment on table public.session_template_slots is
  'Screen-slot definitions. Deliberately holds no Display ID: the operator binds real Displays at instantiation.';

create index if not exists session_template_slots_template_idx
  on public.session_template_slots (template_id, slot_order);

-- display_sessions.template_id was declared in the lifecycle migration; give it
-- its foreign key now that the target table exists.
do $$ begin
  execute 'alter table public.display_sessions add constraint display_sessions_template_fk
             foreign key (template_id) references public.session_templates(id) on delete set null';
exception when duplicate_object or duplicate_table then null;
end $$;

create index if not exists display_sessions_template_idx
  on public.display_sessions (template_id) where template_id is not null;

-- ---------------------------------------------------------------------------
-- Entitlement and workspace integrity
-- ---------------------------------------------------------------------------

create or replace function public.enforce_session_template_entitlement()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  ent private.effective_entitlement;
begin
  ent := private.effective_entitlements(new.org_id);
  if ent.org_id is null or not ent.allow_session_templates then
    raise exception 'Session templates are available on the Pro and Max plans'
      using errcode = '42501', hint = 'entitlement_session_templates';
  end if;

  -- Cross-Workspace content can never enter a template.
  if new.board_id is not null
     and not exists (select 1 from public.boards b
                      where b.id = new.board_id and b.workspace_id = new.org_id) then
    raise exception 'That Board does not belong to this Workspace' using errcode = '42501';
  end if;
  if new.fallback_board_id is not null
     and not exists (select 1 from public.boards b
                      where b.id = new.fallback_board_id and b.workspace_id = new.org_id) then
    raise exception 'That fallback Board does not belong to this Workspace' using errcode = '42501';
  end if;
  if new.shared_layout_id is not null
     and not exists (select 1 from public.display_layouts l
                      where l.id = new.shared_layout_id and l.org_id = new.org_id) then
    raise exception 'That Layout does not belong to this Workspace' using errcode = '42501';
  end if;

  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists session_templates_enforce_entitlement on public.session_templates;
create trigger session_templates_enforce_entitlement
  before insert or update on public.session_templates
  for each row execute function public.enforce_session_template_entitlement();

create or replace function public.enforce_session_template_slot()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  tpl public.session_templates;
  ent private.effective_entitlement;
  slot_count integer;
begin
  select * into tpl from public.session_templates t where t.id = new.template_id;
  if not found then
    raise exception 'Session template not found' using errcode = 'P0002';
  end if;
  if tpl.org_id <> new.org_id then
    raise exception 'Session template belongs to a different Workspace' using errcode = '42501';
  end if;

  ent := private.effective_entitlements(new.org_id);
  select count(*) into slot_count
    from public.session_template_slots s
   where s.template_id = new.template_id and s.id <> new.id;

  -- A template can never describe a Session larger than the universal cap.
  if slot_count >= coalesce(ent.max_displays_per_session, 4) then
    raise exception 'A Session template describes at most % Display slot(s)',
      coalesce(ent.max_displays_per_session, 4) using errcode = '23514';
  end if;

  if new.layout_id is not null
     and not exists (select 1 from public.display_layouts l
                      where l.id = new.layout_id and l.org_id = new.org_id) then
    raise exception 'That Layout does not belong to this Workspace' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists session_template_slots_enforce on public.session_template_slots;
create trigger session_template_slots_enforce
  before insert or update on public.session_template_slots
  for each row execute function public.enforce_session_template_slot();

-- ---------------------------------------------------------------------------
-- Save a Session as a template
-- ---------------------------------------------------------------------------

create or replace function public.save_session_as_template(
  target_session_id uuid,
  template_name text,
  template_description text default null
)
returns public.session_templates
language plpgsql
security definer
set search_path to ''
as $$
declare
  s   public.display_sessions;
  tpl public.session_templates;
begin
  select * into s from public.display_sessions ds where ds.id = target_session_id;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;
  if not private.has_org_role(s.org_id, array['owner', 'admin', 'operator']) then
    raise exception 'You do not have permission to save this Session as a template'
      using errcode = '42501';
  end if;

  insert into public.session_templates (
    org_id, name, description, display_mode, board_id, shared_layout_id,
    fallback_policy, fallback_board_id, settings, source_session_id)
  values (
    s.org_id, template_name, template_description, s.display_mode, s.board_id,
    s.shared_layout_id, s.fallback_policy, s.fallback_board_id, s.settings, s.id)
  returning * into tpl;

  -- Slots preserve the shape of the Session, never its Displays.
  insert into public.session_template_slots (
    template_id, org_id, slot_order, slot_label, layout_id, is_primary, is_enabled,
    rotation_degrees, viewport_x_percent, viewport_y_percent,
    viewport_width_percent, viewport_height_percent)
  select tpl.id, s.org_id,
         row_number() over (order by dss.screen_order, dss.added_at) - 1,
         format('Display %s', row_number() over (order by dss.screen_order, dss.added_at)),
         dss.layout_id, dss.is_primary, dss.is_enabled, dss.rotation_degrees,
         dss.viewport_x_percent, dss.viewport_y_percent,
         dss.viewport_width_percent, dss.viewport_height_percent
    from public.display_session_screens dss
   where dss.session_id = s.id and dss.assignment_status <> 'removed';

  perform private.emit_session_event(
    s.org_id, s.id, 'template.saved', null, null, 'manager_ui',
    null, 'session_template', tpl.id, jsonb_build_object('template_name', template_name));

  return tpl;
end;
$$;

revoke all on function public.save_session_as_template(uuid, text, text) from public, anon;
grant execute on function public.save_session_as_template(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Create a draft Session from a template
-- ---------------------------------------------------------------------------

create or replace function public.create_session_from_template(
  target_template_id uuid,
  target_location_id uuid,
  session_name text
)
returns public.display_sessions
language plpgsql
security definer
set search_path to ''
as $$
declare
  tpl public.session_templates;
  s   public.display_sessions;
begin
  select * into tpl from public.session_templates t where t.id = target_template_id;
  if not found or tpl.status <> 'active' then
    raise exception 'Session template not found' using errcode = 'P0002';
  end if;
  if not private.has_org_role(tpl.org_id, array['owner', 'admin', 'operator']) then
    raise exception 'You do not have permission to use this template' using errcode = '42501';
  end if;
  if not exists (select 1 from public.locations l
                  where l.id = target_location_id and l.org_id = tpl.org_id) then
    raise exception 'That Location does not belong to this Workspace' using errcode = '42501';
  end if;

  -- Always a draft. A template cannot bypass readiness.
  insert into public.display_sessions (
    org_id, location_id, name, status, session_type, display_mode, board_id,
    shared_layout_id, fallback_policy, fallback_board_id, settings, template_id)
  values (
    tpl.org_id, target_location_id, session_name, 'draft', 'template_instance',
    tpl.display_mode, tpl.board_id, tpl.shared_layout_id,
    tpl.fallback_policy, tpl.fallback_board_id, tpl.settings, tpl.id)
  returning * into s;

  perform private.emit_session_event(
    tpl.org_id, s.id, 'template.instantiated', null, null, 'manager_ui',
    null, 'session_template', tpl.id,
    jsonb_build_object('slots', (select count(*) from public.session_template_slots
                                  where template_id = tpl.id)));

  return s;
end;
$$;

revoke all on function public.create_session_from_template(uuid, uuid, text) from public, anon;
grant execute on function public.create_session_from_template(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Duplicate a Session
-- ---------------------------------------------------------------------------

create or replace function public.duplicate_session(
  target_session_id uuid,
  new_name text,
  include_displays boolean default false
)
returns public.display_sessions
language plpgsql
security definer
set search_path to ''
as $$
declare
  src  public.display_sessions;
  copy public.display_sessions;
begin
  select * into src from public.display_sessions ds where ds.id = target_session_id;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;
  if not private.has_org_role(src.org_id, array['owner', 'admin', 'operator']) then
    raise exception 'You do not have permission to duplicate this Session' using errcode = '42501';
  end if;

  insert into public.display_sessions (
    org_id, location_id, name, status, session_type, display_mode, board_id,
    shared_layout_id, description, fallback_policy, fallback_board_id, settings, template_id)
  values (
    src.org_id, src.location_id, new_name, 'draft', src.session_type, src.display_mode,
    src.board_id, src.shared_layout_id, src.description,
    src.fallback_policy, src.fallback_board_id, src.settings, src.template_id)
  returning * into copy;

  -- Copying Displays is opt-in and only ever copies Displays that are free.
  -- A duplicate must not seize a Display from the Session it was copied from.
  if include_displays then
    insert into public.display_session_screens (
      org_id, location_id, session_id, screen_id, layout_id, is_enabled, is_primary,
      screen_order, rotation_degrees, viewport_x_percent, viewport_y_percent,
      viewport_width_percent, viewport_height_percent)
    select dss.org_id, dss.location_id, copy.id, dss.screen_id, dss.layout_id,
           dss.is_enabled, dss.is_primary, dss.screen_order, dss.rotation_degrees,
           dss.viewport_x_percent, dss.viewport_y_percent,
           dss.viewport_width_percent, dss.viewport_height_percent
      from public.display_session_screens dss
     where dss.session_id = src.id
       and dss.assignment_status <> 'removed'
       and not exists (
         select 1 from public.display_session_screens other
           join public.display_sessions os on os.id = other.session_id
          where other.screen_id = dss.screen_id
            and other.assignment_status <> 'removed'
            and private.session_state_holds_displays(os.status));
  end if;

  perform private.emit_session_event(
    src.org_id, copy.id, 'session.duplicated', null, null, 'manager_ui',
    null, 'session', src.id, jsonb_build_object('source_session_id', src.id));

  return copy;
end;
$$;

revoke all on function public.duplicate_session(uuid, text, boolean) from public, anon;
grant execute on function public.duplicate_session(uuid, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.session_templates enable row level security;
alter table public.session_template_slots enable row level security;

drop policy if exists session_templates_select_member on public.session_templates;
create policy session_templates_select_member on public.session_templates
  for select to authenticated using (private.is_org_member(org_id));

drop policy if exists session_templates_insert_operator on public.session_templates;
create policy session_templates_insert_operator on public.session_templates
  for insert to authenticated
  with check (private.has_org_role(org_id, array['owner', 'admin', 'operator', 'designer']));

drop policy if exists session_templates_update_operator on public.session_templates;
create policy session_templates_update_operator on public.session_templates
  for update to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin', 'operator', 'designer']))
  with check (private.has_org_role(org_id, array['owner', 'admin', 'operator', 'designer']));

drop policy if exists session_templates_delete_admin on public.session_templates;
create policy session_templates_delete_admin on public.session_templates
  for delete to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin']));

drop policy if exists session_template_slots_select_member on public.session_template_slots;
create policy session_template_slots_select_member on public.session_template_slots
  for select to authenticated using (private.is_org_member(org_id));

drop policy if exists session_template_slots_write_insert on public.session_template_slots;
create policy session_template_slots_write_insert on public.session_template_slots
  for insert to authenticated
  with check (private.has_org_role(org_id, array['owner', 'admin', 'operator', 'designer']));

drop policy if exists session_template_slots_write_update on public.session_template_slots;
create policy session_template_slots_write_update on public.session_template_slots
  for update to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin', 'operator', 'designer']))
  with check (private.has_org_role(org_id, array['owner', 'admin', 'operator', 'designer']));

drop policy if exists session_template_slots_write_delete on public.session_template_slots;
create policy session_template_slots_write_delete on public.session_template_slots
  for delete to authenticated
  using (private.has_org_role(org_id, array['owner', 'admin', 'operator', 'designer']));

drop trigger if exists session_templates_set_updated_at on public.session_templates;
create trigger session_templates_set_updated_at
  before update on public.session_templates
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.session_templates      to authenticated;
grant select, insert, update, delete on public.session_template_slots to authenticated;

commit;
