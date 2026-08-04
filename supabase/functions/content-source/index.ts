import { adminClient } from "../_shared/adminClient.ts";
import { openWebhookSecret, sealWebhookSecret, verifyKpnSoluteWebhook } from "../_shared/kpnsoluteWebhooks.ts";

const MAX_BODY_BYTES = 262_144;
const MENU_DAY_EVENT = "com.kpnsolute.compute.menu.day.updated.v1";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-scena-source-id, webhook-id, webhook-timestamp, webhook-signature",
  "access-control-allow-methods": "POST, OPTIONS",
};

class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly code = "CONTENT_SOURCE_ERROR") { super(message); }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return respond({ code: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return respond({ code: "PAYLOAD_TOO_LARGE" }, 413);
    const body = parseObject(raw);
    const sourceId = req.headers.get("x-scena-source-id")?.trim() || new URL(req.url).searchParams.get("source_id")?.trim();
    return sourceId ? await ingest(req, sourceId, body, raw) : await manage(req, body);
  } catch (error) {
    console.error(JSON.stringify({ event: "content_source_failed", error: error instanceof Error ? error.message : "unknown" }));
    const status = error instanceof HttpError ? error.status : 400;
    const code = error instanceof HttpError ? error.code : "CONTENT_SOURCE_ERROR";
    return respond({ code, message: error instanceof Error ? error.message : "Request failed" }, status);
  }
});

async function manage(req: Request, body: Record<string, unknown>) {
  const admin = adminClient();
  const workspaceId = string(body.workspace_id, "workspace_id");
  const userId = await requireEditor(admin, req, workspaceId);
  const action = string(body.action, "action");

  if (action === "list") {
    const { data, error } = await admin.from("content_sources")
      .select("id, workspace_id, name, source_type, protocol, status, accepted_event_type, external_tenant_id, kpn_subscription_id, current_event_id, current_event_type, current_version, last_received_at, created_at, updated_at")
      .eq("workspace_id", workspaceId).order("created_at");
    if (error) throw error;
    return respond({ sources: data ?? [] });
  }

  if (action === "create_kpnsolute") {
    const tenantId = string(body.tenant_id, "tenant_id");
    const legacySecret = `scn_whk_${randomToken(32)}`;
    const { data: source, error } = await admin.from("content_sources").insert({
      workspace_id: workspaceId,
      name: string(body.name, "name"),
      protocol: "kpnsolute-events-v1",
      accepted_event_type: MENU_DAY_EVENT,
      external_tenant_id: tenantId,
      secret_hash: await sha256(legacySecret),
      created_by: userId,
    }).select("id, name, protocol, accepted_event_type, external_tenant_id").single();
    if (error) throw error;
    let registration: Awaited<ReturnType<typeof registerKpnEndpoint>> | undefined;
    try {
      registration = await registerKpnEndpoint(source.id, tenantId);
      const { error: updateError } = await admin.from("content_sources").update({
        kpn_subscription_id: registration.subscription_id,
        signing_secret_ciphertext: await sealWebhookSecret(registration.signing_secret, requiredEnv("CONNECTED_CONTENT_ENCRYPTION_KEY")),
        updated_at: new Date().toISOString(),
      }).eq("id", source.id);
      if (updateError) throw updateError;
      return respond({ source: { ...source, kpn_subscription_id: registration.subscription_id }, connected: true }, 201);
    } catch (error) {
      if (registration) {
        await deleteKpnEndpoint(registration.subscription_id, tenantId).catch((cleanupError) => {
          console.warn(JSON.stringify({ event: "kpnsolute_subscription_cleanup_failed", source_id: source.id, error: cleanupError instanceof Error ? cleanupError.message : "unknown" }));
        });
      }
      await admin.from("content_sources").delete().eq("id", source.id);
      throw error;
    }
  }

  if (action === "create") {
    const secret = `scn_whk_${randomToken(32)}`;
    const { data, error } = await admin.from("content_sources").insert({ workspace_id: workspaceId, name: string(body.name, "name"), accepted_event_type: typeof body.event_type === "string" ? body.event_type : "menu.updated", secret_hash: await sha256(secret), created_by: userId }).select("id, name, protocol, accepted_event_type").single();
    if (error) throw error;
    return respond({ source: data, credential: webhookCredential(data.id, secret) }, 201);
  }

  const sourceId = string(body.source_id, "source_id");
  const { data: source, error: sourceError } = await admin.from("content_sources")
    .select("id, protocol, external_tenant_id, kpn_subscription_id, status")
    .eq("workspace_id", workspaceId).eq("id", sourceId).maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) throw new HttpError(404, "Connection not found", "NOT_FOUND");

  if (action === "rotate") {
    if (source.protocol === "kpnsolute-events-v1") {
      const rotation = await rotateKpnEndpoint(string(source.kpn_subscription_id, "subscription_id"), string(source.external_tenant_id, "tenant_id"));
      const { error } = await admin.from("content_sources").update({
        signing_secret_ciphertext: await sealWebhookSecret(rotation.signing_secret, requiredEnv("CONNECTED_CONTENT_ENCRYPTION_KEY")),
        updated_at: new Date().toISOString(),
      }).eq("id", sourceId);
      if (error) throw error;
      return respond({ source_id: sourceId, rotated: true, protocol: source.protocol });
    }
    const secret = `scn_whk_${randomToken(32)}`;
    const { data, error } = await admin.from("content_sources").update({ secret_hash: await sha256(secret), updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("id", sourceId).eq("status", "active").select("id").single();
    if (error) throw error;
    return respond({ source_id: data.id, credential: webhookCredential(data.id, secret) });
  }

  if (action === "archive") {
    if (source.protocol === "kpnsolute-events-v1" && source.kpn_subscription_id && source.external_tenant_id) {
      await deleteKpnEndpoint(String(source.kpn_subscription_id), String(source.external_tenant_id)).catch((cleanupError) => {
        console.warn(JSON.stringify({ event: "kpnsolute_subscription_archive_cleanup_failed", source_id: sourceId, error: cleanupError instanceof Error ? cleanupError.message : "unknown" }));
      });
    }
    const { error } = await admin.from("content_sources").update({ status: "archived", updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("id", sourceId);
    if (error) throw error;
    return respond({ source_id: sourceId, status: "archived" });
  }
  return respond({ code: "UNKNOWN_ACTION" }, 400);
}

async function ingest(req: Request, sourceId: string, body: Record<string, unknown>, rawBody: string) {
  const admin = adminClient();
  const { data: source, error } = await admin.from("content_sources")
    .select("id, secret_hash, protocol, signing_secret_ciphertext, external_tenant_id, status, accepted_event_type")
    .eq("id", sourceId).maybeSingle();
  if (error) throw error;
  if (!source) throw new HttpError(404, "Connection not found", "NOT_FOUND");
  if (source.status !== "active") throw new HttpError(410, "Connection is archived", "CONNECTION_GONE");

  let eventId: string;
  let eventType: string;
  let occurredAt: string;
  let payload: Record<string, unknown>;

  if (source.protocol === "kpnsolute-events-v1") {
    const encrypted = string(source.signing_secret_ciphertext, "signing_secret_ciphertext");
    const signingSecret = await openWebhookSecret(encrypted, requiredEnv("CONNECTED_CONTENT_ENCRYPTION_KEY"));
    const verdict = await verifyKpnSoluteWebhook(signingSecret, req.headers, rawBody);
    if (!verdict.ok) throw new HttpError(401, verdict.reason ?? "Invalid webhook signature", "UNAUTHENTICATED");
    if (body.specversion !== "1.0") throw new HttpError(422, "Unsupported CloudEvents version", "INVALID_EVENT");
    if (string(body.tenantid, "tenantid") !== source.external_tenant_id) throw new HttpError(403, "Tenant does not match this Connection", "TENANT_MISMATCH");
    eventId = string(req.headers.get("webhook-id"), "webhook-id");
    eventType = string(body.type, "type");
    occurredAt = string(body.time, "time");
    payload = normalizeMenuDay(object(body.data, "data"));
  } else {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token || !secureEqual(await sha256(token), String(source.secret_hash))) throw new HttpError(401, "Invalid credential", "UNAUTHENTICATED");
    eventId = string(body.event_id, "event_id");
    eventType = string(body.event_type, "event_type");
    occurredAt = string(body.occurred_at, "occurred_at");
    payload = object(body.data, "data");
  }

  if (eventType !== source.accepted_event_type) throw new HttpError(422, "Event type is not accepted", "EVENT_TYPE_NOT_ACCEPTED");
  if (!Number.isFinite(Date.parse(occurredAt))) throw new HttpError(422, "Event timestamp is invalid", "INVALID_OCCURRED_AT");
  const { data: committed, error: commitError } = await admin.rpc("commit_content_source_event", { target_source_id: sourceId, target_event_id: eventId, target_event_type: eventType, target_occurred_at: occurredAt, target_payload: payload });
  if (commitError) throw commitError;
  return respond({ accepted: true, duplicate: Boolean(committed?.[0]?.duplicate), version: Number(committed?.[0]?.version ?? 0) }, 202);
}

function normalizeMenuDay(data: Record<string, unknown>) {
  const meals = object(data.meals, "menu day meals");
  const sections = Object.entries(meals).map(([title, rawItems]) => ({
    title,
    items: Array.isArray(rawItems) ? rawItems.map((rawItem) => {
      const item = object(rawItem, `${title} item`);
      return { name: string(item.item_name, "item_name"), slot: typeof item.slot_name === "string" ? item.slot_name : null };
    }) : [],
  }));
  return {
    ...data,
    menu: {
      title: `${typeof data.day_of_week === "string" ? data.day_of_week : "Today"} Menu`,
      date: typeof data.date === "string" ? data.date : null,
      sections,
    },
  };
}

async function registerKpnEndpoint(sourceId: string, tenantId: string) {
  const response = await fetch(`${eventsUrl()}/v1/subscriptions`, {
    method: "POST",
    headers: { "authorization": `Bearer ${consumerKey(tenantId)}`, "content-type": "application/json" },
    body: JSON.stringify({ target_url: webhookTargetUrl(sourceId), event_types: [MENU_DAY_EVENT] }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status !== 201 || typeof body.subscription_id !== "string" || typeof body.signing_secret !== "string") {
    throw new Error(`KpnSolute Events registration failed: HTTP ${response.status}`);
  }
  return { subscription_id: body.subscription_id as string, signing_secret: body.signing_secret as string };
}

async function rotateKpnEndpoint(subscriptionId: string, tenantId: string) {
  const response = await fetch(`${eventsUrl()}/v1/subscriptions/${encodeURIComponent(subscriptionId)}/rotate`, {
    method: "POST", headers: { "authorization": `Bearer ${consumerKey(tenantId)}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.signing_secret !== "string") throw new Error(`KpnSolute Events rotation failed: HTTP ${response.status}`);
  return { signing_secret: body.signing_secret as string };
}

async function deleteKpnEndpoint(subscriptionId: string, tenantId: string) {
  const response = await fetch(`${eventsUrl()}/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "DELETE", headers: { "authorization": `Bearer ${consumerKey(tenantId)}` },
  });
  if (!response.ok && response.status !== 404) throw new Error(`KpnSolute Events endpoint removal failed: HTTP ${response.status}`);
}

function eventsUrl() { return requiredEnv("KPNSOLUTE_EVENTS_URL").replace(/\/$/, ""); }
function webhookTargetUrl(sourceId: string) { return `${requiredEnv("SUPABASE_URL")}/functions/v1/content-source?source_id=${encodeURIComponent(sourceId)}`; }
function consumerKey(tenantId: string) {
  const mapping = object(JSON.parse(requiredEnv("KPNSOLUTE_EVENTS_CONSUMER_KEYS")), "KPNSOLUTE_EVENTS_CONSUMER_KEYS");
  return string(mapping[tenantId], `consumer key for ${tenantId}`);
}
function requiredEnv(name: string) { const value = Deno.env.get(name)?.trim(); if (!value) throw new Error(`Missing ${name}`); return value; }

async function requireEditor(admin: ReturnType<typeof adminClient>, req: Request, workspaceId: string): Promise<string> {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const { data: auth, error } = await admin.auth.getUser(jwt);
  if (error || !auth.user) throw new HttpError(401, "Sign in is required", "UNAUTHENTICATED");
  const { data: member } = await admin.from("organization_members").select("role").eq("org_id", workspaceId).eq("user_id", auth.user.id).maybeSingle();
  if (!member || !["owner", "admin", "operator", "designer"].includes(String(member.role))) throw new HttpError(403, "Editor access is required", "FORBIDDEN");
  return auth.user.id;
}

function webhookCredential(sourceId: string, secret: string) { return { url: webhookTargetUrl(sourceId), source_id: sourceId, secret, headers: { "x-scena-source-id": sourceId, authorization: `Bearer ${secret}` }, event_shape: { event_id: "unique-event-id", event_type: "menu.updated", occurred_at: new Date().toISOString(), data: { menu: { title: "Today’s Menu", sections: [] } } } }; }
function parseObject(raw: string) { try { return object(JSON.parse(raw), "body"); } catch { throw new HttpError(400, "A JSON object body is required", "INVALID_JSON"); } }
function object(value: unknown, name: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(422, `${name} must be an object`, "INVALID_INPUT"); return value as Record<string, unknown>; }
function string(value: unknown, name: string): string { if (typeof value !== "string" || !value.trim()) throw new HttpError(422, `${name} is required`, "INVALID_INPUT"); return value.trim(); }
function randomToken(bytes: number) { const data = crypto.getRandomValues(new Uint8Array(bytes)); return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
async function sha256(value: string) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function secureEqual(a: string, b: string) { if (a.length !== b.length) return false; let result = 0; for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; }
function respond(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } }); }
