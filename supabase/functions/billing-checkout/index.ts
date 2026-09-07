import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decideAvailability, entitlementPlanCode, type CheckoutOfferingCode } from "./availability.ts";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

type BillingMode = "one_time" | "subscription";
type WorkspaceType = "personal" | "team";
type Stage =
  | "configuration"
  | "authentication"
  | "validation"
  | "offering_lookup"
  | "availability_check"
  | "customer_creation"
  | "checkout_creation"
  | "database_persistence";

type Offering = {
  plan_code: string;
  stripe_price_id: string | null;
  workspace_type: WorkspaceType;
  billing_mode: "free" | BillingMode;
  is_active: boolean;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") {
    return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST required." } }, 405);
  }

  const requestId = crypto.randomUUID();
  let stage: Stage = "configuration";

  try {
    const supabaseUrl = required("SUPABASE_URL");
    const anonKey = required("SUPABASE_ANON_KEY");
    const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = required("STRIPE_SECRET_KEY");
    const appUrl = required("SCENA_APP_URL").replace(/\/$/, "");
    const authorization = req.headers.get("authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    stage = "authentication";
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user?.email) {
      return json({ error: { code: "UNAUTHENTICATED", message: "Sign in is required.", request_id: requestId } }, 401);
    }
    const user = userData.user;

    stage = "validation";
    const body = await req.json() as Record<string, unknown>;
    const offeringCode = text(body.offering_code || body.plan_code).toLowerCase();
    const workspaceName = text(body.workspace_name || body.team_name);
    const suppliedSlug = text(body.workspace_slug || body.team_slug).toLowerCase();

    if (!["personal_additional", "plus", "pro", "max"].includes(offeringCode)) {
      return json({ error: { code: "VALIDATION_FAILED", message: "Choose an additional Personal Workspace, Plus, Pro, or Max.", request_id: requestId } }, 400);
    }
    if (!workspaceName || workspaceName.length > 120) {
      return json({ error: { code: "VALIDATION_FAILED", message: "Workspace name is required and must be at most 120 characters.", request_id: requestId } }, 400);
    }
    if (suppliedSlug && !validSlug(suppliedSlug)) {
      return json({ error: { code: "VALIDATION_FAILED", message: "Workspace slug must be 3-64 lowercase letters, numbers, or hyphens.", request_id: requestId } }, 400);
    }

    stage = "offering_lookup";
    const offeringResult = await admin
      .from("plans")
      .select("plan_code,stripe_price_id,workspace_type,billing_mode,is_active")
      .eq("plan_code", offeringCode)
      .single();
    const offering = offeringResult.data as Offering | null;
    const offeringError = offeringResult.error;

    if (offeringError || !offering?.is_active || offering.billing_mode === "free") {
      return json({ error: { code: "OFFERING_UNAVAILABLE", message: "That Workspace offering is unavailable.", request_id: requestId } }, 400);
    }
    if (!offering.stripe_price_id) {
      return json({ error: { code: "PRICE_NOT_CONFIGURED", message: "This offering is not available for Checkout yet.", request_id: requestId } }, 503);
    }

    const expectedShape = offeringCode === "personal_additional"
      ? offering.workspace_type === "personal" && offering.billing_mode === "one_time"
      : offering.workspace_type === "team" && offering.billing_mode === "subscription";
    if (!expectedShape) {
      return json({ error: { code: "OFFERING_CONFIGURATION_INVALID", message: "This offering is configured incorrectly.", request_id: requestId } }, 503);
    }

    const entitlementResult = await admin
      .from("plan_entitlements")
      .select("availability,availability_note")
      .eq("plan_code", entitlementPlanCode(offeringCode as CheckoutOfferingCode))
      .maybeSingle();
    if (entitlementResult.error) {
      return json({ error: { code: "OFFERING_CONFIGURATION_INVALID", message: "This offering's availability could not be verified.", request_id: requestId } }, 503);
    }
    const availability = decideAvailability(entitlementResult.data);
    if (!availability.ok) {
      return json({ error: { code: availability.code, message: availability.message, request_id: requestId } }, availability.status);
    }

    const workspaceSlug = suppliedSlug || generatedSlug(workspaceName);

    stage = "availability_check";
    const now = new Date().toISOString();
    await admin
      .from("checkout_sessions")
      .update({ status: "expired", updated_at: now })
      .eq("user_id", user.id)
      .eq("status", "open")
      .lt("expires_at", now);

    const { data: openCheckout } = await admin
      .from("checkout_sessions")
      .select("stripe_checkout_session_id")
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openCheckout) {
      return json({ error: { code: "CHECKOUT_ALREADY_OPEN", message: "A Checkout Session is already open for this account.", request_id: requestId } }, 409);
    }

    const { data: existingWorkspace } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", workspaceSlug)
      .maybeSingle();
    if (existingWorkspace) {
      return json({ error: { code: "WORKSPACE_SLUG_TAKEN", message: "That Workspace slug is already in use.", request_id: requestId } }, 409);
    }

    const { data: reservedSlug } = await admin
      .from("checkout_sessions")
      .select("id")
      .eq("requested_workspace_slug", workspaceSlug)
      .eq("status", "open")
      .limit(1)
      .maybeSingle();
    if (reservedSlug) {
      return json({ error: { code: "WORKSPACE_SLUG_RESERVED", message: "That Workspace slug is currently reserved by another Checkout.", request_id: requestId } }, 409);
    }

    stage = "customer_creation";
    let stripeCustomerId: string;
    const { data: customerRow } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (customerRow?.stripe_customer_id) {
      stripeCustomerId = String(customerRow.stripe_customer_id);
    } else {
      const customer = await stripePost(stripeKey, "/v1/customers", {
        email: user.email!,
        "metadata[scena_user_id]": user.id,
        "metadata[product]": "scena",
      }, `scena-customer-${user.id}`);
      stripeCustomerId = String(customer.id);

      const { error: customerInsertError } = await admin
        .from("billing_customers")
        .upsert({ user_id: user.id, stripe_customer_id: stripeCustomerId }, { onConflict: "user_id", ignoreDuplicates: true });
      if (customerInsertError) throw customerInsertError;

      const { data: persistedCustomer } = await admin
        .from("billing_customers")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .single();
      stripeCustomerId = String(persistedCustomer?.stripe_customer_id || stripeCustomerId);
    }

    stage = "checkout_creation";
    const checkoutAttemptId = crypto.randomUUID();
    const commonMetadata: Record<string, string> = {
      "metadata[product]": "scena",
      "metadata[scena_user_id]": user.id,
      "metadata[offering_code]": offeringCode,
      "metadata[workspace_type]": offering.workspace_type,
      "metadata[billing_mode]": offering.billing_mode,
      "metadata[workspace_name]": workspaceName,
      "metadata[workspace_slug]": workspaceSlug,
      "metadata[checkout_attempt_id]": checkoutAttemptId,
    };

    const checkoutValues: Record<string, string> = {
      mode: offering.billing_mode === "one_time" ? "payment" : "subscription",
      customer: stripeCustomerId,
      "line_items[0][price]": offering.stripe_price_id,
      "line_items[0][quantity]": "1",
      success_url: `${appUrl}/billing/processing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      client_reference_id: user.id,
      allow_promotion_codes: "true",
      billing_address_collection: "auto",
      ...commonMetadata,
    };

    if (offering.billing_mode === "one_time") {
      checkoutValues["payment_method_types[0]"] = "card";
      checkoutValues["payment_intent_data[metadata][product]"] = "scena";
      checkoutValues["payment_intent_data[metadata][scena_user_id]"] = user.id;
      checkoutValues["payment_intent_data[metadata][offering_code]"] = offeringCode;
      checkoutValues["payment_intent_data[metadata][workspace_type]"] = offering.workspace_type;
      checkoutValues["payment_intent_data[metadata][workspace_name]"] = workspaceName;
      checkoutValues["payment_intent_data[metadata][workspace_slug]"] = workspaceSlug;
    } else {
      checkoutValues["subscription_data[metadata][product]"] = "scena";
      checkoutValues["subscription_data[metadata][scena_user_id]"] = user.id;
      checkoutValues["subscription_data[metadata][offering_code]"] = offeringCode;
      checkoutValues["subscription_data[metadata][workspace_type]"] = offering.workspace_type;
      checkoutValues["subscription_data[metadata][workspace_name]"] = workspaceName;
      checkoutValues["subscription_data[metadata][workspace_slug]"] = workspaceSlug;
    }

    const session = await stripePost(
      stripeKey,
      "/v1/checkout/sessions",
      checkoutValues,
      `scena-checkout-${checkoutAttemptId}`,
    );

    stage = "database_persistence";
    const expiresAt = typeof session.expires_at === "number"
      ? new Date(session.expires_at * 1000).toISOString()
      : null;

    const { error: checkoutInsertError } = await admin.from("checkout_sessions").insert({
      stripe_checkout_session_id: String(session.id),
      user_id: user.id,
      plan_code: offeringCode,
      workspace_type: offering.workspace_type,
      billing_mode: offering.billing_mode,
      requested_workspace_name: workspaceName,
      requested_workspace_slug: workspaceSlug,
      requested_team_name: offering.workspace_type === "team" ? workspaceName : null,
      requested_team_slug: offering.workspace_type === "team" ? workspaceSlug : null,
      stripe_customer_id: stripeCustomerId,
      status: "open",
      expires_at: expiresAt,
    });
    if (checkoutInsertError) throw checkoutInsertError;

    return json({
      checkout_url: session.url,
      checkout_session_id: session.id,
      offering_code: offeringCode,
      workspace_type: offering.workspace_type,
      billing_mode: offering.billing_mode,
      workspace_slug: workspaceSlug,
      request_id: requestId,
    }, 200);
  } catch (error) {
    const errorCode = stage === "configuration" ? "MISSING_CONFIGURATION" : "CHECKOUT_FAILED";
    console.error(JSON.stringify({
      event: "billing_checkout_failed",
      request_id: requestId,
      stage,
      error_code: errorCode,
      error_name: error instanceof Error ? error.name : "unknown",
    }));
    const status = stage === "configuration" ? 503 : 500;
    const message = stage === "configuration"
      ? "Checkout is not available right now. Try again shortly."
      : "Checkout could not be started.";
    return json({ error: { code: errorCode, message, request_id: requestId } }, status);
  }
});

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(value);
}

function generatedSlug(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const stem = (normalized || "workspace").slice(0, 48).replace(/-+$/g, "") || "workspace";
  return `${stem}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
}

async function stripePost(
  secret: string,
  path: string,
  values: Record<string, string>,
  idempotencyKey?: string,
): Promise<any> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${secret}`,
    "content-type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(values),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "Stripe request failed");
  return payload;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
