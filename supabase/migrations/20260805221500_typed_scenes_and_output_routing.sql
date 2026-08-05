-- Typed Board Scenes and per-output Board routing.
-- Additive schema only; deployment remains a separate release gate.

alter table public.board_scenes add column if not exists scene_type text not null default 'canvas';
alter table public.board_scenes add column if not exists config jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.board_scenes add constraint board_scenes_scene_type_check check (scene_type in ('canvas','sign','presentation'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.board_scenes add constraint board_scenes_config_object_check check (jsonb_typeof(config) = 'object');
exception when duplicate_object then null; end $$;

alter table public.display_session_screens add column if not exists board_id uuid;
do $$ begin
  alter table public.display_session_screens
    add constraint display_session_screens_org_board_fkey
    foreign key (org_id, board_id) references public.boards(workspace_id, id) on delete restrict;
exception when duplicate_object then null; end $$;
create index if not exists display_session_screens_board_idx on public.display_session_screens(board_id) where board_id is not null;

create or replace function public.board_snapshot(target_board_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  result jsonb;
  target_workspace_id uuid;
begin
  select workspace_id into target_workspace_id from public.boards where id = target_board_id;
  if not found then raise exception 'board not found'; end if;
  if auth.uid() is null or not private.is_org_member(target_workspace_id) then raise exception 'workspace membership required'; end if;

  select jsonb_build_object(
    'board', jsonb_build_object(
      'id', b.id, 'workspace_id', b.workspace_id, 'name', b.name,
      'canvas_width', b.canvas_width, 'canvas_height', b.canvas_height,
      'background_color', b.background_color, 'status', b.status, 'version', b.version
    ),
    'scenes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id, 'name', s.name, 'scene_type', s.scene_type, 'config', s.config,
          'sort_order', s.sort_order, 'duration_ms', s.duration_ms,
          'transition_type', s.transition_type, 'transition_config', s.transition_config,
          'background', s.background, 'is_hidden', s.is_hidden,
          'elements', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', e.id, 'element_type', e.element_type, 'render_mode', e.render_mode,
              'name', e.name, 'x', e.x, 'y', e.y, 'width', e.width, 'height', e.height,
              'rotation', e.rotation, 'opacity', e.opacity, 'z_index', e.z_index,
              'is_locked', e.is_locked, 'is_visible', e.is_visible,
              'asset_id', e.asset_id, 'asset_page_id', e.asset_page_id, 'config', e.config
            ) order by e.z_index, e.created_at)
            from public.scene_elements e where e.scene_id = s.id
          ), '[]'::jsonb)
        ) order by s.sort_order, s.created_at
      ) from public.board_scenes s where s.board_id = b.id
    ), '[]'::jsonb)
  ) into result from public.boards b where b.id = target_board_id;
  return result;
end;
$$;

create or replace function public.save_board_draft(
  target_board_id uuid,
  expected_version integer,
  target_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_board public.boards%rowtype;
  scene_item jsonb;
  element_item jsonb;
  target_scene_id uuid;
  target_element_id uuid;
  total_elements integer := 0;
  new_version integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(target_snapshot) <> 'object' or jsonb_typeof(target_snapshot->'scenes') <> 'array' then raise exception 'invalid Board snapshot'; end if;
  if jsonb_array_length(target_snapshot->'scenes') > 100 then raise exception 'scene limit exceeded'; end if;

  select * into target_board from public.boards where id = target_board_id for update;
  if not found then raise exception 'board not found'; end if;
  if not private.has_org_role(target_board.workspace_id, array['owner','admin','operator','designer']) then raise exception 'editor role required'; end if;
  if target_board.version <> expected_version then raise exception 'board version conflict: expected %, current %', expected_version, target_board.version; end if;

  update public.boards
  set name = coalesce(nullif(btrim(target_snapshot->'board'->>'name'),''), name),
      canvas_width = coalesce(nullif(target_snapshot->'board'->>'canvas_width','')::integer, canvas_width),
      canvas_height = coalesce(nullif(target_snapshot->'board'->>'canvas_height','')::integer, canvas_height),
      background_color = coalesce(nullif(target_snapshot->'board'->>'background_color',''), background_color),
      updated_by = auth.uid(), updated_at = now()
  where id = target_board.id;

  delete from public.board_scenes where board_id = target_board.id;

  for scene_item in select value from jsonb_array_elements(target_snapshot->'scenes')
  loop
    target_scene_id := coalesce(nullif(scene_item->>'id','')::uuid, gen_random_uuid());
    insert into public.board_scenes(
      id, workspace_id, board_id, name, scene_type, config, sort_order, duration_ms,
      transition_type, transition_config, background, is_hidden
    ) values (
      target_scene_id, target_board.workspace_id, target_board.id,
      coalesce(nullif(btrim(scene_item->>'name'),''),'Scene'),
      coalesce(nullif(scene_item->>'scene_type',''),'canvas'),
      coalesce(scene_item->'config','{}'::jsonb),
      coalesce(nullif(scene_item->>'sort_order','')::integer,0),
      coalesce(nullif(scene_item->>'duration_ms','')::integer,10000),
      coalesce(nullif(scene_item->>'transition_type',''),'fade'),
      coalesce(scene_item->'transition_config','{}'::jsonb),
      coalesce(scene_item->'background','{"type":"color","value":"#000000"}'::jsonb),
      coalesce((scene_item->>'is_hidden')::boolean,false)
    );

    if scene_item ? 'elements' then
      if jsonb_typeof(scene_item->'elements') <> 'array' then raise exception 'invalid elements list'; end if;
      total_elements := total_elements + jsonb_array_length(scene_item->'elements');
      if total_elements > 1000 then raise exception 'element limit exceeded'; end if;
      for element_item in select value from jsonb_array_elements(scene_item->'elements')
      loop
        target_element_id := coalesce(nullif(element_item->>'id','')::uuid, gen_random_uuid());
        insert into public.scene_elements(
          id, workspace_id, board_id, scene_id, element_type, render_mode, name,
          x, y, width, height, rotation, opacity, z_index, is_locked, is_visible,
          asset_id, asset_page_id, config
        ) values (
          target_element_id, target_board.workspace_id, target_board.id, target_scene_id,
          element_item->>'element_type',
          coalesce(nullif(element_item->>'render_mode',''), case when element_item->>'element_type' in ('clock','date','countdown','qr_dynamic','music_player','ticker','carousel','video','weather','data_text') then 'live' else 'static' end),
          nullif(element_item->>'name',''),
          coalesce(nullif(element_item->>'x','')::numeric,0),
          coalesce(nullif(element_item->>'y','')::numeric,0),
          coalesce(nullif(element_item->>'width','')::numeric,100),
          coalesce(nullif(element_item->>'height','')::numeric,100),
          coalesce(nullif(element_item->>'rotation','')::numeric,0),
          coalesce(nullif(element_item->>'opacity','')::numeric,1),
          coalesce(nullif(element_item->>'z_index','')::integer,0),
          coalesce((element_item->>'is_locked')::boolean,false),
          coalesce((element_item->>'is_visible')::boolean,true),
          nullif(element_item->>'asset_id','')::uuid,
          nullif(element_item->>'asset_page_id','')::uuid,
          coalesce(element_item->'config','{}'::jsonb)
        );
      end loop;
    end if;
  end loop;

  new_version := target_board.version + 1;
  update public.boards set version = new_version, updated_by = auth.uid(), updated_at = now() where id = target_board.id;
  return jsonb_build_object('board_id', target_board.id, 'version', new_version, 'scene_count', jsonb_array_length(target_snapshot->'scenes'), 'element_count', total_elements);
end;
$$;

comment on column public.board_scenes.scene_type is 'Runtime behavior: canvas, sign, or presentation.';
comment on column public.board_scenes.config is 'Type-specific Scene behavior such as sign layout or presentation asset.';
comment on column public.display_session_screens.board_id is 'Optional independent-output Board override; duplicate/extend use the Session Board.';
