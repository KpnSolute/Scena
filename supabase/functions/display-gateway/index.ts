// Scena display gateway — the only API kiosks talk to.
//
// A kiosk never holds a Supabase session, service key, or manager JWT.
// It authenticates with the opaque device token issued at registration
// (screen-register) or claim (screen-claim); every state poll re-sends
// that token, hashed and matched against screens.device_token_hash here.
// The kiosk cannot request an arbitrary organization or session — its
// identity is entirely determined by which screen row the token resolves
// to, and every downstream lookup is scoped through that screen's own
// org_id/location_id.
//
// verify_jwt is OFF: kiosks are unauthenticated until claimed. All data
// access happens with the service role inside this function.

import { serveJson, json } from "../_shared/http.ts";
import { adminClient } from "../_shared/adminClient.ts";
import { sha256 } from "../_shared/crypto.ts";
import { ApiError } from "../_shared/errors.ts";
import { resolveDisplayState, type BoardData, type BoardElementData, type BoardSceneData, type LayoutData, type SessionData, type SessionScreenData, type TileData } from "../_shared/displayState.ts";

serveJson(async (req) => {
  const admin = adminClient();
  const body = (await req.json()) as Record<string, unknown>;
  const token = typeof body.device_token === "string" ? body.device_token : "";
  if (!token || token.length > 200) throw new ApiError("DEVICE_CREDENTIAL_INVALID", "Missing or malformed device token.", 401);

  const { data: screen, error: screenError } = await admin
    .from("screens")
    .select("id, org_id, location_id, name, status, revoked_at")
    .eq("device_token_hash", await sha256(token))
    .maybeSingle();
  if (screenError) throw ApiError.internal(screenError.message);
  if (!screen) throw new ApiError("DEVICE_CREDENTIAL_INVALID", "Unrecognized device.", 401);
  if (screen.status === "revoked" || screen.revoked_at) throw new ApiError("SCREEN_REVOKED", "This screen's credential has been revoked.", 403);

  await admin.from("screens").update({ last_seen_at: new Date().toISOString() }).eq("id", screen.id);

  if (screen.status === "pairing") return json({ status: "pending", screen_name: screen.name }, 200);

  // org_id lets the kiosk join its org's `org:{orgId}` invalidation
  // broadcast channel (Realtime Broadcast, not RLS-gated postgres_changes
  // — see _shared/broadcast.ts and src/services/supabase/invalidation.ts
  // for why: this kiosk connection has no Supabase session at all).

  // Ready screen: find its current live assignment, if any.
  const { data: sessionScreen, error: ssError } = await admin
    .from("display_session_screens")
      .select("id, session_id, is_enabled, is_primary, layout_id, rotation_degrees, viewport_x_percent, viewport_y_percent, viewport_width_percent, viewport_height_percent, updated_at")
    .eq("screen_id", screen.id)
    .eq("assignment_status", "active")
    .maybeSingle();
  if (ssError) throw ApiError.internal(ssError.message);

  let session: SessionData | null = null;
  if (sessionScreen) {
    const { data: sessionRow, error: sessionError } = await admin
      .from("display_sessions")
      .select("id, name, status, display_mode, shared_layout_id, board_id, location_id, started_at, updated_at")
      .eq("id", sessionScreen.session_id)
      .maybeSingle();
    if (sessionError) throw ApiError.internal(sessionError.message);
    session = sessionRow as SessionData | null;
  }

  const layoutId = session && (session.display_mode === "duplicate" || session.display_mode === "extend") ? session.shared_layout_id : sessionScreen?.layout_id ?? null;
  const layout = layoutId ? await fetchResolvedLayout(admin, screen.org_id!, layoutId) : null;
  const boardId = (session as SessionData & { board_id?: string | null } | null)?.board_id ?? null;
  const board = boardId && session?.status === "active"
    ? await fetchBoardSnapshot(admin, screen.org_id!, boardId, (session as SessionData & { started_at?: string | null; location_id?: string | null }).started_at ?? null, session.updated_at, (session as SessionData & { location_id?: string | null }).location_id ?? screen.location_id)
    : null;

  const resolved = resolveDisplayState(
    screen.name,
    session,
    (sessionScreen as SessionScreenData | null) ?? null,
    (id) => (layout && layout.id === id ? layout : null),
    () => new Date().toISOString(),
  );
  const boardResolved = board && session && sessionScreen?.is_enabled
    ? resolveBoardDisplayState(screen.name, session, sessionScreen as SessionScreenData, board)
    : resolved;
  return json({ ...boardResolved, org_id: screen.org_id, ...(board ? { board } : {}) }, 200);
}, ["POST"]);

function resolveBoardDisplayState(screenName: string, session: SessionData, sessionScreen: SessionScreenData, board: BoardData) {
  const viewport = session.display_mode === "extend"
    ? { x: sessionScreen.viewport_x_percent, y: sessionScreen.viewport_y_percent, width: sessionScreen.viewport_width_percent, height: sessionScreen.viewport_height_percent }
    : { x: 0, y: 0, width: 100, height: 100 };
  return {
    status: "showing" as const,
    screen_name: screenName,
    session: { id: session.id, name: session.name },
    display_mode: session.display_mode,
    rotation_degrees: sessionScreen.rotation_degrees,
    viewport,
    content_version: `board:${board.id}:${board.version}:${board.updated_at}:${board.content_updated_at ?? board.updated_at}:${board.session_updated_at}`,
    server_time: new Date().toISOString(),
  };
}

async function fetchBoardSnapshot(
  admin: ReturnType<typeof adminClient>,
  workspaceId: string,
  boardId: string,
  sessionStartedAt: string | null,
  sessionUpdatedAt: string,
  locationId: string | null,
): Promise<BoardData | null> {
  const { data: board, error: boardError } = await admin
    .from("boards")
    .select("id, workspace_id, name, canvas_width, canvas_height, background_color, status, version, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("id", boardId)
    .eq("status", "active")
    .maybeSingle();
  if (boardError) throw ApiError.internal(boardError.message);
  if (!board) return null;

  const [{ data: scenes, error: scenesError }, { data: elements, error: elementsError }, { data: location, error: locationError }] = await Promise.all([
    admin.from("board_scenes").select("id, workspace_id, board_id, name, sort_order, duration_ms, transition_type, transition_config, background, is_hidden, updated_at").eq("workspace_id", workspaceId).eq("board_id", boardId).order("sort_order").order("created_at"),
    admin.from("scene_elements").select("id, workspace_id, board_id, scene_id, element_type, render_mode, name, x, y, width, height, rotation, opacity, z_index, is_locked, is_visible, asset_id, asset_page_id, config, updated_at").eq("workspace_id", workspaceId).eq("board_id", boardId).eq("is_visible", true).order("z_index"),
    locationId ? admin.from("locations").select("timezone").eq("org_id", workspaceId).eq("id", locationId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (scenesError) throw ApiError.internal(scenesError.message);
  if (elementsError) throw ApiError.internal(elementsError.message);
  if (locationError) throw ApiError.internal(locationError.message);

  const timezone = typeof location?.timezone === "string" && location.timezone ? location.timezone : null;
  const sourceIds = [...new Set((elements ?? []).map((row) => jsonRecord(row.config).source_id).filter((id): id is string => typeof id === "string" && id.length > 0))];
  const { data: sources, error: sourcesError } = sourceIds.length
    ? await admin.from("content_sources").select("id, current_payload, updated_at").eq("workspace_id", workspaceId).eq("status", "active").in("id", sourceIds)
    : { data: [], error: null };
  if (sourcesError) throw ApiError.internal(sourcesError.message);
  const sourceById = new Map((sources ?? []).map((source) => [source.id, source]));
  const elementsByScene = new Map<string, BoardElementData[]>();
  for (const row of elements ?? []) {
    const config = jsonRecord(row.config);
    if (timezone && (row.element_type === "clock" || row.element_type === "date") && !config.time_zone && !config.timeZone) config.time_zone = timezone;
    if (row.element_type === "data_text" && typeof config.source_id === "string" && typeof config.source_key === "string") {
      const source = sourceById.get(config.source_id);
      const resolved = source ? resolvePath(source.current_payload, config.source_key) : undefined;
      if (typeof resolved === "string" || typeof resolved === "number" || typeof resolved === "boolean") config.resolved_value = resolved;
    }
    const item: BoardElementData = {
      id: row.id,
      element_type: row.element_type,
      render_mode: row.render_mode,
      name: row.name,
      x: Number(row.x), y: Number(row.y), width: Number(row.width), height: Number(row.height),
      rotation: Number(row.rotation), opacity: Number(row.opacity), z_index: Number(row.z_index),
      is_locked: Boolean(row.is_locked), is_visible: Boolean(row.is_visible),
      asset_id: row.asset_id, asset_page_id: row.asset_page_id, config,
    };
    const current = elementsByScene.get(row.scene_id) ?? [];
    current.push(item);
    elementsByScene.set(row.scene_id, current);
  }

  const boardScenes: BoardSceneData[] = (scenes ?? []).filter((scene) => !scene.is_hidden).map((scene) => ({
    id: scene.id,
    name: scene.name,
    sort_order: Number(scene.sort_order),
    duration_ms: Number(scene.duration_ms),
    transition_type: scene.transition_type,
    transition_config: jsonRecord(scene.transition_config),
    background: jsonRecord(scene.background),
    is_hidden: Boolean(scene.is_hidden),
    elements: elementsByScene.get(scene.id) ?? [],
  }));

  return {
    id: board.id,
    workspace_id: board.workspace_id,
    name: board.name,
    canvas_width: Number(board.canvas_width),
    canvas_height: Number(board.canvas_height),
    background_color: board.background_color,
    status: board.status,
    version: Number(board.version),
    updated_at: board.updated_at,
    content_updated_at: (sources ?? []).map((source) => source.updated_at).sort().at(-1) ?? board.updated_at,
    session_started_at: sessionStartedAt,
    session_updated_at: sessionUpdatedAt,
    location_timezone: timezone,
    scenes: boardScenes,
  };
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function resolvePath(value: unknown, path: string): unknown {
  return path.split(".").filter(Boolean).reduce<unknown>((current, segment) => {
    if (Array.isArray(current) && /^\d+$/.test(segment)) return current[Number(segment)];
    if (current && typeof current === "object") return (current as Record<string, unknown>)[segment];
    return undefined;
  }, value);
}

async function fetchResolvedLayout(admin: ReturnType<typeof adminClient>, orgId: string, layoutId: string): Promise<LayoutData | null> {
  const { data: layoutRow, error: layoutError } = await admin
    .from("display_layouts")
    .select("id, name, canvas_width, canvas_height, background_color, updated_at")
    .eq("org_id", orgId)
    .eq("id", layoutId)
    .maybeSingle();
  if (layoutError) throw ApiError.internal(layoutError.message);
  if (!layoutRow) return null;

  const { data: tileRows, error: tilesError } = await admin
    .from("display_layout_tiles")
    .select("id, scene_id, x_percent, y_percent, width_percent, height_percent, z_index, is_visible, config")
    .eq("org_id", orgId)
    .eq("layout_id", layoutId)
    .eq("is_visible", true)
    .order("z_index");
  if (tilesError) throw ApiError.internal(tilesError.message);

  const tiles: TileData[] = [];
  for (const tile of tileRows ?? []) {
    const content = await resolveSceneContent(admin, orgId, tile.scene_id);
    tiles.push({ ...tile, content });
  }
  return { ...layoutRow, tiles };
}

/** Deno-side twin of src/domain/scenes.ts#resolveSceneContent — same
 * resolution rules, service-role I/O instead of the browser client. */
async function resolveSceneContent(admin: ReturnType<typeof adminClient>, orgId: string, sceneId: string): Promise<unknown> {
  const { data: scene, error: sceneError } = await admin
    .from("scenes")
    .select("scene_type, menu_id, presentation_asset_id, is_active")
    .eq("org_id", orgId)
    .eq("id", sceneId)
    .maybeSingle();
  if (sceneError) throw ApiError.internal(sceneError.message);
  if (!scene || !scene.is_active) return null;

  if (scene.scene_type === "menu" && scene.menu_id) {
    const { data: menu, error: menuError } = await admin.from("menus").select("id, name").eq("org_id", orgId).eq("id", scene.menu_id).maybeSingle();
    if (menuError) throw ApiError.internal(menuError.message);
    if (!menu) return null;
    const { data: sections, error: sectionsError } = await admin
      .from("menu_sections")
      .select("id, name, sort_order, menu_items(id, name, description, price, image_url, is_sold_out, is_visible, sort_order)")
      .eq("org_id", orgId)
      .eq("menu_id", menu.id)
      .eq("is_visible", true)
      .order("sort_order");
    if (sectionsError) throw ApiError.internal(sectionsError.message);
    return {
      scene_type: "menu",
      menu: {
        id: menu.id,
        name: menu.name,
        sections: (sections ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          items: ((s as unknown as { menu_items: Array<Record<string, unknown>> }).menu_items ?? [])
            .filter((i) => i.is_visible)
            .sort((a, b) => (a.sort_order as number) - (b.sort_order as number)),
        })),
      },
    };
  }

  if (scene.scene_type === "powerpoint" && scene.presentation_asset_id) {
    const { data: asset, error: assetError } = await admin
      .from("presentation_assets")
      .select("status, lxc_manifest_key, slide_count")
      .eq("org_id", orgId)
      .eq("id", scene.presentation_asset_id)
      .maybeSingle();
    if (assetError) throw ApiError.internal(assetError.message);
    if (!asset || asset.status !== "ready" || !asset.lxc_manifest_key || asset.slide_count === null) return null;
    return { scene_type: "powerpoint", manifest_key: asset.lxc_manifest_key, slide_count: asset.slide_count };
  }
  return null;
}
