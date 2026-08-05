import { requireSupabase } from "../services/supabase/client";
import { broadcastOrgInvalidation } from "../services/supabase/invalidation";
import { ApiError, mapPostgresError } from "../shared/errors";
import { requireBoolean, requireDisplayMode, requirePercent, requireRotation, requireString, requireUuid, type DisplayMode } from "../shared/validation";
import type { Tables } from "../shared/database.types";
import { startTransitionPath, stopTransitionPath, transitionSessionThrough } from "./sessionControl";

export type DisplaySession = Tables<"display_sessions"> & { board_id: string | null };
export type SessionScreen = Tables<"display_session_screens">;

export interface SessionWithScreens extends DisplaySession {
  screens: SessionScreen[];
}

function withBoardId<T extends object>(row: T): T & { board_id: string | null } {
  return { ...row, board_id: (row as T & { board_id?: string | null }).board_id ?? null };
}

export async function listSessions(orgId: string, locationId?: string): Promise<DisplaySession[]> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  let query = supabase.from("display_sessions").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  if (locationId) query = query.eq("location_id", requireUuid(locationId, "location_id"));
  const { data, error } = await query;
  if (error) throw mapPostgresError(error);
  return (data ?? []).map(withBoardId);
}

export async function getSession(orgId: string, sessionId: string): Promise<SessionWithScreens | null> {
  requireUuid(orgId, "org_id");
  requireUuid(sessionId, "session_id");
  const supabase = requireSupabase();
  const { data: session, error: sessionError } = await supabase.from("display_sessions").select("*").eq("org_id", orgId).eq("id", sessionId).maybeSingle();
  if (sessionError) throw mapPostgresError(sessionError);
  if (!session) return null;
  const { data: screens, error: screensError } = await supabase
    .from("display_session_screens")
    .select("*")
    .eq("org_id", orgId)
    .eq("session_id", sessionId)
    .neq("assignment_status", "removed")
    .order("screen_order");
  if (screensError) throw mapPostgresError(screensError);
  return { ...withBoardId(session), screens: screens ?? [] };
}

/** Always created as 'draft' — the validate_new_display_session trigger
 * rejects anything else, matching "create draft, then start" semantics. */
export async function createDraftSession(orgId: string, locationId: string, name: string): Promise<DisplaySession> {
  requireUuid(orgId, "org_id");
  requireUuid(locationId, "location_id");
  const cleanName = requireString(name, "name", { max: 120 });
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("display_sessions").insert({ org_id: orgId, location_id: locationId, name: cleanName }).select("*").single();
  if (error) throw mapPostgresError(error);
  return withBoardId(data);
}

export async function renameSession(orgId: string, sessionId: string, name: string): Promise<DisplaySession> {
  requireUuid(orgId, "org_id");
  requireUuid(sessionId, "session_id");
  const cleanName = requireString(name, "name", { max: 120 });
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("display_sessions").update({ name: cleanName }).eq("org_id", orgId).eq("id", sessionId).select("*").single();
  if (error) throw mapPostgresError(error);
  return withBoardId(data);
}

/** Draft-only delete — an active/stopped session's history must survive
 * (no delete policy path exists for those; RLS + FKs enforce this). */
export async function deleteDraftSession(orgId: string, sessionId: string): Promise<void> {
  requireUuid(orgId, "org_id");
  requireUuid(sessionId, "session_id");
  const supabase = requireSupabase();
  const { error } = await supabase.from("display_sessions").delete().eq("org_id", orgId).eq("id", sessionId).eq("status", "draft");
  if (error) throw mapPostgresError(error);
}

/** duplicate/extend require a shared_layout_id; independent/single forbid
 * one — the display_sessions_check constraint enforces this, we just
 * surface a clear error before the round-trip. */
export async function setDisplayMode(orgId: string, sessionId: string, mode: DisplayMode, sharedLayoutId: string | null): Promise<DisplaySession> {
  requireUuid(orgId, "org_id");
  requireUuid(sessionId, "session_id");
  requireDisplayMode(mode);
  const needsSharedLayout = mode === "duplicate" || mode === "extend";
  if (needsSharedLayout && !sharedLayoutId) throw ApiError.validation(`${mode} mode requires a shared layout.`, { field: "shared_layout_id" });
  if (!needsSharedLayout && sharedLayoutId) throw ApiError.validation(`${mode} mode does not use a shared layout.`, { field: "shared_layout_id" });
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("display_sessions")
    .update({ display_mode: mode, shared_layout_id: sharedLayoutId })
    .eq("org_id", orgId)
    .eq("id", sessionId)
    .select("*")
    .single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return withBoardId(data);
}

/** Starts a draft through every authoritative lifecycle gate. */
export async function startSession(orgId: string, sessionId: string, startedBy: string): Promise<DisplaySession> {
  requireUuid(orgId, "org_id");
  requireUuid(sessionId, "session_id");
  requireUuid(startedBy, "started_by");
  const data = await transitionSessionThrough(orgId, sessionId, startTransitionPath("draft"));
  return withBoardId(data);
}

/** Stopping releases all screens (handle_display_session_status trigger
 * marks their session-screen rows 'removed') while the session row itself
 * — and its history — is preserved. */
export async function stopSession(orgId: string, sessionId: string, stoppedBy: string): Promise<DisplaySession> {
  requireUuid(orgId, "org_id");
  requireUuid(sessionId, "session_id");
  requireUuid(stoppedBy, "stopped_by");
  const data = await transitionSessionThrough(orgId, sessionId, stopTransitionPath("active"));
  return withBoardId(data);
}

export interface AddScreenInput {
  screen_id: string;
  board_id?: string | null;
  layout_id?: string | null;
  is_enabled?: boolean;
  is_primary?: boolean;
  screen_order?: number;
  viewport?: { x: number; y: number; width: number; height: number };
  rotation_degrees?: 0 | 90 | 180 | 270;
}

/** Adding a screen is where entitlement limits, ready-screen checks, and
 * mode-appropriate layout requirements are actually enforced — all inside
 * prepare_session_screen_assignment. This function only validates shape. */
export async function addScreenToSession(orgId: string, locationId: string, sessionId: string, input: AddScreenInput): Promise<SessionScreen> {
  requireUuid(orgId, "org_id");
  requireUuid(locationId, "location_id");
  requireUuid(sessionId, "session_id");
  requireUuid(input.screen_id, "screen_id");
  const layoutId = input.layout_id ? requireUuid(input.layout_id, "layout_id") : null;
  const viewport = input.viewport
    ? {
        viewport_x_percent: requirePercent(input.viewport.x, "viewport.x"),
        viewport_y_percent: requirePercent(input.viewport.y, "viewport.y"),
        viewport_width_percent: requirePercent(input.viewport.width, "viewport.width"),
        viewport_height_percent: requirePercent(input.viewport.height, "viewport.height"),
      }
    : {};
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("display_session_screens")
    .insert({
      org_id: orgId,
      location_id: locationId,
      session_id: sessionId,
      screen_id: input.screen_id,
      board_id: input.board_id ? requireUuid(input.board_id, "board_id") : null,
      layout_id: layoutId,
      is_enabled: input.is_enabled ?? true,
      is_primary: input.is_primary ?? false,
      screen_order: input.screen_order ?? 0,
      rotation_degrees: input.rotation_degrees ?? 0,
      ...viewport,
    })
    .select("*")
    .single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

/** Assigns a workspace Board to a session. A null assignment deliberately
 * preserves the legacy Layout playback path in display-gateway. */
export async function setSessionBoard(orgId: string, sessionId: string, boardId: string | null): Promise<DisplaySession> {
  requireUuid(orgId, "org_id");
  requireUuid(sessionId, "session_id");
  if (boardId !== null) requireUuid(boardId, "board_id");
  const supabase = requireSupabase();
  const { data, error } = await (supabase.from("display_sessions") as any)
    .update({ board_id: boardId })
    .eq("org_id", orgId)
    .eq("id", sessionId)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return withBoardId(data);
}

export async function updateSessionScreen(
  orgId: string,
  sessionScreenId: string,
  patch: Partial<{ board_id: string | null; layout_id: string | null; is_enabled: boolean; is_primary: boolean; screen_order: number; rotation_degrees: 0 | 90 | 180 | 270; viewport: { x: number; y: number; width: number; height: number } }>,
): Promise<SessionScreen> {
  requireUuid(orgId, "org_id");
  requireUuid(sessionScreenId, "session_screen_id");
  const update: Record<string, unknown> = {};
  if (patch.board_id !== undefined) update.board_id = patch.board_id === null ? null : requireUuid(patch.board_id, "board_id");
  if (patch.layout_id !== undefined) update.layout_id = patch.layout_id === null ? null : requireUuid(patch.layout_id, "layout_id");
  if (patch.is_enabled !== undefined) update.is_enabled = requireBoolean(patch.is_enabled, "is_enabled");
  if (patch.is_primary !== undefined) update.is_primary = requireBoolean(patch.is_primary, "is_primary");
  if (patch.screen_order !== undefined) update.screen_order = patch.screen_order;
  if (patch.rotation_degrees !== undefined) update.rotation_degrees = requireRotation(patch.rotation_degrees);
  if (patch.viewport) {
    update.viewport_x_percent = requirePercent(patch.viewport.x, "viewport.x");
    update.viewport_y_percent = requirePercent(patch.viewport.y, "viewport.y");
    update.viewport_width_percent = requirePercent(patch.viewport.width, "viewport.width");
    update.viewport_height_percent = requirePercent(patch.viewport.height, "viewport.height");
  }
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("display_session_screens").update(update).eq("org_id", orgId).eq("id", sessionScreenId).select("*").single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

/** Soft-removes a screen from a session (assignment_status='removed');
 * the prepare_session_screen_assignment trigger stamps removed_at. */
export async function removeScreenFromSession(orgId: string, sessionScreenId: string): Promise<void> {
  requireUuid(orgId, "org_id");
  requireUuid(sessionScreenId, "session_screen_id");
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("display_session_screens")
    .update({ assignment_status: "removed" })
    .eq("org_id", orgId)
    .eq("id", sessionScreenId);
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
}

export async function setPrimaryScreen(orgId: string, sessionId: string, sessionScreenId: string): Promise<void> {
  requireUuid(orgId, "org_id");
  requireUuid(sessionId, "session_id");
  requireUuid(sessionScreenId, "session_screen_id");
  const supabase = requireSupabase();
  // Clear any existing primary in this session first — the partial unique
  // index (one_primary_screen_per_session_idx) would otherwise 409 on the
  // insert of the new primary before the old one is cleared.
  const { error: clearError } = await supabase
    .from("display_session_screens")
    .update({ is_primary: false })
    .eq("org_id", orgId)
    .eq("session_id", sessionId)
    .eq("is_primary", true);
  if (clearError) throw mapPostgresError(clearError);
  const { error } = await supabase.from("display_session_screens").update({ is_primary: true }).eq("org_id", orgId).eq("id", sessionScreenId);
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
}
