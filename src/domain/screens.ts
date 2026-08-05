import { requireSupabase } from "../services/supabase/client";
import { broadcastOrgInvalidation } from "../services/supabase/invalidation";
import { mapPostgresError } from "../shared/errors";
import { requireUuid, requireString } from "../shared/validation";
import type { Tables } from "../shared/database.types";

// Public (client-safe) screen shape. device_token_hash is intentionally
// never selected here — see docs/DATABASE_SCHEMA.md §5a for the proposed
// (unapplied) grant-hardening migration this column list anticipates.
export type Screen = Omit<Tables<"screens">, "device_token_hash">;

export interface ScreenSessionLink {
  session_id: string;
  session_name: string;
  status: string;
}

const SAFE_COLUMNS = "id, org_id, location_id, name, status, claimed_at, last_seen_at, revoked_at, created_at, updated_at";

export async function listScreens(orgId: string, locationId?: string): Promise<Screen[]> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  let query = supabase.from("screens").select(SAFE_COLUMNS).eq("org_id", orgId).order("name");
  if (locationId) query = query.eq("location_id", requireUuid(locationId, "location_id"));
  const { data, error } = await query;
  if (error) throw mapPostgresError(error);
  return (data ?? []) as unknown as Screen[];
}

/** Current retained Session route for each Display. Removed assignments are
 * history and deliberately do not create an inventory-to-control-room link. */
export async function listScreenSessionLinks(orgId: string): Promise<Map<string, ScreenSessionLink>> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  const { data: assignments, error: assignmentError } = await supabase
    .from("display_session_screens")
    .select("screen_id, session_id")
    .eq("org_id", orgId)
    .neq("assignment_status", "removed");
  if (assignmentError) throw mapPostgresError(assignmentError);
  const sessionIds = [...new Set((assignments ?? []).map((assignment) => assignment.session_id))];
  if (!sessionIds.length) return new Map();
  const { data: sessions, error: sessionError } = await supabase
    .from("display_sessions")
    .select("id, name, status")
    .eq("org_id", orgId)
    .in("id", sessionIds);
  if (sessionError) throw mapPostgresError(sessionError);
  const sessionById = new Map((sessions ?? []).map((session) => [session.id, session]));
  return new Map((assignments ?? []).flatMap((assignment) => {
    const session = sessionById.get(assignment.session_id);
    return session ? [[assignment.screen_id, { session_id: session.id, session_name: session.name, status: session.status }] as const] : [];
  }));
}

export async function getScreen(orgId: string, screenId: string): Promise<Screen | null> {
  requireUuid(orgId, "org_id");
  requireUuid(screenId, "screen_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("screens").select(SAFE_COLUMNS).eq("org_id", orgId).eq("id", screenId).maybeSingle();
  if (error) throw mapPostgresError(error);
  return data as unknown as Screen | null;
}

/** Screens available to add to a new session — paired, not revoked. */
export async function listAvailableScreens(orgId: string, locationId: string): Promise<Screen[]> {
  requireUuid(orgId, "org_id");
  requireUuid(locationId, "location_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("screens")
    .select(SAFE_COLUMNS)
    .eq("org_id", orgId)
    .eq("location_id", locationId)
    .eq("status", "ready")
    .order("name");
  if (error) throw mapPostgresError(error);
  return (data ?? []) as unknown as Screen[];
}

export async function renameScreen(orgId: string, screenId: string, name: string): Promise<Screen> {
  requireUuid(orgId, "org_id");
  requireUuid(screenId, "screen_id");
  const cleanName = requireString(name, "name", { max: 80 });
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("screens").update({ name: cleanName }).eq("org_id", orgId).eq("id", screenId).select(SAFE_COLUMNS).single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data as unknown as Screen;
}

export async function reassignScreenLocation(orgId: string, screenId: string, locationId: string): Promise<Screen> {
  requireUuid(orgId, "org_id");
  requireUuid(screenId, "screen_id");
  requireUuid(locationId, "location_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("screens")
    .update({ location_id: locationId })
    .eq("org_id", orgId)
    .eq("id", screenId)
    .select(SAFE_COLUMNS)
    .single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data as unknown as Screen;
}

/** Revocation is a one-way manager action; credential rotation and
 * re-pairing (both privileged, service-role operations) go through the
 * screen-credential Edge Function, never direct table access. */
export async function revokeScreen(orgId: string, screenId: string): Promise<Screen> {
  requireUuid(orgId, "org_id");
  requireUuid(screenId, "screen_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("screens")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", screenId)
    .select(SAFE_COLUMNS)
    .single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data as unknown as Screen;
}
