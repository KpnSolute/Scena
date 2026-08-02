// Authenticated-account guard for everything under /app. Loads the complete
// multi-Workspace account context once and exposes the selected Workspace to
// the legacy manager route tree through ManagerContextProvider.

import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../services/supabase/client";
import {
  loadAccountContext,
  toManagerContext,
  type AccountContext,
} from "../auth/organization-context";
import { ScenaApiError } from "../services/scena-api/errors";
import { clearLocalSession } from "../auth/session";
import { ManagerContextProvider } from "./ManagerContextProvider";

export type GuardState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "ready"; account: AccountContext };

// `getSession()` only reads persisted storage and compares `expires_at`; it
// never asks the Auth server whether the session still exists. So a revoked
// session looks healthy locally until an Edge Function rejects it.
function isUnauthenticated(error: unknown): boolean {
  return (
    error instanceof ScenaApiError &&
    (error.code === "UNAUTHENTICATED" || error.status === 401)
  );
}

export async function resolveGuardState(): Promise<GuardState> {
  const { data } = supabase
    ? await supabase.auth.getSession()
    : { data: { session: null } };

  if (!data.session) return { status: "unauthenticated" };

  try {
    const account = await loadAccountContext();
    return { status: "ready", account };
  } catch (error) {
    // The stored token was accepted locally but the server says the session is
    // gone. That is a signed-out user, not a broken account: drop the dead
    // token and send them to /login. Falling through to /unauthorized would
    // strand them on a page whose only control is a sign-out that also fails.
    if (isUnauthenticated(error)) {
      await clearLocalSession();
      return { status: "unauthenticated" };
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Access unavailable.",
    };
  }
}

export function ManagerGuard() {
  const [state, setState] = useState<GuardState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    resolveGuardState().then((next) => {
      if (active) setState(next);
    });

    const listener = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!session && active) setState({ status: "unauthenticated" });
    });

    return () => {
      active = false;
      listener?.data.subscription.unsubscribe();
    };
  }, []);

  if (state.status === "loading") {
    return (
      <main className="auth-shell">
        <div className="auth-card loading-card">
          <div className="spinner" />
          <p>Loading your Scena Workspaces…</p>
        </div>
      </main>
    );
  }

  if (state.status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (state.status === "error") {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{ message: state.message }}
      />
    );
  }

  const managerContext = toManagerContext(state.account);
  if (!managerContext) {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{
          message:
            "Your Personal Workspace is still being prepared. Refresh in a moment.",
        }}
      />
    );
  }

  return (
    <ManagerContextProvider value={managerContext}>
      <Outlet />
    </ManagerContextProvider>
  );
}
