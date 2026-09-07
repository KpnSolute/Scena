import type { Role } from "../../shared/validation";
import { callScenaFunction } from "./client";

export type WorkspaceType = "personal" | "team";

export interface WorkspaceEntitlements {
  plan_code: string;
  max_displays: number;
  max_boards: number;
  max_members: number;
  max_concurrent_sessions: number;
  max_displays_per_session: number;
  max_asset_uploads_per_month: number | null;
  automation_tier: string;
  allow_display_groups: boolean;
  allow_session_groups: boolean;
  allow_resource_access_controls: boolean;
  allow_session_templates: boolean;
  allow_operational_notifications: boolean;
  max_display_groups: number;
  max_displays_per_display_group: number;
  max_session_groups: number;
  max_sessions_per_session_group: number;
  max_displays_per_session_group: number;
  health_retention_days: number;
  history_retention_days: number;
  has_override: boolean;
}

export interface WorkspaceCapacityMetric {
  used: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
}

export interface WorkspaceUsage {
  quota_month: string;
  resources: {
    displays: WorkspaceCapacityMetric;
    boards: WorkspaceCapacityMetric;
    members: WorkspaceCapacityMetric;
    concurrent_sessions: WorkspaceCapacityMetric;
    asset_uploads_this_month: WorkspaceCapacityMetric;
    content_sources: WorkspaceCapacityMetric;
  };
}

export interface AuthorizedWorkspace {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  owner_user_id: string;
  provisioning_kind: string;
  status: "active";
  role: Role;
  joined_at: string;
  entitlements: WorkspaceEntitlements;
  usage: WorkspaceUsage;
}

export interface WorkspaceAccountProfile {
  displayName: string;
  avatarUrl: string | null;
  onboardingState: string;
  timezone: string;
}

export interface WorkspaceContextResponse {
  user_id: string;
  profile: {
    display_name: string;
    avatar_url: string | null;
    onboarding_state: string;
    timezone: string;
  };
  workspaces: AuthorizedWorkspace[];
  selected_workspace_id: string | null;
  selected_workspace: AuthorizedWorkspace | null;
  request_id: string;
}

export async function getWorkspaceContext(
  signal?: AbortSignal,
): Promise<WorkspaceContextResponse> {
  return callScenaFunction(
    "workspace-context",
    { action: "get" },
    { signal },
  );
}

export async function selectWorkspace(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<WorkspaceContextResponse> {
  return callScenaFunction(
    "workspace-context",
    {
      action: "select",
      workspace_id: workspaceId,
    },
    { signal },
  );
}

export function toWorkspaceAccountProfile(
  response: WorkspaceContextResponse,
): WorkspaceAccountProfile {
  return {
    displayName: response.profile.display_name,
    avatarUrl: response.profile.avatar_url,
    onboardingState: response.profile.onboarding_state,
    timezone: response.profile.timezone,
  };
}
