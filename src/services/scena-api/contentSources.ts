import { supabaseUrl } from "../supabase/client";
import { callScenaFunction } from "./client";

export interface ContentSource {
  id: string; workspace_id: string; name: string; source_type: "webhook"; protocol: "legacy" | "kpnsolute-events-v1"; status: "active" | "archived"; accepted_event_type: string;
  accepted_event_types: string[];
  external_tenant_id: string | null; kpn_subscription_id: string | null;
  current_event_id: string | null; current_event_type: string | null; current_version: number; last_received_at: string | null;
}
export interface ContentSourceSnapshot extends ContentSource {
  current_payload: Record<string, unknown>;
  updated_at: string;
}
export interface WebhookCredential { url: string; source_id: string; secret: string; headers: Record<string, string>; event_shape: Record<string, unknown>; }

export async function listContentSources(workspaceId: string): Promise<ContentSource[]> {
  const result = await callScenaFunction<{ sources: ContentSource[] }>("content-source", { action: "list", workspace_id: workspaceId });
  return result.sources;
}
export function createContentSource(workspaceId: string, name: string, eventType = "content.updated") {
  return callScenaFunction<{ source: Pick<ContentSource, "id" | "name" | "accepted_event_type">; credential: WebhookCredential }>("content-source", { action: "create", workspace_id: workspaceId, name, event_type: eventType });
}
export function createKpnSoluteContentSource(workspaceId: string, name: string, tenantId: string) {
  return callScenaFunction<{ source: Pick<ContentSource, "id" | "name" | "protocol" | "accepted_event_type" | "external_tenant_id" | "kpn_subscription_id">; connected: true; bootstrap: { ok: boolean; version?: number; received_at?: string; code?: string } }>("content-source", { action: "create_kpnsolute", workspace_id: workspaceId, name, tenant_id: tenantId });
}
export function contentSourceWebhookUrl(sourceId: string): string | null {
  return supabaseUrl
    ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/content-source?source_id=${encodeURIComponent(sourceId)}`
    : null;
}
export function getContentSourceSnapshot(workspaceId: string, sourceId: string) {
  return callScenaFunction<{ source: ContentSourceSnapshot; freshness: "available" | "awaiting_first_snapshot" }>("content-source", { action: "get", workspace_id: workspaceId, source_id: sourceId });
}
export function refreshKpnSoluteContentSource(workspaceId: string, sourceId: string) {
  return callScenaFunction<{ source_id: string; refreshed: true; event_id: string; version: number; received_at: string }>("content-source", { action: "refresh", workspace_id: workspaceId, source_id: sourceId });
}
export function rotateContentSource(workspaceId: string, sourceId: string) {
  return callScenaFunction<{ source_id: string; rotated?: boolean; protocol?: ContentSource["protocol"]; credential?: WebhookCredential }>("content-source", { action: "rotate", workspace_id: workspaceId, source_id: sourceId });
}
