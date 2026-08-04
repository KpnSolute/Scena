// Route status metadata — used by PlaceholderPage and, later, by any
// navigation component that wants to grey out or badge unimplemented
// sections. This is a truthful inventory, not a feature flag system: it
// records what's real today, nothing more.
//
// "functional" = real domain-service calls, real data, real writes.
// "placeholder" = route exists and is reachable (deep-linkable,
//   refresh-safe), but the page body is a stated placeholder pending the
//   manager UI phase — no fake data, no fake actions.

export type RouteStatus = "functional" | "placeholder";

export interface RouteMeta {
  path: string;
  label: string;
  status: RouteStatus;
  note?: string;
}

export const ROUTE_METADATA: RouteMeta[] = [
  { path: "/app/home", label: "Home", status: "functional" },
  { path: "/app/boards", label: "Boards", status: "functional" },
  { path: "/app/boards/new", label: "New Board", status: "functional" },
  { path: "/app/boards/:boardId", label: "Board editor", status: "functional", note: "Full canvas editor: load/save/undo-redo/version-conflict recovery/revisions, all via src/services/scena-api/boards.ts. No Publish control — SCENA_UI_API_CAPABILITIES.boards.publish is false." },
  { path: "/app/assets", label: "Assets", status: "functional" },
  { path: "/app/assets/:assetId", label: "Asset detail", status: "functional" },
  { path: "/app/locations", label: "Locations", status: "functional" },
  { path: "/app/screens", label: "Displays", status: "functional" },
  { path: "/app/screens/pair", label: "Pair a display", status: "functional" },
  { path: "/app/screens/:screenId", label: "Display detail", status: "functional", note: "Rename/reassign/revoke via src/domain/screens.ts." },
  { path: "/app/sessions", label: "Sessions", status: "functional" },
  { path: "/app/sessions/new", label: "New session", status: "functional" },
  { path: "/app/sessions/:sessionId", label: "Session detail & composer", status: "functional", note: "Rename/start/stop/delete-draft, display mode, and screen assignment via src/domain/sessions.ts." },
  { path: "/app/layouts", label: "Layouts", status: "functional", note: "Create/rename/duplicate/activate-deactivate/delete via src/domain/layouts.ts. Delete is DB RESTRICT-guarded — a friendly message points to Deactivate instead of leaking the Postgres error." },
  { path: "/app/layouts/:layoutId", label: "Layout tile editor", status: "functional", note: "Percentage-based tile canvas: add/move/resize/reorder/remove tiles via src/domain/layouts.ts. Adding a tile needs an existing Scene (src/domain/scenes.ts, read-only listing) — there is no Scene-creation UI yet, so an empty Scene list shows a truthful EmptyState instead of a non-functional control." },
  { path: "/app/automations", label: "Automations", status: "functional", note: "List plus inline create/rename/enable/disable modals via src/domain/automations.ts — no separate editor routes." },
  { path: "/app/connections", label: "Connections", status: "functional", note: "Creates and rotates one-time webhook credentials and reports idempotent connected-content ingestion state." },
  { path: "/app/members", label: "Members", status: "functional", note: "Role change and remove are real (upsertMember/removeMember). No invite-by-email UI — team_invitations exists in the schema but no client function calls it yet." },
  { path: "/app/billing", label: "Billing", status: "functional", note: "Manage-billing opens the real Stripe portal; checkout creates a NEW paid Workspace (no in-place plan upgrade API exists)." },
  { path: "/app/settings", label: "Settings", status: "functional", note: "Profile fields are read-only — no update-profile API exists yet." },
  { path: "/app/settings/organization", label: "Organization settings", status: "placeholder", note: "No organization-update service exists yet — backend gap, not just UI." },
  { path: "/app/settings/plan", label: "Plan", status: "functional", note: "Read-only entitlement display." },
];
