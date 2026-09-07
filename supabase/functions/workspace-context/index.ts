import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import { capacityMetric } from "./capacity.ts";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

type Context = {
  userId: string;
  email: string | null;
  admin: SupabaseClient;
  scoped: SupabaseClient;
};

type Workspace = {
  id: string;
  name: string;
  slug: string;
  type: "personal" | "team";
  owner_user_id: string;
  provisioning_kind: string;
  status: "active";
  role: string;
  joined_at: string;
  entitlements: Record<string, unknown>;
  usage: Record<string, unknown>;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return error("METHOD_NOT_ALLOWED", "POST required.", 405);
  }

  const requestId = crypto.randomUUID();

  try {
    const context = await authenticate(req);
    const body = await req.json() as Record<string, unknown>;
    const action = text(body.action);

    if (action === "get") {
      return json(await loadContext(context, null, requestId));
    }

    if (action === "select") {
      const workspaceId = uuid(body.workspace_id, "workspace_id");
      return json(await loadContext(context, workspaceId, requestId));
    }

    return error("VALIDATION_FAILED", "Unknown action.", 400, requestId);
  } catch (cause) {
    console.error(JSON.stringify({
      event: "workspace_context_failed",
      request_id: requestId,
      error_name: cause instanceof Error ? cause.name : "unknown",
      error_message: cause instanceof Error ? cause.message : "unknown",
    }));
    return mapError(cause, requestId);
  }
});

async function loadContext(
  context: Context,
  requestedWorkspaceId: string | null,
  requestId: string,
): Promise<Record<string, unknown>> {
  const profile = await loadProfile(context);

  let workspaces = await loadWorkspaces(
    context.admin,
    context.scoped,
    context.userId,
  );
  if (workspaces.length === 0) {
    const { error: provisionError } = await context.admin.rpc(
      "provision_initial_personal_workspace",
      {
        p_user_id: context.userId,
        p_display_name: profile.display_name,
      },
    );
    if (provisionError) {
      throw new Error(
        `Personal Workspace provisioning failed: ${provisionError.message}`,
      );
    }
    workspaces = await loadWorkspaces(
      context.admin,
      context.scoped,
      context.userId,
    );
  }

  if (workspaces.length === 0) {
    throw new HttpError(
      "WORKSPACE_REQUIRED",
      "Your Personal Workspace is still being prepared.",
      409,
    );
  }

  const { data: preferences, error: preferencesError } = await context.admin
    .from("user_preferences")
    .select("last_org_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (preferencesError) {
    throw new Error(`preferences lookup failed: ${preferencesError.message}`);
  }

  const preferredId = requestedWorkspaceId ??
    String(preferences?.last_org_id ?? "");
  const selected =
    workspaces.find((workspace) => workspace.id === preferredId) ??
      workspaces.find((workspace) => workspace.type === "personal") ??
      workspaces[0];

  if (requestedWorkspaceId && selected.id !== requestedWorkspaceId) {
    throw new HttpError(
      "WORKSPACE_ACCESS_DENIED",
      "Workspace membership is required.",
      403,
    );
  }

  if (String(preferences?.last_org_id ?? "") !== selected.id) {
    const { error: preferenceUpdateError } = await context.admin
      .from("user_preferences")
      .upsert(
        {
          user_id: context.userId,
          last_org_id: selected.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (preferenceUpdateError) {
      throw new Error(
        `Workspace preference update failed: ${preferenceUpdateError.message}`,
      );
    }
  }

  return {
    user_id: context.userId,
    email: context.email,
    profile,
    workspaces,
    selected_workspace_id: selected.id,
    selected_workspace: selected,
    request_id: requestId,
  };
}

async function loadProfile(context: Context): Promise<Record<string, unknown>> {
  const { data, error: profileError } = await context.admin
    .from("profiles")
    .select("display_name,avatar_url,onboarding_state,timezone")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (profileError) {
    throw new Error(`profile lookup failed: ${profileError.message}`);
  }
  if (!data) {
    throw new HttpError(
      "ACCOUNT_PROFILE_REQUIRED",
      "Your account profile is still being set up.",
      409,
    );
  }
  return data;
}

async function loadWorkspaces(
  admin: SupabaseClient,
  scoped: SupabaseClient,
  userId: string,
): Promise<Workspace[]> {
  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("org_id,role,joined_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });
  if (membershipError) {
    throw new Error(`membership lookup failed: ${membershipError.message}`);
  }

  const workspaceIds = [
    ...new Set(
      (memberships ?? []).map((membership) => String(membership.org_id)),
    ),
  ];
  if (workspaceIds.length === 0) return [];

  const [
    { data: organizations, error: organizationError },
    { data: entitlements, error: entitlementError },
    { data: usage, error: usageError },
  ] = await Promise.all([
    admin
      .from("organizations")
      .select(
        "id,name,slug,workspace_type,owner_user_id,provisioning_kind,status",
      )
      .in("id", workspaceIds)
      .eq("status", "active"),
    scoped
      .from("workspace_effective_entitlements")
      .select(
        "org_id,plan_code,max_displays,max_boards,max_members,max_concurrent_sessions,max_displays_per_session,max_asset_uploads_per_month,automation_tier,allow_display_groups,allow_session_groups,allow_resource_access_controls,allow_session_templates,allow_operational_notifications,max_display_groups,max_displays_per_display_group,max_session_groups,max_sessions_per_session_group,max_displays_per_session_group,health_retention_days,history_retention_days,has_override",
      )
      .in("org_id", workspaceIds),
    scoped
      .from("workspace_usage_current")
      .select(
        "org_id,displays_used,boards_used,members_used,active_sessions_used,asset_uploads_this_month,quota_month,content_sources_used",
      )
      .in("org_id", workspaceIds),
  ]);

  if (organizationError) {
    throw new Error(`Workspace lookup failed: ${organizationError.message}`);
  }
  if (entitlementError) {
    throw new Error(`entitlement lookup failed: ${entitlementError.message}`);
  }
  if (usageError) throw new Error(`usage lookup failed: ${usageError.message}`);

  const organizationMap = new Map(
    (organizations ?? []).map((workspace) => [String(workspace.id), workspace]),
  );
  const entitlementMap = new Map(
    (entitlements ?? []).map((value) => [String(value.org_id), value]),
  );
  const usageMap = new Map(
    (usage ?? []).map((value) => [String(value.org_id), value]),
  );

  return (memberships ?? []).flatMap((membership) => {
    const id = String(membership.org_id);
    const workspace = organizationMap.get(id);
    const entitlement = entitlementMap.get(id);
    const currentUsage = usageMap.get(id);
    if (!workspace || !entitlement || !currentUsage) return [];

    const workspaceType = String(workspace.workspace_type);
    if (workspaceType !== "personal" && workspaceType !== "team") return [];

    return [
      {
        id,
        name: String(workspace.name),
        slug: String(workspace.slug),
        type: workspaceType,
        owner_user_id: String(workspace.owner_user_id),
        provisioning_kind: String(workspace.provisioning_kind),
        status: "active",
        role: String(membership.role),
        joined_at: String(membership.joined_at),
        entitlements: {
          plan_code: entitlement.plan_code,
          max_displays: entitlement.max_displays,
          max_boards: entitlement.max_boards,
          max_members: entitlement.max_members,
          max_concurrent_sessions: entitlement.max_concurrent_sessions,
          max_displays_per_session: entitlement.max_displays_per_session,
          max_asset_uploads_per_month: entitlement.max_asset_uploads_per_month,
          automation_tier: entitlement.automation_tier,
          allow_display_groups: entitlement.allow_display_groups,
          allow_session_groups: entitlement.allow_session_groups,
          allow_resource_access_controls:
            entitlement.allow_resource_access_controls,
          allow_session_templates: entitlement.allow_session_templates,
          allow_operational_notifications:
            entitlement.allow_operational_notifications,
          max_display_groups: entitlement.max_display_groups,
          max_displays_per_display_group:
            entitlement.max_displays_per_display_group,
          max_session_groups: entitlement.max_session_groups,
          max_sessions_per_session_group:
            entitlement.max_sessions_per_session_group,
          max_displays_per_session_group:
            entitlement.max_displays_per_session_group,
          health_retention_days: entitlement.health_retention_days,
          history_retention_days: entitlement.history_retention_days,
          has_override: entitlement.has_override,
        },
        usage: {
          quota_month: currentUsage.quota_month,
          resources: {
            displays: capacityMetric(
              currentUsage.displays_used,
              entitlement.max_displays,
            ),
            boards: capacityMetric(
              currentUsage.boards_used,
              entitlement.max_boards,
            ),
            members: capacityMetric(
              currentUsage.members_used,
              entitlement.max_members,
            ),
            concurrent_sessions: capacityMetric(
              currentUsage.active_sessions_used,
              entitlement.max_concurrent_sessions,
            ),
            asset_uploads_this_month: capacityMetric(
              currentUsage.asset_uploads_this_month,
              entitlement.max_asset_uploads_per_month,
            ),
            content_sources: capacityMetric(
              currentUsage.content_sources_used,
              null,
            ),
          },
        },
      } satisfies Workspace,
    ];
  });
}

async function authenticate(req: Request): Promise<Context> {
  const authorization = req.headers.get("authorization") ?? "";
  const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new HttpError("UNAUTHENTICATED", "Sign in is required.", 401);

  const admin = createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !data.user) {
    throw new HttpError("UNAUTHENTICATED", "Sign in is required.", 401);
  }

  const scoped = createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_ANON_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { authorization: `Bearer ${jwt}` } },
    },
  );

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    admin,
    scoped,
  };
}

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uuid(value: unknown, field: string): string {
  const parsed = text(value);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(parsed)
  ) {
    throw new HttpError("VALIDATION_FAILED", `${field} must be a UUID.`, 400);
  }
  return parsed;
}

class HttpError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

function mapError(cause: unknown, requestId: string): Response {
  if (cause instanceof HttpError) {
    return error(cause.code, cause.message, cause.status, requestId);
  }
  return error(
    "INTERNAL_ERROR",
    "The Workspace context could not be loaded.",
    500,
    requestId,
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function error(
  code: string,
  message: string,
  status: number,
  requestId?: string,
): Response {
  return json({
    error: {
      code,
      message,
      ...(requestId ? { request_id: requestId } : {}),
    },
  }, status);
}
