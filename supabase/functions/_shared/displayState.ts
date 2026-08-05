// Pure display-mode resolution logic — no I/O, no Supabase client. Takes
// already-fetched rows and produces the exact payload a kiosk renders.
// Kept dependency-free so the same file can be unit-tested from the
// browser test runner (see src/display/resolveDisplayState.ts, a literal
// copy — Deno Edge Functions and the Vite-bundled frontend can't share a
// module across runtimes without a build step this project doesn't have).

export type DisplayMode = "independent" | "duplicate" | "extend" | "single";

export interface TileData {
  id: string;
  scene_id: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  z_index: number;
  is_visible: boolean;
  config: unknown;
  content: unknown; // resolved scene content (menu payload or presentation manifest ref), or null if unresolved
}

export interface LayoutData {
  id: string;
  name: string;
  canvas_width: number;
  canvas_height: number;
  background_color: string;
  tiles: TileData[];
  updated_at: string;
}

export interface SessionScreenData {
  id: string;
  board_id: string | null;
  is_enabled: boolean;
  is_primary: boolean;
  layout_id: string | null;
  rotation_degrees: number;
  viewport_x_percent: number;
  viewport_y_percent: number;
  viewport_width_percent: number;
  viewport_height_percent: number;
  updated_at?: string;
}

export interface SessionData {
  id: string;
  name: string;
  status: "draft" | "active" | "stopped";
  display_mode: DisplayMode;
  shared_layout_id: string | null;
  updated_at: string;
}

export interface BoardElementData {
  id: string;
  element_type: string;
  render_mode: string;
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  z_index: number;
  is_locked: boolean;
  is_visible: boolean;
  asset_id: string | null;
  asset_page_id: string | null;
  config: Record<string, unknown>;
}

export interface BoardSceneData {
  id: string;
  name: string;
  scene_type: "canvas" | "sign" | "presentation";
  config: Record<string, unknown>;
  sort_order: number;
  duration_ms: number;
  transition_type: string;
  transition_config: Record<string, unknown>;
  background: Record<string, unknown>;
  is_hidden: boolean;
  elements: BoardElementData[];
}

export interface BoardData {
  id: string;
  workspace_id: string;
  name: string;
  canvas_width: number;
  canvas_height: number;
  background_color: string;
  status: string;
  version: number;
  updated_at: string;
  session_started_at: string | null;
  content_updated_at?: string;
  session_updated_at: string;
  location_timezone: string | null;
  scenes: BoardSceneData[];
}

export type ResolvedDisplayState =
  | { status: "standby"; screen_name: string; reason: "no_active_session" | "screen_disabled" | "no_layout" }
  | {
      status: "showing";
      screen_name: string;
      session: { id: string; name: string };
      display_mode: DisplayMode;
      rotation_degrees: number;
      viewport: { x: number; y: number; width: number; height: number };
      layout: LayoutData;
      content_version: string;
      server_time: string;
    };

/**
 * `layoutOf(id)` looks up an already-fetched layout by id — independent
 * and single modes use the session-screen's own layout_id; duplicate and
 * extend use the session's shared_layout_id.
 */
export function resolveDisplayState(
  screenName: string,
  session: SessionData | null,
  sessionScreen: SessionScreenData | null,
  layoutOf: (layoutId: string) => LayoutData | null,
  now: () => string,
): ResolvedDisplayState {
  if (!session || session.status !== "active" || !sessionScreen) {
    return { status: "standby", screen_name: screenName, reason: "no_active_session" };
  }
  if (!sessionScreen.is_enabled) {
    return { status: "standby", screen_name: screenName, reason: "screen_disabled" };
  }

  const usesSharedLayout = session.display_mode === "duplicate" || session.display_mode === "extend";
  const layoutId = usesSharedLayout ? session.shared_layout_id : sessionScreen.layout_id;
  const layout = layoutId ? layoutOf(layoutId) : null;
  if (!layout) return { status: "standby", screen_name: screenName, reason: "no_layout" };

  const viewport =
    session.display_mode === "extend"
      ? {
          x: sessionScreen.viewport_x_percent,
          y: sessionScreen.viewport_y_percent,
          width: sessionScreen.viewport_width_percent,
          height: sessionScreen.viewport_height_percent,
        }
      : { x: 0, y: 0, width: 100, height: 100 };

  const versionInputs = [session.updated_at, sessionScreen.updated_at ?? "", layout.updated_at, ...layout.tiles.map((t) => t.id)];
  const content_version = versionInputs.join("|");

  return {
    status: "showing",
    screen_name: screenName,
    session: { id: session.id, name: session.name },
    display_mode: session.display_mode,
    rotation_degrees: sessionScreen.rotation_degrees,
    viewport,
    layout,
    content_version,
    server_time: now(),
  };
}
