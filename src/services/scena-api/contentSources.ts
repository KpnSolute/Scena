import { callScenaFunction } from "./client";

export interface ContentSource {
  id: string; workspace_id: string; name: string; protocol: "legacy" | "kpnsolute-events-v1"; status: "active" | "archived"; accepted_event_type: string;
  external_tenant_id: string | null; kpn_subscription_id: string | null;
  current_event_id: string | null; current_event_type: string | null; current_version: number; last_received_at: string | null;
}
export interface WebhookCredential { url: string; source_id: string; secret: string; headers: Record<string, string>; event_shape: Record<string, unknown>; }

export async function listContentSources(workspaceId: string): Promise<ContentSource[]> {
  const result = await callScenaFunction<{ sources: ContentSource[] }>("content-source", { action: "list", workspace_id: workspaceId });
  return result.sources;
}
export function createContentSource(workspaceId: string, name: string, eventType = "menu.updated") {
  return callScenaFunction<{ source: Pick<ContentSource, "id" | "name" | "accepted_event_type">; credential: WebhookCredential }>("content-source", { action: "create", workspace_id: workspaceId, name, event_type: eventType });
}
export function createKpnSoluteContentSource(workspaceId: string, name: string, tenantId: string) {
  return callScenaFunction<{ source: Pick<ContentSource, "id" | "name" | "protocol" | "accepted_event_type" | "external_tenant_id" | "kpn_subscription_id">; connected: true }>("content-source", { action: "create_kpnsolute", workspace_id: workspaceId, name, tenant_id: tenantId });
}
export function rotateContentSource(workspaceId: string, sourceId: string) {
  return callScenaFunction<{ source_id: string; rotated?: boolean; protocol?: ContentSource["protocol"]; credential?: WebhookCredential }>("content-source", { action: "rotate", workspace_id: workspaceId, source_id: sourceId });
}
