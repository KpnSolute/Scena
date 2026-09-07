import { requireSupabase, callEdgeFunction } from "../services/supabase/client";
import { mapPostgresError } from "../shared/errors";

export type WorkspaceType = "personal" | "team";
export type BillingMode = "free" | "one_time" | "subscription";
export type CheckoutOfferingCode = "personal_additional" | "plus" | "pro" | "max";
export type OfferingCode = "personal_free" | CheckoutOfferingCode;
export type OfferingAvailability = "generally_available" | "limited" | "pilot" | "waitlist" | "unavailable";

export interface OfferingPresentation {
  code: OfferingCode;
  name: string;
  price: string;
  cadence: string;
  availability: OfferingAvailability;
  availabilityNote?: string;
  features: string[];
  featured?: boolean;
}

export const PUBLIC_OFFERINGS: readonly OfferingPresentation[] = [
  { code: "personal_free", name: "Personal Free", price: "$0", cadence: "forever", availability: "generally_available", features: ["1 Personal Workspace", "2 Displays", "5 Boards", "5 source uploads / month", "1 member"] },
  { code: "personal_additional", name: "Additional Personal", price: "$15", cadence: "one-time", availability: "generally_available", features: ["One more Personal Workspace", "Same Personal Free limits", "No recurring charge"] },
  { code: "plus", name: "Plus", price: "$15", cadence: "/month", availability: "limited", availabilityNote: "Limited availability — onboarding is reviewed before your Workspace is provisioned.", features: ["Team Workspace", "2 Displays", "10 Boards", "5 members", "1 concurrent Session"], featured: true },
  { code: "pro", name: "Pro", price: "$25", cadence: "/month", availability: "limited", availabilityNote: "Limited availability — onboarding is reviewed before your Workspace is provisioned.", features: ["Team Workspace", "5 Displays", "30 Boards", "10 members", "Basic automation"] },
  { code: "max", name: "Max", price: "$40", cadence: "/month", availability: "unavailable", availabilityNote: "Not yet available. Groups and advanced automation are still in development.", features: ["Team Workspace", "15 Displays", "50 Boards", "25 members", "Advanced automation, groups"] },
] as const;

export const CHECKOUT_OFFERINGS = PUBLIC_OFFERINGS.filter(
  (offering): offering is OfferingPresentation & { code: CheckoutOfferingCode } => offering.code !== "personal_free",
);

export function isOfferingCheckoutAvailable(availability: OfferingAvailability): boolean {
  return availability === "generally_available" || availability === "limited";
}

export function canManageWorkspaceBilling(workspaceType: WorkspaceType, planCode?: string | null): boolean {
  return workspaceType === "team" && ["plus", "pro", "max"].includes(planCode ?? "");
}

export interface Plan {
  plan_code: string;
  name: string;
  unit_amount: number | null;
  currency: string | null;
  billing_interval: string | null;
  workspace_type: WorkspaceType;
  billing_mode: BillingMode;
}

export interface CheckoutRequest {
  offering_code: CheckoutOfferingCode;
  workspace_name: string;
  workspace_slug?: string;
}

export interface CheckoutResult {
  checkout_url: string;
  checkout_session_id: string;
  offering_code: CheckoutOfferingCode;
  workspace_type: WorkspaceType;
  billing_mode: Exclude<BillingMode, "free">;
  workspace_slug: string;
  request_id: string;
}

export async function listActiveOfferings(): Promise<Plan[]> {
  // The generated Database type is replaced separately from the live Supabase
  // schema. Keep this query isolated until that generated artifact is refreshed.
  const supabase = requireSupabase() as any;
  const { data, error } = await supabase
    .from("plans")
    .select("plan_code, name, unit_amount, currency, billing_interval, workspace_type, billing_mode")
    .eq("is_active", true)
    .order("unit_amount", { ascending: true });
  if (error) throw mapPostgresError(error);
  return (data ?? []) as Plan[];
}

/** Backward-compatible alias while the pricing UI moves to Workspace terminology. */
export const listActivePlans = listActiveOfferings;

export async function startWorkspaceCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  const workspaceName = request.workspace_name.trim();
  const workspaceSlug = request.workspace_slug?.trim().toLowerCase();

  if (!workspaceName || workspaceName.length > 120) {
    throw Object.assign(new Error("Workspace name is required and must be at most 120 characters."), {
      code: "VALIDATION_FAILED",
    });
  }

  if (workspaceSlug && !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(workspaceSlug)) {
    throw Object.assign(new Error("Workspace slug must be 3-64 lowercase letters, numbers, or hyphens."), {
      code: "VALIDATION_FAILED",
    });
  }

  return callEdgeFunction<CheckoutResult>("billing-checkout", {
    offering_code: request.offering_code,
    workspace_name: workspaceName,
    ...(workspaceSlug ? { workspace_slug: workspaceSlug } : {}),
  });
}

export async function startPersonalWorkspaceCheckout(
  workspaceName: string,
  workspaceSlug?: string,
): Promise<CheckoutResult> {
  return startWorkspaceCheckout({
    offering_code: "personal_additional",
    workspace_name: workspaceName,
    workspace_slug: workspaceSlug,
  });
}

/** Backward-compatible Team helper used by the existing pricing screen. */
export async function startTeamCheckout(
  planCode: string,
  teamName: string,
  teamSlug?: string,
): Promise<CheckoutResult> {
  if (!(["plus", "pro", "max"] as string[]).includes(planCode)) {
    throw Object.assign(new Error("Choose Plus, Pro, or Max."), { code: "VALIDATION_FAILED" });
  }

  return startWorkspaceCheckout({
    offering_code: planCode as "plus" | "pro" | "max",
    workspace_name: teamName,
    workspace_slug: teamSlug,
  });
}
