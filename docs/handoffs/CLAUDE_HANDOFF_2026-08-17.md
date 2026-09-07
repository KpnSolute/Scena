# Claude handoff: KpnSolute portfolio direction and Workforce Auth Roster A

Date: 2026-08-17 America/New_York
Prepared by: Codex, with implementation assistance from the Tesla subagent
Audience: Claude Code sessions working from `C:\Projects`
Status: Detailed context handoff; not a release record or deployment authorization

## 1. Why this handoff exists

The owner asked Codex and Claude to collaborate without losing product intent,
implementation context, or release-state distinctions. This document preserves
the useful context from the active Codex conversation. It does not give Claude
access to Codex's private chat transport; it gives Claude a durable, project-
readable representation of the owner's goals, preferred working style, work
already performed, evidence collected, unresolved risks, and next authorized
stage.

Read this document together with, not instead of:

- `C:\Projects\CLAUDE.md`
- `C:\Projects\_config\kpnsolute-governance\SHARED_MEMORY.md`
- `C:\Projects\_config\kpnsolute-governance\PROJECTS_AND_TOOLS.md`
- `C:\Projects\loom\governance\PRODUCT_CHARTERS.md`
- `C:\Projects\loom\governance\PRODUCT_CHANGE_CONTROL.md`
- each target repository's `AGENTS.md`, `CLAUDE.md`, changelog, SOP, and build plan

No secret values, passwords, service-role keys, signing keys, private tokens, or
customer credentials are recorded here.

## 2. How the owner communicates and wants agents to behave

The owner writes quickly and conversationally, often with spelling errors. Read
for intent instead of forcing them to restate obvious meaning. Ask only when a
choice would materially change the result, authorize a risky action, or expand
scope. Otherwise, inspect the code and move the work forward.

The expected tone is:

- direct, collaborative, and confident without being falsely reassuring;
- honest about what is local, committed, pushed, deployed, and live verified;
- product-minded rather than narrowly code-minded;
- able to challenge an incorrect assumption with evidence;
- concise during execution, but detailed when handing off architecture or risk;
- never condescending about spelling, terminology, or unfinished ideas;
- focused on finished user workflows, not isolated components that merely build.

The owner strongly dislikes generic, box-heavy, template-looking interfaces and
placeholder experiences. In Scena especially, "complete" means the real user can
create content, assign it, launch it, control it, and see it on a display. A tile,
dropdown, database table, configured adapter, or passing unit test is not by
itself proof that the workflow is usable.

Important interpretation rules from the conversation:

- When the owner says "finish a chapter," they mean implement everything in that
  chapter and make it live, not write a plan or partial scaffold.
- When the owner says a feature must be "complete," include creation, empty and
  failure states, persistence, authorization, routing, operational controls,
  documentation, deployment, and live acceptance where applicable.
- The owner wants agents to keep moving, but not to hide safety gates. Explain
  the exact gate and the concrete next action.
- Do not redefine existing `P0-*` findings. `P0` through `P3` are severity
  classes. Scena product phases are `Studio Phase A/B/C`.
- Do not treat Loom approval as authorization to commit, push, deploy, purchase,
  use credentials, or make legal commitments.
- Do not invent repository release identifiers. Preserve work until the owner
  supplies an identifier for each repository.
- Do not delete legacy authentication during this migration. The approved model
  is additive dual-auth until authenticated production acceptance passes.

## 3. Product vision the owner expressed

### 3.1 Scena

Scena must become a polished live-board and digital-signage system, not a generic
block editor. The owner repeatedly compared the desired creation experience to
Canva and the desired control experience to OBS Studio and Windows 11 Task View.

The intended content model is:

`Board -> Scene -> Regions/Elements/Assets -> Display output`

Key expectations:

- A Canva-like Studio with a rich element library, uploads, text, emoji, shapes,
  media, live data, and distinct interactive controls.
- Scenes have meaningful types, such as signage compositions and presentation
  slides, rather than every object being an undifferentiated block.
- A PowerPoint upload should become scene-level presentation content instead of
  an opaque generic asset.
- A scene may contain multiple adjustable regions, similar to window layouts,
  so diverse content can coexist in one scene.
- Boards sequence scenes and produce the final display program.
- The board-to-session-to-display path must be obvious and streamlined.
- Session creation must support single, duplicate, extend, and independent
  display behavior with visual layout selection instead of confusing dropdowns.
- The control room should feel like a live production surface: previews,
  program/output state, display topology, live health, transitions, and direct
  manipulation across multiple displays.
- Display pairing should show the display URL and let the current device become
  a display.
- Display diagnostics should primarily appear in the control room, not clutter
  the kiosk output.
- Documentation must be a truthful user guide to the implemented application.
- Session lifecycle proof must cover create, assign board, assign display,
  readiness, start, pause, resume, stop, release resources, and rendered output.

These broader Studio and control-room goals are not completed by the Workforce
Auth work described later in this handoff.

### 3.2 KpnLink and unified events

The owner wants KpnLink to be the standard cross-product integration layer,
using CloudEvents and signed webhook delivery. Othniel's MJCC Compute instance
is the first practical producer: menu text and rotations should flow into
Lunchvoice and Scena, while future tenants can connect their own services using
the same documented protocol.

KpnLink must be tenant-scoped, easy to onboard, reusable beyond MJCC, and
consistent with the unified API boundary. Existing KpnSolute Events work is the
technical predecessor; the intended product name is KpnLink.

### 3.3 KpnCompute

KpnCompute is intended to become a multi-tenant SaaS platform rather than an
MJCC-specific portal. MJCC is the first template and operating tenant, not the
permanent product boundary.

The owner's tenancy concept includes:

- organizations for ordinary customers;
- corporations for larger customers with dedicated/custom routing;
- tenant-owned staff, roles, SOPs, projects, generated templates, archives, and
  service installations;
- the ability to create a new organization from uploaded SOPs and turn proven
  structures into reusable templates;
- preservation of MJCC production behavior while tenant foundations are added.

Routing direction discussed:

- `compute.kpnsolute.com/{organization}` for standard organizations;
- `{corporation}.kpnsolute.com` or a verified custom domain for corporations;
- `mjcc.kpnsolute.com` as the MJCC corporate runtime;
- creation and management occur through the shared KpnSolute platform rather
  than remaining inside a Compute-only control panel.

### 3.4 Shared KpnSolute platform

The owner described a Microsoft-like product ecosystem:

- `kpnsolute.com`: public portfolio hub;
- `accounts.kpnsolute.com`: personal account, security, sign-in methods, and SSO;
- `auth.kpnsolute.com`: KpnAuth sign-in authority;
- `billing.kpnsolute.com`: centralized purchases and subscriptions;
- `platform.kpnsolute.com/{service}/{tenant}`: organization/resource manager;
- `create.kpnsolute.com/{service}/new`: product/tenant provisioning;
- `api.kpnsolute.com/{service}/...`: unified service API boundary;
- `link.kpnsolute.com`: KpnLink integrations and webhooks;
- `flow.kpnsolute.com`: automation/workflow experience associated with KpnLink;
- `workforce.kpnsolute.com`: corporate/operator-only Console;
- product destinations such as `scena.kpnsolute.com`,
  `lunchvoice.kpnsolute.com`, and `tradora.kpnsolute.com`.

The shared platform owns consumer KpnSolute accounts, organization membership,
service installations, centralized billing references, and control-plane
metadata. Product databases continue to own product-operational data.

### 3.5 Loom governance

Loom is the constitutional product-governance authority. It protects each
product's mission, users, promises, non-goals, portfolio placement, tenancy,
shared APIs/events, and major feature definitions from casual agent drift.
Agents must consult the product charters and change-control process before a
material product redefinition. Governance verdicts and implementation/release
authorization are separate decisions.

## 4. The current approved work: Workforce Auth Migration Roster A

The owner explicitly approved:

> Workforce Auth Migration Roster A: KpnAuth, Compute, Lunchvoice, Scena, and
> the held Tradora adapter; additive dual-auth migration with no legacy deletion
> before live acceptance.

The immediate problem was tenant staff sign-in, not consumer login. The desired
model is:

- KpnAuth centrally owns tenant staff credentials and short-lived workforce
  sessions.
- A workforce principal is authorized using immutable tenant ID, service
  installation ID, staff-account ID, and service role.
- Product adapters map that central principal to the product's existing local
  authorization/RLS model during the compatibility period.
- Tenant slugs are lookup/routing context, never authorization claims.
- Existing product login paths remain available in `dual` mode.
- `required` mode is a later per-product activation step.
- Legacy records are not deleted until production acceptance proves the new
  path and rollback is no longer needed.

## 5. Governance and safety work performed

Before implementation, Codex read the shared KpnSolute registry, shared memory,
Loom product charters, change-control rules, ADR-0007, and relevant project-local
instructions. The conclusion was that additive workforce authentication was
inside the accepted architectural direction, provided the implementation kept
immutable mappings, cross-tenant denial, rollback, and no legacy deletion.

Existing dirty checkouts were preserved. Codex created isolated worktrees:

- `C:\Projects\Scena\.worktrees\workforce-auth-compute`
- `C:\Projects\Scena\.worktrees\workforce-auth-lunchvoice`
- `C:\Projects\Scena\.worktrees\workforce-auth-scena`
- `C:\Projects\Scena\.worktrees\workforce-auth-tradora`

The shared Website/KpnAuth implementation was performed in:

- `C:\Projects\Scena\.worktrees\Website-platform`

That Website checkout has an unborn Git branch and its baseline is still
untracked. Treat it as an initial repository publication problem, not a normal
small diff. The canonical registry now lists `C:\Projects\Website`; refresh the
exact checkout relationship before publication.

No production database migration, secret provisioning, commit, tag, push,
deployment, DNS change, customer-data mutation, or legacy deletion occurred in
this work.

## 6. Implementation completed locally

### 6.1 Central KpnAuth foundation

Tesla, a Codex subagent, implemented the bounded central foundation in the
Website-platform checkout. Codex reviewed the result, identified contract
mismatches, and sent it back for correction before acceptance.

Implemented central capabilities:

- additive migration `0007_tenant_workforce_auth.sql`;
- tenant-scoped workforce staff accounts;
- service-installation assignments and service roles;
- tenant workforce authentication policies;
- legacy identity links;
- private credential, session, and audit tables;
- RLS and explicit browser-role denial;
- scrypt PIN hashing with random salts;
- failed-attempt counters and bounded lockouts;
- flags for weak/default credentials requiring rotation;
- short-lived ES256 workforce JWTs, capped at 15 minutes;
- database-backed session revocation;
- method discovery, PIN login, session validation, and logout routes;
- public ES256 JWKS containing no private key material;
- fail-closed behavior when signing configuration is absent.

The corrected public contract is:

```text
GET  https://api.kpnsolute.com/auth/.well-known/jwks.json
GET  https://api.kpnsolute.com/auth/workforce/{tenantSlug}/{serviceKey}/methods
POST https://api.kpnsolute.com/auth/workforce/{tenantSlug}/{serviceKey}/pin
GET  https://api.kpnsolute.com/auth/workforce/{serviceKey}/session
POST https://api.kpnsolute.com/auth/workforce/{serviceKey}/logout
```

The gateway strips the first `/auth` service segment, so upstream workforce
routes are `/workforce/...`; this avoids an incorrect double `/auth/auth/...`
public route.

Workforce token contract:

- issuer: `https://auth.kpnsolute.com`;
- audience: `kpnsolute:<service>:workforce`;
- `token_use`: `workforce`;
- immutable `sub`, `tenant_id`, `installation_id`, and `session_id`;
- `service_key`, `service_role`, `jti`, `iat`, and `exp`;
- exact ES256 `kid` published by JWKS.

Primary references:

- `C:\Projects\Scena\.worktrees\Website-platform\docs\WORKFORCE_AUTH.md`
- `C:\Projects\Scena\.worktrees\Website-platform\apps\api\src\db\migrations\0007_tenant_workforce_auth.sql`
- `C:\Projects\Scena\.worktrees\Website-platform\apps\api\src\services\workforce-auth.ts`
- `C:\Projects\Scena\.worktrees\Website-platform\apps\api\src\routes\auth.ts`

### 6.2 KpnCompute adapter

Implemented:

- additive `kpn_staff_identity_links` migration;
- exact tenant/install/staff-to-local-profile bridge;
- ES256/JWKS issuer, audience, expiry, and workforce-claim validation;
- central active-session introspection on authenticated requests;
- no fallback after a recognized but unassigned workforce token;
- tenant claim compared to the resolved Compute workspace;
- `off`, `dual`, and `required` modes;
- legacy `pin_` sessions rejected only in `required` mode;
- legacy staff login requires workspace context under tenant modes;
- public configuration added to `.env.example` and `render.yaml`;
- tests for fail-closed configuration, exact bridge resolution, wrong
  installation denial, required-mode legacy denial, and revoked/inactive central
  session denial.

Primary references:

- `C:\Projects\Scena\.worktrees\workforce-auth-compute\backend\routes\__init__.py`
- `C:\Projects\Scena\.worktrees\workforce-auth-compute\backend\routes\_deps.py`
- `C:\Projects\Scena\.worktrees\workforce-auth-compute\backend\tests\test_kpnauth_workforce.py`
- `C:\Projects\Scena\.worktrees\workforce-auth-compute\supabase\migrations\20260818001046_workforce_auth_identity_links.sql`

### 6.3 Lunchvoice adapter

Implemented:

- organization columns for central tenant and installation IDs;
- service-role-only staff identity bridge;
- central JWT/JWKS verification with exact Lunchvoice audience;
- central active-session introspection before compatibility-session creation;
- exact org/tenant/install/staff assignment checks;
- allowlisted central-role to local-role mapping;
- temporary local Supabase principal/session creation for existing Lunchvoice RLS;
- `off`, `dual`, and `required` mode gates;
- existing MJCC staff SSO preserved while mode is `off`;
- Supabase Function configuration allowing the function to validate the
  KpnAuth bearer itself;
- no token values logged.

Primary references:

- `C:\Projects\Scena\.worktrees\workforce-auth-lunchvoice\supabase\functions\kpnauth-staff-sso\index.ts`
- `C:\Projects\Scena\.worktrees\workforce-auth-lunchvoice\supabase\functions\_shared\staffAccess.ts`
- `C:\Projects\Scena\.worktrees\workforce-auth-lunchvoice\supabase\migrations\20260818001409_kpnauth_workforce_identity_bridge.sql`

Important: the currently coded browser redirect assumes a central workforce
sign-in surface, but that UI does not yet exist. Do not turn on `dual` merely
because the Edge Function compiles.

### 6.4 Scena adapter

Implemented:

- organization columns for central tenant and installation IDs;
- service-role-only staff identity bridge;
- central JWT/JWKS verification with exact Scena audience;
- central active-session introspection before compatibility-session creation;
- exact organization assignment and role allowlisting;
- temporary local Supabase user, membership, and RLS session projection;
- explicit `off` default and Function-level enablement check;
- a client exchange helper that deliberately refuses token-in-URL-fragment
  behavior and expects a safer central flow;
- Supabase Function prevalidation configuration for KpnAuth bearer handling.

Primary references:

- `C:\Projects\Scena\.worktrees\workforce-auth-scena\src\auth\workforce.ts`
- `C:\Projects\Scena\.worktrees\workforce-auth-scena\supabase\functions\kpnauth-workforce-exchange\index.ts`
- `C:\Projects\Scena\.worktrees\workforce-auth-scena\supabase\migrations\20260818001732_kpnauth_workforce_identity_bridge.sql`

Important: the adapter is not wired into Scena's visible Login page. Scena still
uses native Google/email sign-in for current users. Browser-facing workforce
login remains a pending step.

### 6.5 Held Tradora adapter

Implemented only as a held verifier:

- KpnAuth mode and public configuration contract;
- issuer/JWKS/audience/token-use/tenant/install/role verification;
- documentation explicitly prohibiting runtime activation.

It is not connected to Tradora sessions, WebSockets, broker routes, order
routes, or live trading. Keep live trading disabled and treat activation as a
separate security gate.

Primary references:

- `C:\Projects\Scena\.worktrees\workforce-auth-tradora\artifacts\api-server\src\lib\kpnauth.ts`
- `C:\Projects\Scena\.worktrees\workforce-auth-tradora\docs\KPNAUTH_WORKFORCE_ADAPTER.md`

The Tradora `pnpm-lock.yaml` currently has a large peer-resolution rewrite from
dependency installation. Review and normalize that lockfile before any commit;
do not accept the noisy diff without understanding it.

## 7. Tools and methods used

Codex used the following tools and techniques:

- project governance and skill files for routing, ownership, and safety rules;
- a Codex subagent named Tesla for the bounded central KpnAuth implementation;
- isolated Git worktrees to preserve dirty canonical checkouts;
- PowerShell for read-only inventory, exact-path checks, and verification;
- `rg` for fast source/configuration searches;
- `git status`, `git diff --stat`, and `git diff --check` for scope and whitespace
  verification;
- `apply_patch` for deliberate source edits;
- Supabase CLI migration generation locally; no remote migration application;
- Python/Ruff and Pytest for KpnCompute;
- npm, TypeScript, Vite, and Vitest for Website, Lunchvoice, and Scena;
- Deno type checking for Lunchvoice and Scena Edge Functions;
- pnpm and TypeScript for the held Tradora adapter;
- plan/status tracking to keep local implementation, publication, deployment,
  and live acceptance separate.

Codex did not use production Supabase mutation tools, Render deployment,
Cloudflare deployment, GitHub publication, signing-key creation, customer-data
imports, or live authentication during this roster.

## 8. Verification evidence

Latest observed local evidence:

| Scope | Result |
|---|---|
| Central KpnAuth/Website workspace | lint, Prettier, typecheck, all tests, and all production builds passed; 65 tests total |
| Central API focused suite | 31 tests across 6 files passe+++++++++++++++++++++++++++++++d |
| Unified gateway focused suite | 5 tests passed |
| KpnCompute backend | Ruff passed; 219 tests passed, 14 skipped |
| Scena | production build passed; 205 tests passed |
| Lunchvoice | production build passed; KpnAuth Edge Function Deno check passed |
| Scena KpnAuth Edge Function | Deno check passed |
| Tradora held API adapter | TypeScript typecheck passed after workspace libraries were built |
| All four product worktrees | `git diff --check` passed; line-ending warnings only |

This proves local source quality and protocol-level behavior. It does not prove
database migrations, configured signing keys, imported users, browser login,
deployment, or production acceptance.

## 9. Exact release state

| State | Result |
|---|---|
| Local implementation | Completed for the central API foundation and four code adapters |
| Browser workforce sign-in UI | Not implemented |
| Existing staff import | Not performed |
| Signing keys/secrets | Not provisioned |
| Migrations applied locally against PostgreSQL | Not proven |
| Migrations applied to hosted Supabase | No |
| Git staged | No claim; refresh each worktree before acting |
| Git committed | No |
| Git pushed | No |
| CI | Not run on these changes |
| Deployed | No |
| Live verified | No |
| Legacy auth deleted | No; deletion is prohibited before acceptance |

## 10. Known architecture and acceptance gaps

1. `auth.kpnsolute.com/workforce` needs a real browser experience for tenant,
   username, PIN, method discovery, rotation-required handling, errors, and safe
   return to the requesting product.
2. Lunchvoice and Scena need a finalized browser callback contract. Do not use
   long-lived bearer tokens in query strings or URL fragments.
3. Product compatibility sessions must not silently outlive central workforce
   authorization. Current exchanges introspect the central session at issuance,
   but the final design must prove revalidation/revocation behavior for local
   Supabase refresh sessions and direct RLS access.
4. The central migration must be exercised on a non-production PostgreSQL/
   Supabase environment, followed by database security and performance advisors.
5. ES256 production key generation, storage, rotation, `kid`, issuer, and public
   JWKS routing need an approved operational procedure. Never commit private keys.
6. A tenant-by-tenant import utility and reconciliation report are still needed.
   Weak/default legacy PINs such as `2222` must be marked for mandatory rotation.
7. Cross-tenant, wrong-product, revoked-session, lockout, expiry, and rollback
   behavior must be tested through the real browser/product path.
8. The Website repository baseline/unborn-branch state must be resolved before
   publication.
9. The Tradora lockfile diff must be normalized, and Tradora remains held.
10. Repository-specific approved identifiers are required before any commit.

## 11. Recommended next execution sequence

1. Refresh exact Git status and instructions for `C:\Projects\Website` and the
   Website-platform checkout; establish the correct initial publication scope
   without losing baseline files.
2. Design and implement the KpnAuth workforce browser page using the existing
   `/auth/workforce/...` public API contract.
3. Choose and implement a safe product callback mechanism, including state,
   return-URL allowlisting, replay prevention, and no token leakage.
4. Wire Lunchvoice first as the pilot because it already has tenant staff SSO
   semantics. Keep its legacy MJCC path available.
5. Wire Scena second and prove that consumer Google/email login and workforce
   login remain distinct.
6. Build a dry-run import/reconciliation utility. Run it against sanitized or
   non-production data before any hosted mutation.
7. Apply central and product migrations to non-production projects, run RLS and
   advisor checks, and exercise one test tenant end to end.
8. Ask the owner for repository-specific identifiers. Then commit and push each
   repository separately, with factual commit bodies and no invented titles.
9. Deploy in `off`, verify, switch one product/tenant to `dual`, and execute the
   complete acceptance matrix.
10. Only after accepted production proof may a later separately approved change
    switch a product to `required`. Legacy deletion remains a later decision.

## 12. Instructions to Claude taking over

Start by stating that you read this handoff and by naming the exact target
repository and current release state. Refresh current files and Git state rather
than assuming this snapshot is still current.

Do not say the migration is complete or live. The accurate statement is:

> The central workforce-auth API foundation and product adapters are locally
> implemented and tested. Browser sign-in, data import, database application,
> publication, deployment, and authenticated production acceptance remain.

Preserve every unrelated change. Do not merge isolated worktrees into dirty
canonical checkouts by copying broad directories. Review diffs file by file.

When reporting progress, lead with user-visible outcomes and then evidence. Keep
the owner's broader goal in view: a unified KpnSolute platform with tenant-safe
identity, truthful product capabilities, polished interfaces, reusable
integrations, and complete live workflows.
