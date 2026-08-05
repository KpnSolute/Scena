/**
 * Session control-room domain surface.
 *
 * Everything here reads an authority the DATABASE owns. Nothing in this module
 * recomputes readiness, health or entitlements in TypeScript — that is exactly
 * the drift the 2026-07-31 session-platform migrations removed. If a verdict
 * looks wrong, fix the SQL function, not this file.
 *
 * See docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md §2.
 */
import { requireSupabase } from "../services/supabase/client";
import { broadcastOrgInvalidation } from "../services/supabase/invalidation";
import { mapPostgresError } from "../shared/errors";
import { requireUuid } from "../shared/validation";
import type { Json, Tables } from "../shared/database.types";

/** The ten Session lifecycle states. Mirrors display_sessions_status_check. */
export const SESSION_STATES = [
  "draft",
  "ready",
  "starting",
  "active",
  "degraded",
  "paused",
  "stopping",
  "stopped",
  "failed",
  "archived",
] as const;
export type SessionState = (typeof SESSION_STATES)[number];

/**
 * Transitions the operator may request. Mirrors
 * private.session_transition_allowed() so the UI can disable a control instead
 * of rendering one that errors — but the database remains authoritative and
 * will reject anything this table gets wrong.
 */
const ALLOWED_TRANSITIONS: Record<SessionState, readonly SessionState[]> = {
  draft: ["ready", "archived"],
  ready: ["draft", "starting", "archived"],
  starting: ["active", "failed", "stopping"],
  active: ["degraded", "paused", "stopping", "failed"],
  degraded: ["active", "paused", "stopping", "failed"],
  paused: ["active", "stopping", "failed"],
  stopping: ["stopped", "failed"],
  stopped: ["ready", "archived"],
  failed: ["ready", "stopping", "stopped", "archived"],
  archived: [],
};

export function canTransition(from: SessionState, to: SessionState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Ordered database transitions required to start or resume a Session. */
export function startTransitionPath(from: SessionState): SessionState[] {
  switch (from) {
    case "paused":
      return ["active"];
    case "ready":
      return ["starting", "active"];
    case "draft":
    case "stopped":
    case "failed":
      return ["ready", "starting", "active"];
    default:
      return [];
  }
}

/** Ordered database transitions required to release a live Session. */
export function stopTransitionPath(from: SessionState): SessionState[] {
  switch (from) {
    case "starting":
    case "active":
    case "degraded":
    case "paused":
    case "failed":
      return ["stopping", "stopped"];
    default:
      return [];
  }
}

/** Runs a validated sequence through the authoritative Session RPC. */
export async function transitionSessionThrough(
  orgId: string,
  sessionId: string,
  steps: readonly SessionState[],
): Promise<Tables<"display_sessions">> {
  if (steps.length === 0) throw new Error("No Session lifecycle transition is available from this state.");
  let result: Tables<"display_sessions"> | null = null;
  for (const step of steps) result = await transitionSession(orgId, sessionId, step);
  return result!;
}

/** States in which a Session still holds its Displays and consumes plan capacity. */
export function holdsDisplays(state: SessionState): boolean {
  return state === "starting" || state === "active" || state === "degraded" || state === "paused";
}

export interface ReadinessCheck {
  check_key: string;
  passed: boolean;
  severity: string;
  blocking: boolean;
  message: string;
  resource_type: string | null;
  resource_id: string | null;
}

export interface ReadinessSummary {
  is_ready: boolean;
  blocking_failures: number;
  warnings: number;
  checks_total: number;
}

export type SessionEvent = Tables<"session_events">;
export type DisplayHealth = Tables<"display_health"> & { runtime_stats?: Json };
export type SessionHealthSummary = Tables<"session_health_summary">;
export type EffectiveEntitlements = Tables<"workspace_effective_entitlements">;
export type WorkspaceUsage = Tables<"workspace_usage_current">;

export interface DisplayRuntimeStats {
  fps: number | null;
  pollLatencyMs: number | null;
  pollErrorCount: number;
  uptimeSeconds: number | null;
  devicePixelRatio: number | null;
  cpuCores: number | null;
  deviceMemoryGb: number | null;
  networkEffectiveType: string | null;
  networkDownlinkMbps: number | null;
  cacheSource: "live" | "cached" | null;
  playerStatus: string | null;
  contentVersion: string | null;
}

/** Safely narrows the bounded JSON written by display-gateway. */
export function parseDisplayRuntimeStats(value: Json | undefined): DisplayRuntimeStats {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
  const number = (key: string) => typeof record[key] === "number" && Number.isFinite(record[key]) ? record[key] as number : null;
  const string = (key: string) => typeof record[key] === "string" ? record[key] as string : null;
  const cache = string("cache_source");
  return {
    fps: number("fps"),
    pollLatencyMs: number("poll_latency_ms"),
    pollErrorCount: number("poll_error_count") ?? 0,
    uptimeSeconds: number("uptime_seconds"),
    devicePixelRatio: number("device_pixel_ratio"),
    cpuCores: number("cpu_cores"),
    deviceMemoryGb: number("device_memory_gb"),
    networkEffectiveType: string("network_effective_type"),
    networkDownlinkMbps: number("network_downlink_mbps"),
    cacheSource: cache === "live" || cache === "cached" ? cache : null,
    playerStatus: string("player_status"),
    contentVersion: string("content_version"),
  };
}

/**
 * The authoritative readiness checklist. Render these rows as-is; do not filter
 * out failures the UI thinks are unimportant — `blocking` already encodes that.
 */
export async function getSessionReadiness(sessionId: string): Promise<ReadinessCheck[]> {
  requireUuid(sessionId, "session_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("session_readiness", { target_session_id: sessionId });
  if (error) throw mapPostgresError(error);
  return (data ?? []) as ReadinessCheck[];
}

export async function getSessionReadinessSummary(sessionId: string): Promise<ReadinessSummary> {
  requireUuid(sessionId, "session_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("session_readiness_summary", {
    target_session_id: sessionId,
  });
  if (error) throw mapPostgresError(error);
  const row = (data ?? [])[0];
  return (
    (row as ReadinessSummary | undefined) ?? {
      is_ready: false,
      blocking_failures: 0,
      warnings: 0,
      checks_total: 0,
    }
  );
}

/**
 * Requests a lifecycle transition. The database checks the Workspace role,
 * applies the transition table, gates `starting` on readiness and records the
 * audit event — so this is a single call, not an orchestration.
 */
export async function transitionSession(
  orgId: string,
  sessionId: string,
  to: SessionState,
  failure?: { code: string; message?: string },
): Promise<Tables<"display_sessions">> {
  requireUuid(orgId, "org_id");
  requireUuid(sessionId, "session_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("session_transition", {
    target_session_id: sessionId,
    target_status: to,
    failure_code: failure?.code ?? undefined,
    failure_message_safe: failure?.message ?? undefined,
  });
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data as unknown as Tables<"display_sessions">;
}

/** Recomputes and caches readiness_state. The checklist stays authoritative. */
export async function refreshSessionReadiness(sessionId: string): Promise<string> {
  requireUuid(sessionId, "session_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("refresh_session_readiness", {
    target_session_id: sessionId,
  });
  if (error) throw mapPostgresError(error);
  return (data as string | null) ?? "unknown";
}

/** Newest-first operational timeline for one Session. */
export async function listSessionEvents(
  orgId: string,
  sessionId: string,
  limit = 50,
): Promise<SessionEvent[]> {
  requireUuid(orgId, "org_id");
  requireUuid(sessionId, "session_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("session_events")
    .select("*")
    .eq("org_id", orgId)
    .eq("session_id", sessionId)
    .order("occurred_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw mapPostgresError(error);
  return data ?? [];
}

/** Current health of every Display in a Workspace, keyed by screen_id. */
export async function getDisplayHealth(orgId: string): Promise<Map<string, DisplayHealth>> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("display_health").select("*").eq("org_id", orgId);
  if (error) throw mapPostgresError(error);
  return new Map(((data ?? []) as DisplayHealth[]).map((row) => [row.screen_id, row]));
}

export async function getSessionHealth(sessionId: string): Promise<SessionHealthSummary | null> {
  requireUuid(sessionId, "session_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("session_health_summary")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw mapPostgresError(error);
  return data ?? null;
}

/**
 * Effective entitlements — plan baseline merged with any approved override.
 * This is the same merge the database enforces, so the UI and the server can
 * never disagree about what a Workspace is allowed.
 */
export async function getEffectiveEntitlements(orgId: string): Promise<EffectiveEntitlements | null> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("workspace_effective_entitlements")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw mapPostgresError(error);
  return data ?? null;
}

export async function getWorkspaceUsage(orgId: string): Promise<WorkspaceUsage | null> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("workspace_usage_current")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw mapPostgresError(error);
  return data ?? null;
}

/** Human-readable label for a lifecycle state. */
export function sessionStateLabel(state: string): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "ready":
      return "Ready to start";
    case "starting":
      return "Starting";
    case "active":
      return "Live";
    case "degraded":
      return "Live — degraded";
    case "paused":
      return "Paused";
    case "stopping":
      return "Stopping";
    case "stopped":
      return "Stopped";
    case "failed":
      return "Failed";
    case "archived":
      return "Archived";
    default:
      return state;
  }
}

/** Human-readable label for a session_events.event_type. */
export function sessionEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    "session.created": "Session created",
    "session.updated": "Session updated",
    "session.ready": "Marked ready",
    "session.unready": "Returned to draft",
    "session.screen_added": "Display added",
    "session.screen_removed": "Display removed",
    "session.screen_updated": "Display settings changed",
    "session.mode_changed": "Display mode changed",
    "session.board_changed": "Board changed",
    "session.started": "Session started",
    "session.paused": "Session paused",
    "session.resumed": "Session resumed",
    "session.stopping": "Stopping",
    "session.stopped": "Session stopped",
    "session.failed": "Session failed",
    "session.degraded": "Session degraded",
    "session.recovered": "Session recovered",
    "session.archived": "Session archived",
    "screen.connected": "Display connected",
    "screen.disconnected": "Display disconnected",
    "screen.sync_started": "Display sync started",
    "screen.sync_succeeded": "Display in sync",
    "screen.sync_failed": "Display sync failed",
    "screen.health_changed": "Display health changed",
    "automation.scheduled": "Automation scheduled",
    "automation.executed": "Automation ran",
    "automation.failed": "Automation failed",
    "group.session_started": "Started by group command",
    "group.session_stopped": "Stopped by group command",
    "template.saved": "Saved as template",
    "template.instantiated": "Created from template",
    "session.duplicated": "Session duplicated",
  };
  return labels[eventType] ?? eventType;
}
