# Claude local handoff: KpnAuth protocol, sign-in host, and adapter convergence

Date: 2026-08-17 America/New_York
Agent: Claude Code (Opus 5), continuing the Codex Roster A handoff
Status: Local implementation handoff. Nothing committed, pushed, migrated, or deployed.

## 1. Release state, stated first

| State | Result |
|---|---|
| Local implementation | Partial — see section 6 for exactly what is not done |
| Local verification | Passing (section 5) |
| Git staged / committed / pushed | No, in every repository |
| Hosted database migration | No |
| Deployed | No |
| Live verified | No |
| Legacy auth deleted | No |

No production Supabase, Render, Cloudflare, or DNS resource was mutated. The
Supabase MCP token available in this session reaches only the MJCC org
(`MJCCv1`, `MJCCv2`); the KpnAuth project `vwbrxcltetelvvkbnbru` was **not**
reachable, so no claim is made about its current schema state.

## 2. Repository split resolved

Both `C:\Projects\Website` and `C:\Projects\Scena\.worktrees\Website-platform`
are independent clones of `KpnSolute/Website` on unborn `main` with 0 commits
and no stashes. `Website-platform` is **not** a Scena worktree despite its path.

- `C:\Projects\Website` was registry-canonical and completely empty (0 tracked,
  0 untracked), so reconciling into it could not overwrite anything.
- The 177 gitignore-respecting source files were **copied** there.
  `Website-platform` was left byte-for-byte untouched as the preserved backup.
- Nothing was deleted, reset, or force-written.

**Canonical tree going forward: `C:\Projects\Website`.**

## 3. Protocol decision

`C:\Projects\Website\docs\AUTH_FINAL_GUIDE.md` is the authoritative contract.
It separates four identity classes (consumer, workforce, device, service) and
mandates one flow for all of them: OAuth 2.1 authorization code with PKCE S256,
mandatory `state` and `nonce`, exact-match redirect allowlists, SHA-256-hashed
single-use 60-second codes, server-side exchange, and rotating refresh families
with reuse detection.

The retired contracts are named explicitly in section 2.5 of that guide.

## 4. Files changed, by repository

### `C:\Projects\Website` (canonical, all untracked/new)

| File | Change |
|---|---|
| `docs/AUTH_FINAL_GUIDE.md` | New. Authoritative protocol. |
| `apps/api/src/db/migrations/0008_auth_protocol_foundation.sql` | New. OAuth clients, redirect allowlist, authorization requests, hashed codes, refresh families/tokens, device identities, service accounts, workforce import mappings, `corporation` tenant type. Additive; drops nothing. |
| `apps/api/src/db/migrations/auth-protocol-migration.test.ts` | New. 12 schema security assertions. |
| `apps/api/src/services/oauth-protocol.ts` | New. Pure primitives: PKCE S256, opaque secrets, redirect inspection, expiry. |
| `apps/api/src/services/oauth-protocol.test.ts` | New. 26 tests incl. RFC 7636 vector. |
| `apps/api/src/services/oauth.ts` | New. Authorize / code issue / exchange / refresh / revoke orchestration. |
| `apps/api/src/services/oauth.test.ts` | New. 26 flow and attack tests. |
| `apps/api/src/services/workforce-auth.ts` | Refactored: `authenticateWorkforcePin` split from `loginWithWorkforcePin`; `issueWorkforceAccessToken` exported. Existing behaviour preserved. |
| `apps/api/src/repositories/types.ts` | Added `OAuthRepository` + record types. |
| `apps/api/src/repositories/pg/oauth.ts` | New. Atomic single-use consumption via conditional update. |
| `apps/api/src/repositories/pg/index.ts` | Registers the OAuth repository. |
| `apps/api/src/routes/oauth.ts` | New. `/oauth/authorize`, `/oauth/authorize/:id`, `/oauth/authorize/:id/workforce-pin`, `/oauth/token`, `/oauth/refresh`, `/oauth/revoke`. All `no-store`. |
| `apps/api/src/lib/schemas.ts` | Added workforce authorize / pin / refresh / revoke schemas. |
| `apps/api/src/server.ts` | Registers OAuth routes. |
| `apps/auth/src/main.tsx` | Path router: `/`, `/workforce/sign-in`, `/workforce/callback-error`, `/workforce/recover`. |
| `apps/auth/src/consumer/ConsentApp.tsx` | Existing consumer consent screen, extracted unchanged. |
| `apps/auth/src/workforce/api.ts` | New. Browser client that never receives a token. |
| `apps/auth/src/workforce/SignInPage.tsx` | New. Sign-in host with loading / error / rotation-required / redirect states. |
| `apps/auth/src/workforce/StatusPages.tsx` | New. Callback-error and recovery surfaces. |

### `workforce-auth-lunchvoice` worktree

| File | Change |
|---|---|
| `supabase/functions/kpnauth-staff-sso/index.ts` | Now accepts `{code, code_verifier, redirect_uri, org}` and exchanges server-side. No longer accepts a browser-supplied bearer token. |
| `supabase/functions/_shared/staffAccess.ts` | **Security fix**: explicit role map. The previous `service_role === "staff" ? "staff" : "admin"` escalated a central `analyst` to a LunchVoice **admin**. |
| `src/lib/supabase.ts` | `staffLoginUrl` replaced by `beginStaffLogin` with PKCE S256 + state + nonce; `takeStaffLoginContext`; code-based `kpnAuthStaffSso`. |
| `src/routes/StaffSsoCallback.tsx` | **Reads `code` + `state` from the query string, validates state, and actively rejects a fragment token.** The retired contract is gone. |
| `src/routes/Login.tsx` | Wired to `beginStaffLogin`. Legacy MJCC path retained while mode is `off`. |
| `.env.example` | Added `VITE_KPN_AUTH_CLIENT_ID`, and the server-side `KPN_AUTH_*` block that was previously missing entirely. |

### `workforce-auth-scena` worktree

| File | Change |
|---|---|
| `supabase/functions/kpnauth-workforce-exchange/index.ts` | Accepts a code, exchanges server-side. |
| `src/auth/workforce.ts` | Rewritten: `beginWorkforceSignIn`, `completeWorkforceSignIn`, state validation, fragment-token refusal, code exchange. |
| `.env.example` | Added client id and the missing server-side `KPN_AUTH_*` block. |

### `workforce-auth-compute`, `workforce-auth-tradora`

Untouched this pass. Compute needs no browser flow yet (it consumes a bearer
directly); Tradora remains held.

## 5. Verification actually run

| Scope | Command | Result |
|---|---|---|
| Website workspace | `npm run typecheck` | Clean, all workspaces |
| Website workspace | `npm run test` | 124 tests passed |
| — of which central API | `npm run test --workspace apps/api` | 95 passed / 9 files |
| Auth app | `npm run build --workspace apps/auth` | Built |
| LunchVoice | `npm run build` | Built |
| LunchVoice Edge | `deno check kpnauth-staff-sso/index.ts` | Clean |
| Scena | `npm run build` | Built |
| Scena | `npm run test` | 205 passed (unchanged from baseline) |
| Scena Edge | `deno check kpnauth-workforce-exchange/index.ts` | Clean |

Attack cases covered by passing tests: PKCE plain downgrade, verifier mismatch,
prefix-verifier, code replay, code burned on failed exchange, redirect-URI
mismatch, wrong-client exchange, hostile/prefix/traversal/port/scheme redirect
variants, suspended client, expired and already-completed authorization
requests, session revoked between authorize and exchange, cross-tenant session
mismatch, refresh rotation, refresh reuse revoking the whole family and the
central session, and refresh after session revocation.

## 6. What is NOT done

Stated plainly so nothing is assumed complete.

1. **Portal shells (roster item 2/5)** — `accounts`, `platform`, `billing`,
   `create`, and `link` were not implemented. Only the auth host was built.
2. **Workforce migration/import tooling (item 5)** — the provenance table
   `workforce_identity_import_mappings` exists and is idempotent by
   `(source_service, source_table, source_row_id, installation_id)`, but no
   dry-run importer or reconciliation report was written.
3. **Infrastructure routing map (item 7)** — not produced.
4. **Browser/E2E tests (item 8)** — unit and integration only. No Playwright
   run, no real browser sign-in.
5. **Scena LoginPage wiring** — `beginWorkforceSignIn` exists and builds, but no
   Scena UI renders a workforce entry point and no `/auth/workforce/callback`
   route is registered. Scena workforce sign-in is therefore still not reachable
   by a user.
6. **`required` mode is still not enforced in LunchVoice or Scena.** Both treat
   `required` identically to `dual`; neither disables its legacy path. Only
   Compute implements the distinction. This is a pre-existing defect I
   identified but did not fix.
7. **Compute legacy weaknesses, identified and unfixed**: PINs are compared in
   plaintext against `user_profiles.pin`; the fallback `pin_{uuid}` token has no
   signature and no expiry; the central-session callback uses a synchronous
   `urllib` call inside async request handling.
8. **Consumer and device/service flows** are specified in the guide and modelled
   in the schema, but only the workforce path is implemented end to end.
9. **No OAuth client rows exist.** `oauth_clients` and its redirect allowlist
   are empty; `lunchvoice-web` and `scena-web` must be registered with exact
   redirect URIs before any flow can run.

## 7. Loom synthesis

Consulted: `PRODUCT_CHARTERS.md`, `PRODUCT_CHANGE_CONTROL.md`, `SHARED_MEMORY.md`.

| Implementation | Governing intent | Finding |
|---|---|---|
| One authorization-code + PKCE protocol | Shared platform Pure Goal: "one secure commercial foundation for identity" | Aligned. Implements ADR-0007 rather than redefining it. |
| Removing the fragment-token contract | Change control: security model changes need a verdict | Classified as a **defect fix to unreleased local code**, not a product redefinition. The retired contract was never deployed. Cited under ADR-0007. |
| LunchVoice role-escalation fix | LunchVoice non-goal: "silently becoming a KpnCompute module"; platform tenancy model | Aligned. Removes an unintended privilege grant. |
| Central identity owns auth; products keep authorization projections | Platform non-goal: "forcing product-specific data into one shared schema" | Aligned. Scena boards, LunchVoice surveys, Compute SOPs stay service-owned. |
| `corporation` tenant type | ADR-0005 routing (`{corporation}.kpnsolute.com`) | Aligned but **worth an explicit owner confirmation**: it widens `tenants.type`. Additive and reversible. |
| Device identity tables | Scena Pure Goal: display across many screens | Aligned, but Scena already has a working `screens` + `display-gateway` device model with hashed tokens. The new `device_identities` table **must not be treated as a replacement** without a separate decision. Flagged, not acted on. |

**No true charter conflict found.** Two items are flagged for owner
confirmation rather than blocked: the `corporation` tenant type, and the
relationship between central `device_identities` and Scena's existing screen
pairing.

## 8. Residual risks

1. Scena's existing device model and the new central device tables overlap.
   Reconcile deliberately or the two will diverge.
2. LunchVoice and Scena `required` mode is a false promise today (item 6.6).
   Do not advance either product to `required` until fixed.
3. Compute's plaintext PIN comparison means the import tooling must treat every
   Compute PIN as compromised and force rotation, not merely flag weak ones.
4. The central session TTL is capped at 900s by `tenant_workforce_auth_policies`.
   Refresh currently re-issues an access token against a still-live session but
   does not extend it, so a workforce session still ends at 15 minutes. If a
   full shift is wanted, that policy bound needs a deliberate change.
5. No key material exists. `WORKFORCE_JWT_*` is unset everywhere, so the API
   fails closed with `setup_required` — correct, but it means nothing can be
   exercised end to end until keys are provisioned.

## 9. Release identifiers needed

Requested once, at this gate. Nothing will be committed without them:

| Repository | Needed |
|---|---|
| `KpnSolute/Website` | Initial publication identifier + confirmation that `C:\Projects\Website` is canonical and `Website-platform` may remain as an untracked backup |
| `KpnSolute/Lunchvoice` | Next version identifier |
| `Scena` | Next version identifier |
| `KpnSolute/Compute` | Not needed this pass — unchanged |
| `Tradora` | Not needed — held |

## 10. Recommended next action

Finish item 6.5 and 6.6 first (Scena UI wiring and real `required` enforcement),
because both are small and both are currently *implied* by the code without
being true. Then build the import tooling, then the portals.
