import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn() }));
const account = vi.hoisted(() => ({ loadAccountContext: vi.fn() }));
const session = vi.hoisted(() => ({ clearLocalSession: vi.fn() }));

vi.mock("../services/supabase/client", () => ({ supabase: { auth } }));
vi.mock("../auth/organization-context", () => ({
  loadAccountContext: account.loadAccountContext,
  toManagerContext: (value: unknown) => value,
}));
vi.mock("../auth/session", () => ({ clearLocalSession: session.clearLocalSession }));

import { resolveGuardState } from "./ManagerGuard";
import { ScenaApiError } from "../services/scena-api/errors";

beforeEach(() => {
  auth.getSession.mockReset();
  account.loadAccountContext.mockReset();
  session.clearLocalSession.mockReset().mockResolvedValue(undefined);
});

describe("resolveGuardState", () => {
  it("reports unauthenticated when no session is stored", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });

    await expect(resolveGuardState()).resolves.toEqual({ status: "unauthenticated" });
    expect(account.loadAccountContext).not.toHaveBeenCalled();
  });

  // The P0 from the 2026-08-02 live review: a stored token that is structurally
  // valid and unexpired, whose server-side session has been revoked. Every Edge
  // Function returns 401 while PostgREST still accepts the signature. This must
  // route to /login, not to /unauthorized — the latter is a dead end whose only
  // control is a sign-out that fails for the same reason.
  it("treats an UNAUTHENTICATED API error as signed out and drops the dead token", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "stale" } } });
    account.loadAccountContext.mockRejectedValue(ScenaApiError.unauthenticated());

    await expect(resolveGuardState()).resolves.toEqual({ status: "unauthenticated" });
    expect(session.clearLocalSession).toHaveBeenCalledOnce();
  });

  it("keeps a genuine backend failure distinguishable from being signed out", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "live" } } });
    account.loadAccountContext.mockRejectedValue(new Error("database unavailable"));

    await expect(resolveGuardState()).resolves.toEqual({
      status: "error",
      message: "database unavailable",
    });
    expect(session.clearLocalSession).not.toHaveBeenCalled();
  });

  it("returns the account when context loads", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "live" } } });
    account.loadAccountContext.mockResolvedValue({ userId: "u1" });

    await expect(resolveGuardState()).resolves.toEqual({
      status: "ready",
      account: { userId: "u1" },
    });
  });
});
