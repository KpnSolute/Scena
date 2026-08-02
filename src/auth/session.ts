// Native Supabase Auth session helpers. Google OAuth is the primary sign-in
// path, with a one-time email link as the optional secondary path.

import type { Session } from "@supabase/supabase-js";
import { requireSupabase } from "../services/supabase/client";

const CANONICAL_PRODUCTION_ORIGIN = "https://scena.kpnsolute.com";
const AUTH_QUERY_KEYS = ["code", "error", "error_code", "error_description"];
const LEGACY_FRAGMENT_KEYS = ["access_token", "refresh_token", "provider_token", "provider_refresh_token"];

export function resolveAuthRedirect(
  origin = window.location.origin,
  production = import.meta.env.PROD,
): string {
  const configuredOrigin = (import.meta.env.VITE_SCENA_APP_URL as string | undefined)?.trim();
  const base = production ? configuredOrigin || CANONICAL_PRODUCTION_ORIGIN : origin;
  const parsed = new URL(base);

  if (production && parsed.protocol !== "https:") {
    throw new Error("Scena production authentication requires an HTTPS application URL.");
  }

  return new URL("/auth/callback", parsed.origin).toString();
}

function cleanAuthParameters(url: URL): void {
  if (typeof window === "undefined") return;

  const clean = new URL(url.toString());
  for (const key of AUTH_QUERY_KEYS) clean.searchParams.delete(key);
  clean.hash = "";

  const relative = `${clean.pathname}${clean.search}` || "/";
  window.history.replaceState(window.history.state, "", relative);
}

export async function completeAuthRedirect(
  url = new URL(window.location.href),
): Promise<Session | null> {
  const client = requireSupabase();
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const hasLegacyTokens = LEGACY_FRAGMENT_KEYS.some((key) => fragment.has(key));

  if (hasLegacyTokens) {
    cleanAuthParameters(url);
    throw new Error("Scena blocked a legacy token-in-URL response. Start sign-in again.");
  }

  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) {
    cleanAuthParameters(url);
    throw new Error(providerError);
  }

  const code = url.searchParams.get("code");
  if (code) {
    try {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return data.session;
    } finally {
      cleanAuthParameters(url);
    }
  }

  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInWithGoogle(redirectTo = resolveAuthRedirect()): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function sendEmailSignInLink(email: string, redirectTo = resolveAuthRedirect()): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

/**
 * Drops the locally persisted session without contacting the Auth server.
 *
 * A stored token can be structurally valid and unexpired while the session
 * behind it no longer exists server-side — revoked from another device, an
 * inactivity timebox, or a rotated JWT signing key. PostgREST still accepts
 * the signature, so table reads keep working, but every Edge Function calls
 * `auth.getUser()` and gets 401. Keeping that token only makes the app look
 * signed in while half of it is broken.
 */
export async function clearLocalSession(): Promise<void> {
  await requireSupabase().auth.signOut({ scope: "local" });
}

export async function signOut(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();

  // A global sign-out calls the Auth server, which fails when the session was
  // already revoked there. Without this fallback the stale token survives and
  // the user is stranded on a page whose only control just failed silently.
  if (error) await client.auth.signOut({ scope: "local" });
}
