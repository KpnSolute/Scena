# Changelog

## 2026-08-02 — Revoked sessions no longer strand the user

A stored access token can be structurally valid and unexpired while the session
behind it no longer exists server-side (revoked elsewhere, inactivity timebox,
rotated JWT signing key). `getSession()` only reads local storage and compares
`expires_at`, so the client cannot see this. PostgREST still accepts the
signature and table reads keep working, but every Edge Function authenticates
via `auth.getUser()` and returns 401 — leaving the app half-alive.

`ManagerGuard` classified that 401 as a generic account error and routed to
`/unauthorized`, whose only control is a sign-out that fails for the same
reason: a signed-in customer was locked out of every `/app` route with no path
back to sign-in. An `UNAUTHENTICATED` result is now treated as signed out — the
dead token is cleared and the user is sent to `/login`. `signOut()` falls back
to a local-scope sign-out when the global call fails, so the stale token can
always be dropped. Genuine backend failures still route to `/unauthorized`.

Found by the live-application review; see
`docs/review/findings/live-review-2026-08-02.md` (P0-1).

## 2026-07-31 — Session platform follow-up: FK index coverage sweep

Post-merge review of the session-platform series found two real unindexed
foreign keys: `session_template_slots.org_id` (backs an RLS predicate — the
same pattern that made `organization_members(user_id, org_id)` the highest-
value index in the series) and `automation_runs.session_id` (backs the
"runs for this Session" query pattern). Both indexed. The migration tracking
table (`supabase_migrations.schema_migrations`) was also backfilled with all
12 of this series' migrations, which had been applied via direct SQL
execution and were missing from Supabase's own tracked history — `supabase
migration list --linked` now shows full local/remote agreement.

## 2026-07-31 — Session platform: lifecycle, readiness, health, history, groups, ACL, automation tiers, templates

Eleven ordered, additive migrations turn the SOP's Session and plan promises
into database-enforced behaviour. Applied to `zglbgqeccebqnijcqfkb` after each
was dry-run against live schema and data in a rolled-back transaction.

**Entitlement control plane.** New `plan_entitlements` holds the SOP §6 plan
matrix as data; `organization_entitlements` became a projection of it, so a
Workspace can no longer drift from its plan. New `workspace_limits_overrides`
allows approved, raise-only numeric deviations that can never grant a gated
capability. `private.effective_entitlements()` is now the single authority every
quota check reads. Usage is a live view rather than a counter table.

**Session lifecycle.** `display_sessions` gained the full ten-state lifecycle
(draft → ready → starting → active ⇄ paused/degraded → stopping → stopped →
archived, with failed and recovery), enforced by a database transition table.
`starting`, `active`, `degraded` and `paused` all consume concurrent-Session
capacity, so pausing no longer frees a slot the Session is still using.

**Readiness.** `public.session_readiness()` returns a fourteen-check verdict with
customer-safe messages, and gates entry to `starting`. Readiness is no longer
inferred in TypeScript, so the start button and the database can no longer
disagree.

**Content-model fix.** Activation and screen assignment previously required a
per-screen Layout in independent and single mode, which made a Session carrying
a Board unable to start. A Display now has usable content if it carries a Layout
**or** the Session carries a Board.

**History and health.** New append-only `session_events` with no write policy —
the timeline cannot be edited through the API. New `display_health` (current
state) plus `display_health_events` (changes only, not per heartbeat), server-side
health derivation in `ingest_display_heartbeat()`, and a `session_health_summary`
rollup.

**Max capabilities.** Display Groups, Session Groups and resource-level access
control now exist with database-enforced entitlement gating. Group commands run
member by member through the lifecycle command, so a group can never exceed the
plan. Resource grants are additive only and can never narrow an Owner.

**Automation.** Plan tiers (Pro = daily/weekly, Max = adds hourly and custom) are
enforced at creation *and* re-checked at claim time, so a downgrade stops
execution. New `automation_runs` with a unique `(automation_id, scheduled_for)`
key makes execution idempotent; retries are bounded.

**Templates.** Session templates store screen *slots*, never Displays, and always
instantiate as drafts.

**Optimisation.** Twelve indexes, most importantly one on
`organization_members (user_id, org_id)` — every RLS policy in the schema
resolves through it.

Max remains **unavailable**: `plan_entitlements.availability` now records
commercial availability as data, and working schema is not a shipped product.
Groups, ACL, templates and automation execution have no manager UI yet.

SOP amended: Purpose §3.8, §6.4, §6.6, §7.1, §9.6 and Stage 8; Roadmap §6 and
§17. See `docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md` and
`docs/implementation/SESSION_PLATFORM_ROLLOUT.md`.

## 2026-07-30 - Guided Session builder

Replaced the thin New Session form with a four-step builder for Basics,
Displays, Behavior, and Review & launch. The builder uses the existing session
domain APIs to select ready displays, configure single/duplicate/extend/
independent behavior, assign layouts or an optional Board, validate the
mode-specific requirements, and launch the configured Session.

## 2026-07-30 - Pin Supabase MCP project target

Pinned `.mcp.json` to Scena's own Supabase project (`zglbgqeccebqnijcqfkb`)
instead of allowing a shared `SUPABASE_PROJECT_REF` variable to select the
target. Credentials remain environment-provided and are not stored in the
repository.

## 2026-07-24 — Board Editor configuration and live-session workflow

Aligned persisted Board Element configuration with the typed renderer contracts, including backward-compatible reads for existing Boards. Added typography controls, scene duration and transition controls, working QR-link and ticker/countdown configuration, and explicit preview-only treatment for weather, video, music player, and live data text. Updated the SOP tier capability matrix and sales representation rules.

## 2026-07-24 — Manager Asset Library

Added the first workspace-aware Asset Library using the typed v1.0.15 Workspace and Asset clients. Managers can list Assets for the selected Workspace, upload supported images/PDF/PowerPoint files through signed Storage URLs, finalize uploads, see processing status, and preview ready variants. Unsupported media types remain hidden from the upload picker, and stable API error codes are shown with actionable state labels. New Asset work does not call the legacy `presentation-upload` endpoint.

## 2026-07-23

- Board editor asset slice: render signed image and PowerPoint/PDF page previews on the canvas, show real upload thumbnails, and add local emoji/GIF-style library tiles alongside preset shapes.
- Asset signed-read contract now returns page-aware preview metadata and supports selecting previews by page ID, page number, or variant type without changing storage privacy or RLS.
- Board editor element slice: replace live-element placeholders with real clock, date, countdown, QR, music, ticker, carousel, video, weather, and data-text previews; add persisted configuration controls and a pinned QR generator dependency.
- Display runtime slice: assign a Board to a live session, render its scenes and live widgets on the kiosk, use the session location timezone for clock/date, and refresh weather through the server-side Open-Meteo adapter.

## Unreleased — Customer docs and community forum

Added the public customer guide at `/docs` covering Board creation, Display
pairing, Raspberry Pi players, Windows kiosk mode, smart TV browsers, plan
limits, version guidance, and network troubleshooting. Added `/community` as
a public forum with seeded setup conversations, searchable topics, signed-in
question and answer posting, and RLS-protected Supabase persistence.

## 2026-07-23 — v1.0.17 Editor shapes and element styling

Added shape variants (rectangle, ellipse, triangle, diamond, hexagon, star,
line, and arrow) to the board editor, with renderable presets, borders,
variant-aware sizing, and shared metadata for the editor and QA preview.
Element borders now normalize backward-compatible saved configs and apply to
supported element types. Updated board-editor defaults and the internal editor
preview to use the new shape insertion contract.

## 2026-07-23 — v1.0.16 A new UI

Full manager-portal visual and functional redesign built against the live
v1.0.15 Board/Asset/Workspace API (`src/services/scena-api/*`).

**Brand identity**: the Scena flower is now the product mark — a reusable
`ScenaMark` SVG component (`src/components/brand/ScenaMark.tsx`) used in the
app rail, landing nav/footer, and login card, plus an SVG favicon
(`public/favicon.svg`) and real `<head>` metadata (title, description,
theme-color, OpenGraph) in `index.html`. The token palette was rebranded from
violet/indigo to the flower-blue ramp (`--scena-brand: #5b7cfa` on navy-tinted
dark surfaces); the legacy `--scena-violet`/`--scena-indigo`/`--scena-cyan`
variable names remain as the consumed API and now resolve to the blue ramp.

**Design system**: new token system (`src/styles/tokens.css`),
self-hosted variable fonts (`@fontsource-variable/{bricolage-grotesque,
instrument-sans,jetbrains-mono}`, replacing the Google Fonts CDN link),
`@phosphor-icons/react` iconography, and ~30 reusable UI primitives
(Button, Modal, Drawer, DataTable, Toast, DropdownMenu, UploadDropzone, etc.)
in `src/components/ui/`, verified in an internal showcase at `/dev/components`
(not linked from production nav). The old gold/dark kiosk theme is kept
verbatim in `src/styles/legacy.css` for the kiosk (`/display`) only — the
"marquee" naming (the product's pre-Scena name) was scrubbed from it — and
computed-style checks confirmed neither theme bleeds into the other.

**Kiosk rebrand**: the `/display` kiosk dropped the old gold theme for the
Scena brand — navy scene, flower-mark + gradient wordmark lockup, glowing
blue pairing code (readable from meters away, `clamp` up to 4K), pulsing
standby dot, brand-glass diagnostics overlay. All kiosk logic and polled
behavior untouched; kiosk isolation (no `src/auth/*`/`src/app/*` imports)
preserved.

**Board editor rebuilt as a professional editor surface**: the single-toolbar
layout became a full editor shell — top bar (home, inline Board name,
undo/redo, save state, dimensions, Revisions, Save), a left icon rail with a
slide-out panel drawer (Elements grid, Text presets, Uploads, Templates,
Brand), the properties panel, and a bottom bar with zoom slider, a Scenes
strip toggle, and fullscreen. Templates and Brand are premium-gated with a
crown badge and an honest upsell linking to `/app/billing` — no fabricated
template or brand content. The chrome lives in presentational components
(`src/components/editor/{EditorShell,EditorPanels}.tsx`) that take all data
via props, so it also mounts with in-memory demo state at the internal
`/dev/editor` QA route. `useBoardEditor`, keyboard nudge/delete, save,
version-conflict recovery, and revisions are unchanged; the superseded
`EditorToolbar`/`ElementsPanel` were removed and the Asset fetch moved into
`BoardEditorPage`.

**Interactive hero editor demo**: the landing hero's static mock window was
replaced by the REAL Board editor embedded with in-memory state
(`src/pages/landing/HeroEditorDemo.tsx`) — the actual `EditorCanvas`,
`PropertiesPanel`, and `SceneStrip` components with drag/resize/select/edit/
undo/redo and scene switching, no network calls, framed as a product window
with a "this is the real editor" caption.

**Playful system states**: new `src/styles/states.css` grain-noise +
drifting-petal treatment for the 404 page (bobbing gradient "404"),
`RouteErrorBoundary`, and placeholder pages; all motion disabled under
`prefers-reduced-motion`. `LocationsPage` was rebuilt from the old
raw-JSON panel onto the new system (table, create/rename/deactivate
modals via `src/domain/locations.ts`) and Locations joined the rail.

**Public site & auth**: new `LandingPage` at `/` (hero, value props, real
capability stats, pricing from the SOP's published plan figures, FAQ, final
CTA, footer) replacing the old immediate-redirect `RootRoute` (deleted, along
with the already-dead `TeamRequiredPage`, superseded by v1.0.15's Personal
Workspace auto-provisioning). Login/Callback/Unauthorized pages re-skinned;
auth logic (PKCE, Google/email sign-in) untouched.

**App shell**: `AppShellRoute` rebuilt with an icon rail (Home, Boards,
Assets, Displays, Sessions, Automations, Members, Billing, Settings, More),
a real multi-Workspace switcher and account menu (both backed by the live
`workspace-context` API), replacing the old flat nav list.

**Home, Assets, Boards**: `HomePage` now shows real recent Boards/Assets,
Display online-count, and plan limits (previously a static welcome message).
New `AssetsPage`/`AssetDetailPage` (upload → process → ready pipeline, status
filters, signed previews) and `BoardsPage`/`NewBoardPage` (library, canvas-size
presets, archive), all against `src/services/scena-api/{boards,assets}.ts`.

**Board editor**: new full-viewport editor at `/app/boards/:boardId` — canvas
with drag/resize/rotate/z-order/keyboard nudge, Elements/Assets side panel,
properties panel, scene strip, undo/redo, and a real save flow using
`base_version` optimistic concurrency with an explicit `BOARD_VERSION_CONFLICT`
recovery dialog (reload latest, or save the draft into a new Board — there is
no in-place overwrite path). No Publish control (`SCENA_UI_API_CAPABILITIES.
boards.publish` is `false`). Revision creation/listing; no restore, since no
restore API exists. Covered by a dedicated unit-test suite for the
load/undo-redo/save/conflict/save-as-copy state machine.

**Displays, Sessions, Automations, Members, Billing, Settings**: existing
functional pages re-skinned onto the new system, logic unchanged. New
`MembersPage` (role change/remove via `organizations.ts`; no invite-by-email
UI, since no such API exists yet) and `BillingPage` (Stripe portal link,
new-paid-Workspace checkout — there is no in-place plan-upgrade API).
`organizations.ts#listMembers`/`upsertMember` now also select `status`
(column already existed, wasn't being read).

**Legacy content system removed**: the pre-Board Menus/Scenes/Layouts/
Presentations pages, their routes, the "More" index page, and the orphaned
`src/domain/{menus,scenes}.ts` modules and legacy `src/domain/assets.ts`
presentation path are deleted (data and Edge Functions untouched — this
removes manager UI only). Locations, which Displays and Sessions still
depend on, moved into the primary rail.

**Display, Session, and Automation management**: new `ScreenDetailPage`
(`/app/screens/:screenId` — rename, reassign location, revoke, via
`src/domain/screens.ts` incl. a new `getScreen`), new `SessionDetailPage`
(`/app/sessions/:sessionId` — rename, start/stop, delete draft, display
mode, add/remove/toggle/set-primary screens, via `src/domain/sessions.ts`),
and `AutomationsPage` gained inline create/rename/enable/disable modals
built from the real `AutomationInput` shape (`src/domain/automations.ts`).
The Displays and Sessions list rows now link to their detail pages. With
these, every reachable manager route is functional against real services
except `/app/settings/organization` (no organization-update API exists).

**Performance**: route-level code-splitting (`React.lazy`/`Suspense`) for the
landing page, the Board editor, and the dev showcase — cut the main bundle
from 735 KB to 608 KB gzipped-175 KB; it
still exceeds Vite's 500 KB chunk-size warning and would benefit from further
splitting (e.g. per-icon imports) as follow-up work.

**Bugs found and fixed during verification** (live browser testing, not just
type-checks): `Modal`/`Drawer` depended on an inline `onClose` callback
identity in their focus-trap effect, which re-ran on unrelated parent
re-renders and corrupted which element focus returned to on close — fixed by
reading the latest `onClose` through a ref instead of the effect's dependency
array. A `DropdownMenu` trigger wrapper rendered `<button><button/></button>`
(invalid HTML) — changed the wrapper to a `<span>`.

**Known gaps**: full signed-in verification (Workspace switching, Asset
upload, Board save/conflict) could not be exercised end-to-end in this
session's sandboxed browser, which has no real Google OAuth credentials —
verified instead via the type-checked, mocked-data test suite plus the
`useBoardEditor` unit tests. `/app/settings/organization` remains an honest
placeholder (no organization-update API exists). CI's Deno-check workaround
(mirroring `supabase/functions` outside the npm workspace) was re-run
manually and all 15 Edge Functions pass — no Edge Function source was
touched this session.

## 2026-07-23 — v1.0.15 UI API readiness

Added the production `workspace-context` Edge Function for multi-Workspace
bootstrap and selection, including safe fallback provisioning of the initial
Personal Workspace, entitlement loading, membership validation, and persisted
Workspace preference.

Added typed browser clients for Workspace context, Asset upload/processing, and
Board drafts. The clients require an authenticated session, preserve stable API
error codes/status/request IDs/details, expose capability switches, and keep
unsupported publishing, video, audio, font, and scene-render controls disabled.

Added the live-schema TypeScript compatibility overlay, removed the manager
guard's Team-only assumption, made Personal Workspaces valid manager contexts,
documented the first UI integration contract, extended contract validation, and
tracked database hardening that removes public execution of internal Asset and
Board quota helpers.

**Verification target**: TypeScript, unit tests, production build, every Edge
Function, API contracts, live migration advisors, production Workspace context,
and the already-passed external-network Asset and Board acceptance paths.

## 2026-07-23 — v1.0.14 production PKCE authentication

Changed Google OAuth and email-link authentication to use the PKCE code flow
with explicit callback exchange. Production redirects now resolve to
`https://scena.kpnsolute.com/auth/callback` unless an explicit
`VITE_SCENA_APP_URL` override is supplied.

The callback removes authorization parameters from browser history, rejects
legacy token-bearing URL fragments, and returns safe sign-in errors to the login
page. Added focused redirect, exchange, token-fragment, callback-success, and
callback-error tests.

**Verification**: GitHub CI passed TypeScript compilation, the complete unit-test
suite, the production build, Edge Function checks, and API contract validation.
Supabase Authentication URL Configuration must allow the production callback
URL; provider secrets remain dashboard-managed and are not stored in the
repository.

## 2026-07-22 — v1.0.13 media assets, Boards, and Proxmox worker

Added the canonical Workspace media and Board foundation with private Asset
storage, upload quota accounting, Asset Pages and Variants, leased processing
jobs, Boards, Scenes, Elements, revisions, publications, dynamic QR records,
and audio-provider references.

Added and deployed the `asset-upload`, `media-worker`, and
`board-interaction` Edge Functions to the current test Supabase project.
Registered `scena-media-01` with one-job concurrency and verified dedicated
hashed-token authentication, queue polling, and automatic restart after a VM
reboot.

Added the outbound-only Python worker for `image_ingest`, `pdf_import`, and
`powerpoint_import`, including signed source downloads, LibreOffice, Poppler,
and Pillow processing, signed output uploads, manifest generation, heartbeats,
completion callbacks, retry-safe failure callbacks, a hardened systemd unit,
and a credential-preserving installer.

**Verification**: GitHub CI was green for the API foundation; rollback-safe
database acceptance passed; worker dependency checks and image, PDF, and
PowerPoint processor smoke tests passed; the VM authenticated and remained
active after reboot. A real source upload through processing completion remains
pending, and the frontend still uses the legacy LXC `presentation-upload` path.

## 2026-07-20 — Backend rebuild gap closure: invalidation, verified tests, scheduler

Closed the verification and correctness gaps left open by the previous
rebuild pass. Two real bugs found and fixed in the process (see below) —
not hypothetical: one broke every kiosk's live-update path outright, the
other silently stranded failed one-shot automations forever.

**Bug fixes:**
- `src/shared/errors.ts#mapPostgresError` only read `.message` off real
  `Error` instances; PostgREST/Supabase errors are plain objects, so
  every mapped error silently fell through to a generic 400. Caught by
  running the test suite for the first time off the network share (see
  below) — 2 of 45 tests failed until fixed.
- The kiosk's realtime subscription (`Display.tsx`) used
  `postgres_changes` on `display_sessions`/`display_session_screens` via
  an unauthenticated (`anon`-role) connection. Every relevant RLS policy
  is scoped `to authenticated` — the kiosk never signs in by design — so
  this subscription structurally could never receive an event. Replaced
  with Realtime **Broadcast** (not RLS-gated) on a per-org channel,
  wired into every domain mutation and mutating Edge Function that can
  change what a kiosk renders.
- `automations-run`: a failed one-shot automation left `next_run_at =
  null`, which can never again satisfy `next_run_at <= now()` — silently
  stranded forever with no signal. Now retries on a 5-minute backoff
  until fixed or disabled.

**Added**: `src/services/supabase/invalidation.ts`,
`supabase/functions/_shared/broadcast.ts`,
`src/lib/display.test.ts`-equivalent
(`src/lib/display.invalidation.test.ts`, 6 tests),
`docs/SCHEDULER.md`, `docs/api-inventory.json`.

**Changed**: broadcast wiring added to
`src/domain/{menus,scenes,layouts,sessions,screens}.ts` (every
display-affecting mutation) and
`supabase/functions/{screen-claim,presentation-callback,automations-run}/index.ts`;
`display-gateway` now returns `org_id` so the kiosk knows which channel
to join; `docs/DATABASE_SCHEMA.md` §5 rewritten with exact
SQL/rollback/locking-risk/recommendation for both proposed (still
unapplied) migrations.

**Verification** (all off a local working copy at `C:\scena-work` — the
network-share `spawn EPERM` from the prior session was confirmed
environment-specific, not fixable from within the repo):
`npm ci` clean · `npx tsc -b` clean · `npx vitest run` **51/51 passing,
0 failing, 0 skipped** · `npm run build` succeeds (211 KB bundle) · all 8
Edge Functions pass `deno check` individually · automation
claim-race-safety and the full screen pairing→claim→heartbeat→
credential-rotation→reuse-rejection lifecycle both verified against the
live database via non-destructive, rolled-back SQL transactions.

## 2026-07-20 — Full application rebuild on the live display-management schema

Rebuilt the application code (manager service layer, kiosk client, Edge
Functions) around the live database, which had moved well past the old
`display_connections`/single-scene model into a normalized
locations → menus/scenes → layouts/tiles → sessions/session-screens →
automations schema with per-session entitlement enforcement, display-mode
validation, and pairing all implemented as triggers/constraints. No
database objects were dropped, renamed, or restructured — see
`docs/DATABASE_SCHEMA.md` for the full compatibility report and the two
proposed-but-unapplied hardening migrations.

**Removed** (old-model, incompatible with the live schema):
`src/lib/scenes.ts`, `src/lib/sessions.ts`, `src/lib/screens.ts`,
`src/lib/presentations.ts`, `src/lib/supabase.ts`, `src/boards.tsx`.

**Added**: `src/shared/{errors,validation,database.types}.ts`,
`src/services/supabase/client.ts`, `src/auth/{sso,organization-context}.ts`,
`src/domain/{organizations,locations,menus,scenes,layouts,screens,sessions,automations}.ts`,
`src/display/resolveDisplayState.ts` (+ tests), unit tests under
`src/shared/*.test.ts`, `vitest.config.ts`,
`supabase/functions/_shared/{errors,http,crypto,adminClient,managerAuth,displayState,cron}.ts`,
`supabase/functions/{screen-register,screen-credential-rotate,presentation-callback,automations-run}/index.ts`,
`docs/DATABASE_SCHEMA.md`, `docs/API.md`.

**Rewritten**: `src/App.tsx` (minimal functional harness, not a styled
portal — see docs/API.md), `src/Display.tsx` + `src/lib/display.ts`
(kiosk client: registration, polling, offline caching, realtime-hint
refresh), `supabase/functions/screen-claim/index.ts`,
`supabase/functions/display-gateway/index.ts`,
`supabase/functions/presentation-upload/index.ts`.

**Verification**: `npx tsc -b` clean (strict mode, zero errors) after
every change. `npm run build` / `npx vitest run` cannot execute in this
environment — `esbuild.exe` fails to spawn from this network share
(`spawn EPERM`, reproduced identically with sandboxing disabled and after
approving/re-running its postinstall script), a pre-existing environment
restriction unrelated to this rebuild. Business-rule error mapping was
instead verified against real trigger output via non-destructive,
rolled-back SQL transactions against the live database (entitlement
limit, draft-session-required, and display-mode/shared-layout messages
all matched `src/shared/errors.ts#mapPostgresError` exactly).

## 2026-07-20 — Manager SSO integrated into the rebuilt menu-board schema

The new menu-board schema (applied directly in the Supabase SQL editor,
outside tracked migrations) dropped `public.external_identities` and
emptied `organizations` / `organization_members`, which broke MJCC
manager sign-in: `mjcc-sso-exchange` resolves local users through that
table. This change restores the SSO bridge on top of the new schema
without altering any of its tables.

### Database (applied via Supabase MCP)
- `supabase/migrations/0008_manager_sso_identity_bridge.sql`
  - Recreated `external_identities` (provider `mjcc`, immutable
    `(provider, external_user_id)` → `user_id` mapping enforced by
    trigger, `last_login_at` audit column).
  - RLS: self + org-manager read only; all writes service-role only.
  - Re-seeded the `mjcc` organization (entitlements auto-created by the
    schema's `organizations_initialize` trigger).
  - Backfilled identity + `owner` membership for the surviving
    production auth user from `auth.users.raw_app_meta_data`
    (`mjcc_user_id`), so no duplicate account is created on next login.
- `supabase/migrations/0009_harden_auth_function_grants.sql`
  - Revoked anon/authenticated EXECUTE on trigger functions and anon
    EXECUTE on membership-check functions (advisor findings).
- Rollback script:
  `supabase/migrations/_drafts/rollback_0008_manager_sso_identity_bridge.sql`.

### Edge Function (code updated, NOT yet deployed)
- `supabase/functions/mjcc-sso-exchange/index.ts`
  - Fails closed (`403 organization_suspended`) when the org is not
    active.
  - Refreshes `role_snapshot` / `last_login_at` on every sign-in.
  - Deploy manually via the project-scoped Supabase CLI.

### Verification
- RLS behavior tested via rolled-back SQL transactions: member sees own
  org/membership/identity, non-member sees zero rows, client-role
  writes to `external_identities` denied.
- `npx.cmd tsc -b` clean. `vite build` blocked by a pre-existing
  environment issue (esbuild.exe cannot spawn from the network share).
- Supabase security advisors: no anon-facing findings remain.

### Known follow-ups
- Frontend/Edge display pipeline still references the old
  `display_connections` model while the live DB now has
  `screens` / `screen_pairing_codes` / `display_session_screens` —
  needs a separate migration of the app code to the new schema.
- The schema build scripts (`01_delete_current_menu_board_schema.sql`,
  `02_create_menu_board_schema.sql`) were run from outside the repo and
  are not committed; the live schema is the only copy.
