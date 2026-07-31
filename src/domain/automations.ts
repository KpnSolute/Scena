import { requireSupabase } from "../services/supabase/client";
import { ApiError, mapPostgresError } from "../shared/errors";
import { requireBoolean, requireCronOrOnce, requireDisplayMode, requireString, requireUuid } from "../shared/validation";
import type { Tables } from "../shared/database.types";

export type Automation = Tables<"display_automations">;
export type ActionType =
  | "start_session"
  | "stop_session"
  | "set_display_mode"
  | "set_shared_layout"
  | "set_screen_layout"
  | "enable_screen"
  | "disable_screen"
  | "switch_primary_screen";

export interface AutomationInput {
  name: string;
  session_id: string;
  action_type: ActionType;
  target_session_screen_id?: string | null;
  target_layout_id?: string | null;
  target_display_mode?: string | null;
  schedule: { schedule_type: "once" | "cron"; run_once_at?: string; cron_expression?: string; timezone?: string };
}

/** Mirrors the display_automations_check1 constraint client-side so the
 * caller gets a field-level VALIDATION_FAILED instead of a raw 23514. */
function validateActionShape(input: AutomationInput) {
  const { action_type, target_session_screen_id, target_layout_id, target_display_mode } = input;
  const need = (cond: boolean, msg: string) => { if (!cond) throw ApiError.validation(msg); };
  switch (action_type) {
    case "start_session":
    case "stop_session":
      need(!target_session_screen_id && !target_layout_id && !target_display_mode, `${action_type} takes no target fields.`);
      break;
    case "set_shared_layout":
      need(!target_session_screen_id && !!target_layout_id && !target_display_mode, "set_shared_layout requires target_layout_id only.");
      break;
    case "set_screen_layout":
      need(!!target_session_screen_id && !!target_layout_id && !target_display_mode, "set_screen_layout requires target_session_screen_id and target_layout_id.");
      break;
    case "enable_screen":
    case "disable_screen":
    case "switch_primary_screen":
      need(!!target_session_screen_id && !target_layout_id && !target_display_mode, `${action_type} requires target_session_screen_id only.`);
      break;
    case "set_display_mode": {
      need(!target_session_screen_id && !!target_display_mode, "set_display_mode requires target_display_mode.");
      const mode = requireDisplayMode(target_display_mode);
      const needsLayout = mode === "duplicate" || mode === "extend";
      need(needsLayout ? !!target_layout_id : !target_layout_id, `${mode} mode ${needsLayout ? "requires" : "forbids"} target_layout_id.`);
      break;
    }
  }
}

export async function listAutomations(orgId: string, sessionId?: string): Promise<Automation[]> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  let query = supabase.from("display_automations").select("*").eq("org_id", orgId).order("next_run_at", { ascending: true, nullsFirst: false });
  if (sessionId) query = query.eq("session_id", requireUuid(sessionId, "session_id"));
  const { data, error } = await query;
  if (error) throw mapPostgresError(error);
  return data ?? [];
}

export async function createAutomation(orgId: string, locationId: string, input: AutomationInput): Promise<Automation> {
  requireUuid(orgId, "org_id");
  requireUuid(locationId, "location_id");
  requireUuid(input.session_id, "session_id");
  const name = requireString(input.name, "name", { max: 120 });
  validateActionShape(input);
  const schedule = requireCronOrOnce(input.schedule);

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("display_automations")
    .insert({
      org_id: orgId,
      location_id: locationId,
      session_id: input.session_id,
      name,
      action_type: input.action_type,
      target_session_screen_id: input.target_session_screen_id ?? null,
      target_layout_id: input.target_layout_id ?? null,
      target_display_mode: input.target_display_mode ?? null,
      // Every automation created here targets a Session. schedule_kind drives
      // the plan-tier check in enforce_automation_entitlement(): 'once' is
      // allowed on Pro and Max, 'custom' (an arbitrary cron) on Max only.
      // Narrower kinds — daily, weekly, hourly — are set by the scheduling UI
      // once it can express them; defaulting to 'custom' never grants more than
      // the plan allows.
      target_type: "session" as const,
      target_id: input.session_id,
      schedule_kind: schedule.schedule_type === "once" ? ("once" as const) : ("custom" as const),
      ...schedule,
      next_run_at: schedule.schedule_type === "once" ? schedule.run_once_at : null, // cron rows get next_run_at computed by the worker
    })
    .select("*")
    .single();
  if (error) throw mapPostgresError(error);
  return data;
}

export async function updateAutomation(orgId: string, automationId: string, patch: Partial<Pick<Automation, "name" | "is_enabled">>): Promise<Automation> {
  requireUuid(orgId, "org_id");
  requireUuid(automationId, "automation_id");
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = requireString(patch.name, "name", { max: 120 });
  if (patch.is_enabled !== undefined) update.is_enabled = requireBoolean(patch.is_enabled, "is_enabled");
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("display_automations").update(update).eq("org_id", orgId).eq("id", automationId).select("*").single();
  if (error) throw mapPostgresError(error);
  return data;
}

export async function disableAutomation(orgId: string, automationId: string): Promise<Automation> {
  return updateAutomation(orgId, automationId, { is_enabled: false });
}
