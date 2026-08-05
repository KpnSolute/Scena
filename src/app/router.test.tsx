// DOM-rendering routing tests — everything that can be verified without
// a live in-DOM redirect (react-router-dom v7's data-router navigation
// internals hit a real Node 24 + jsdom AbortController incompatibility
// in this sandbox; see src/app/authDecisions.test.ts for full coverage
// of every redirect DECISION via the same pure functions the components
// below call, and docs/api-inventory.json / the release report for the
// full explanation). What's covered here: direct rendering of an
// already-resolved route (no navigation in flight), 404s, kiosk
// behavior, manager/kiosk isolation, legacy hash conversion, and a
// render-time (non-navigation) error boundary.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { routeTree } from "./router";
import { convertLegacyKioskHash } from "./legacyKioskRedirect";
import { ToastProvider } from "../components/ui/Toast";

// ---- shared mocks ----------------------------------------------------

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }));

vi.mock("../services/supabase/client", () => ({
  supabase: {
    auth: { getSession: () => mockGetSession(), onAuthStateChange: () => mockOnAuthStateChange() },
    channel: () => ({ on: () => ({ subscribe: (cb?: (s: string) => void) => { cb?.("SUBSCRIBED"); return {}; } }) }),
    removeChannel: vi.fn(),
  },
  requireSupabase: () => { throw new Error("requireSupabase should not be called in these routing tests"); },
  callEdgeFunction: vi.fn(),
}));

const mockLoadAccountContext = vi.fn();
vi.mock("../auth/organization-context", async (importActual) => {
  const actual = await importActual<typeof import("../auth/organization-context")>();
  return { ...actual, loadAccountContext: () => mockLoadAccountContext() };
});

// Lets one test force a synchronous render-time throw from inside the
// guarded subtree (AppShellRoute and every nested page read context via
// this hook) without depending on a page-specific domain call, since which
// domain calls a given page happens to make is an implementation detail.
let forceManagerContextThrow = false;
vi.mock("./ManagerContextProvider", async (importActual) => {
  const actual = await importActual<typeof import("./ManagerContextProvider")>();
  return {
    ...actual,
    useManagerContext: () => {
      if (forceManagerContextThrow) throw new Error("simulated render-time failure");
      return actual.useManagerContext();
    },
  };
});

vi.mock("../domain/locations", () => ({ listLocations: vi.fn().mockResolvedValue([]), createLocation: vi.fn() }));
vi.mock("../domain/layouts", () => ({ listLayouts: vi.fn().mockResolvedValue([]), createLayout: vi.fn() }));
vi.mock("../domain/screens", () => ({
  listScreens: vi.fn().mockResolvedValue([]),
  listAvailableScreens: vi.fn().mockResolvedValue([]),
  getScreen: vi.fn().mockResolvedValue(null),
}));
vi.mock("../domain/sessions", () => ({
  listSessions: vi.fn().mockResolvedValue([]),
  getSession: vi.fn().mockResolvedValue(null),
  createDraftSession: vi.fn(),
  startSession: vi.fn(),
  stopSession: vi.fn(),
}));
vi.mock("../domain/automations", () => ({ listAutomations: vi.fn().mockResolvedValue([]) }));
vi.mock("../domain/organizations", () => ({
  getEntitlement: vi.fn().mockResolvedValue(null),
  listMembers: vi.fn().mockResolvedValue([]),
  upsertMember: vi.fn(),
  removeMember: vi.fn(),
}));
vi.mock("../domain/dashboard", () => ({
  getDashboardSummary: vi.fn().mockResolvedValue({ board_count: 0, asset_count: 0, display_count: 0, displays_online: 0, plan: null }),
}));
vi.mock("../services/scena-api/boards", () => ({
  listBoards: vi.fn().mockResolvedValue({ boards: [], request_id: "req-test" }),
  archiveBoard: vi.fn(),
}));
vi.mock("../services/scena-api/assets", () => ({
  listAssets: vi.fn().mockResolvedValue({ assets: [], request_id: "req-test" }),
}));

const mockStoredToken = vi.fn();
const mockRegisterDevice = vi.fn();
const mockPollState = vi.fn();
vi.mock("../lib/display", () => ({
  storedToken: () => mockStoredToken(),
  forgetDevice: vi.fn(),
  registerDevice: () => mockRegisterDevice(),
  pollState: (...args: unknown[]) => mockPollState(...args),
  subscribeToOrgInvalidation: () => () => {},
  readCachedDisplayState: () => null,
}));

const AUTHENTICATED_ACCOUNT = {
  userId: "user-1",
  profile: { displayName: "Ada", avatarUrl: null, onboardingState: "complete" },
  team: { id: "org-1", name: "Acme", slug: "acme", status: "active" as const, role: "owner" as const },
};

// Mirrors main.tsx, which mounts RouterProvider inside ToastProvider —
// pages may call useToast() during render.
function renderAt(initialPath: string) {
  const router = createMemoryRouter(routeTree, { initialEntries: [initialPath] });
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.clearAllMocks();
  forceManagerContextThrow = false;
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockStoredToken.mockReturnValue(null);
  mockRegisterDevice.mockResolvedValue({ code: "123456", expires_in: 1800 });
});

// ---- /login direct render (no redirect needed) ---------------------------

describe("/login", () => {
  it("shows the sign-in card when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    renderAt("/login");
    await waitFor(() => expect(screen.getByText("Continue with Google")).toBeInTheDocument());
  });
});

// ---- ManagerGuard: the one non-redirecting outcome -------------------------

describe("ManagerGuard", () => {
  it("renders the guarded subtree once context resolves (no redirect involved)", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadAccountContext.mockResolvedValue(AUTHENTICATED_ACCOUNT);
    renderAt("/app/home");
    await waitFor(() => expect(screen.getByText(/What will you build today/)).toBeInTheDocument());
  });
});

// ---- direct navigation / refresh-safety ------------------------------------

describe("direct navigation to nested manager routes", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadAccountContext.mockResolvedValue(AUTHENTICATED_ACCOUNT);
  });

  it("renders /app/locations directly, without visiting /app/home first", async () => {
    renderAt("/app/locations");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Locations" })).toBeInTheDocument());
  });

  it("renders the one remaining placeholder route directly (/app/settings/organization)", async () => {
    renderAt("/app/settings/organization");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Organization settings" })).toBeInTheDocument());
    expect(screen.getByText(/not implemented yet/)).toBeInTheDocument();
  });

  it("renders a deep parameterized route directly, refresh-safe (/app/screens/:screenId)", async () => {
    renderAt("/app/screens/screen-abc-123");
    await waitFor(() => expect(screen.getByText("Display not found")).toBeInTheDocument());
  });

  it("offers both remote-screen and current-device paths on Display pairing", async () => {
    renderAt("/app/screens/pair");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Pair a Display" })).toBeInTheDocument());
    const currentDevice = screen.getByRole("link", { name: /Open player on this device/ });
    expect(currentDevice).toHaveAttribute("href", "/display");
    expect(currentDevice).toHaveAttribute("target", "_blank");
    expect(screen.getByText(`${window.location.origin}/display`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });
});

// ---- 404s -----------------------------------------------------------------

describe("unknown routes", () => {
  it("shows not-found with a home link for an unknown /app path", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadAccountContext.mockResolvedValue(AUTHENTICATED_ACCOUNT);
    renderAt("/app/this-does-not-exist");
    await waitFor(() => expect(screen.getByText("Page not found")).toBeInTheDocument());
    expect(screen.getByText("Back to home")).toBeInTheDocument();
  });

  it("shows not-found with a Scena link for an unknown global path", async () => {
    renderAt("/this-does-not-exist");
    await waitFor(() => expect(screen.getByText("Page not found")).toBeInTheDocument());
    expect(screen.getByText("Back to Scena")).toBeInTheDocument();
  });
});

// ---- kiosk ------------------------------------------------------------

describe("/display", () => {
  it("loads the kiosk and shows a pairing code with no session, no manager shell", async () => {
    mockStoredToken.mockReturnValue(null);
    renderAt("/display");
    await waitFor(() => expect(screen.getByText("123456")).toBeInTheDocument());
    expect(screen.queryByText("Sign in to Scena")).not.toBeInTheDocument();
    expect(screen.queryByText(/Tenant/)).not.toBeInTheDocument();
    // The guard's session check must never be invoked on the kiosk path.
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("polls display-gateway once a device token exists", async () => {
    mockStoredToken.mockReturnValue("existing-device-token");
    mockPollState.mockResolvedValue({ state: { status: "standby", screen_name: "Front Counter", org_id: "org-1" }, fromCache: false });
    renderAt("/display");
    await waitFor(() => expect(screen.getByText(/standby/)).toBeInTheDocument());
    expect(mockPollState).toHaveBeenCalledWith(expect.objectContaining({
      cache_source: "live",
      poll_error_count: 0,
      uptime_seconds: expect.any(Number),
    }));
  });

  it("keeps the player surface clean even when an old debug URL is opened", async () => {
    mockStoredToken.mockReturnValue("existing-device-token");
    mockPollState.mockResolvedValue({ state: { status: "standby", screen_name: "Front Counter", org_id: "org-1" }, fromCache: false });
    renderAt("/display?debug");
    await waitFor(() => expect(screen.getByText(/standby/)).toBeInTheDocument());
    expect(screen.queryByText("SCENA DISPLAY DIAGNOSTICS")).not.toBeInTheDocument();
    expect(screen.queryByText(/press D for diagnostics/i)).not.toBeInTheDocument();
  });
});

describe("legacy kiosk hash conversion", () => {
  it("converts #/display to /display", () => {
    expect(convertLegacyKioskHash("#/display")).toBe("/display");
  });
  it("converts #/display?debug to /display?debug", () => {
    expect(convertLegacyKioskHash("#/display?debug")).toBe("/display?debug");
  });
  it("does not touch an SSO #code= fragment", () => {
    expect(convertLegacyKioskHash("#code=abc123")).toBeNull();
  });
  it("does not touch an empty hash", () => {
    expect(convertLegacyKioskHash("")).toBeNull();
  });
});

// ---- manager/kiosk isolation ------------------------------------------

describe("manager and kiosk isolation", () => {
  it("the kiosk route never triggers a Supabase auth session check", async () => {
    mockStoredToken.mockReturnValue(null);
    renderAt("/display");
    await waitFor(() => expect(screen.getByText("123456")).toBeInTheDocument());
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockLoadAccountContext).not.toHaveBeenCalled();
  });

  it("the login route never touches kiosk device storage", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    renderAt("/login");
    await waitFor(() => expect(screen.getByText("Continue with Google")).toBeInTheDocument());
    expect(mockStoredToken).not.toHaveBeenCalled();
    expect(mockRegisterDevice).not.toHaveBeenCalled();
  });
});

// ---- route error boundaries (render-time, not navigation-time) -----------

describe("route error boundaries", () => {
  it("/app renders RouteErrorBoundary instead of crashing when a guarded page throws during render", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadAccountContext.mockResolvedValue(AUTHENTICATED_ACCOUNT);
    // A throw during the *initial* render (not a subsequent navigation)
    // is caught by the route's errorElement without touching the data
    // router's navigate()/Request-construction path.
    forceManagerContextThrow = true;
    renderAt("/app/home");
    await waitFor(() => expect(screen.getByText("Application error")).toBeInTheDocument());
  });
});
