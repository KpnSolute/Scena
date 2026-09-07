import { beforeEach, describe, expect, it, vi } from "vitest";

function stubQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve(result),
    then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const fromMock = vi.fn();
const mockCallEdgeFunction = vi.fn();
const mockSupabase = { from: (table: string) => fromMock(table) };

vi.mock("../services/supabase/client", () => ({
  requireSupabase: () => mockSupabase,
  callEdgeFunction: (...args: unknown[]) => mockCallEdgeFunction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listActiveOfferings", () => {
  it("returns free, one-time, and subscription Workspace offerings", async () => {
    fromMock.mockReturnValue(stubQuery({
      data: [
        { plan_code: "personal_free", workspace_type: "personal", billing_mode: "free" },
        { plan_code: "personal_additional", workspace_type: "personal", billing_mode: "one_time" },
        { plan_code: "plus", workspace_type: "team", billing_mode: "subscription" },
      ],
      error: null,
    }));

    const { listActiveOfferings } = await import("./billing");
    const offerings = await listActiveOfferings();

    expect(fromMock).toHaveBeenCalledWith("plans");
    expect(offerings).toHaveLength(3);
  });
});

describe("Workspace Checkout", () => {
  it("starts a one-time additional Personal Workspace Checkout", async () => {
    mockCallEdgeFunction.mockResolvedValue({
      checkout_url: "https://checkout.stripe.test/personal",
      checkout_session_id: "cs_personal",
      offering_code: "personal_additional",
      workspace_type: "personal",
      billing_mode: "one_time",
      workspace_slug: "studio-a",
      request_id: "request-1",
    });

    const { startPersonalWorkspaceCheckout } = await import("./billing");
    const result = await startPersonalWorkspaceCheckout("Studio A", "studio-a");

    expect(mockCallEdgeFunction).toHaveBeenCalledWith("billing-checkout", {
      offering_code: "personal_additional",
      workspace_name: "Studio A",
      workspace_slug: "studio-a",
    });
    expect(result.billing_mode).toBe("one_time");
  });

  it("starts a recurring Team Workspace Checkout", async () => {
    mockCallEdgeFunction.mockResolvedValue({ billing_mode: "subscription" });

    const { startTeamCheckout } = await import("./billing");
    await startTeamCheckout("pro", "North Campus", "north-campus");

    expect(mockCallEdgeFunction).toHaveBeenCalledWith("billing-checkout", {
      offering_code: "pro",
      workspace_name: "North Campus",
      workspace_slug: "north-campus",
    });
  });

  it("allows the server to generate a collision-resistant slug", async () => {
    mockCallEdgeFunction.mockResolvedValue({ workspace_slug: "studio-a-12345678" });

    const { startPersonalWorkspaceCheckout } = await import("./billing");
    await startPersonalWorkspaceCheckout("Studio A");

    expect(mockCallEdgeFunction).toHaveBeenCalledWith("billing-checkout", {
      offering_code: "personal_additional",
      workspace_name: "Studio A",
    });
  });

  it("rejects an invalid Workspace slug before calling the Edge Function", async () => {
    const { startWorkspaceCheckout } = await import("./billing");

    await expect(startWorkspaceCheckout({
      offering_code: "plus",
      workspace_name: "Campus",
      workspace_slug: "NOT VALID",
    })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    expect(mockCallEdgeFunction).not.toHaveBeenCalled();
  });
});

describe("offering presentation", () => {
  it("allows generally available and limited checkout states", async () => {
    const { isOfferingCheckoutAvailable } = await import("./billing");

    expect(isOfferingCheckoutAvailable("generally_available")).toBe(true);
    expect(isOfferingCheckoutAvailable("limited")).toBe(true);
  });

  it("blocks pilot, waitlist, and unavailable checkout states", async () => {
    const { isOfferingCheckoutAvailable } = await import("./billing");

    expect(isOfferingCheckoutAvailable("pilot")).toBe(false);
    expect(isOfferingCheckoutAvailable("waitlist")).toBe(false);
    expect(isOfferingCheckoutAvailable("unavailable")).toBe(false);
  });

  it("only offers billing management for paid Team Workspaces", async () => {
    const { canManageWorkspaceBilling } = await import("./billing");

    expect(canManageWorkspaceBilling("personal", "personal_free")).toBe(false);
    expect(canManageWorkspaceBilling("team", "plus")).toBe(true);
    expect(canManageWorkspaceBilling("team", "pro")).toBe(true);
    expect(canManageWorkspaceBilling("team", null)).toBe(false);
  });
});
