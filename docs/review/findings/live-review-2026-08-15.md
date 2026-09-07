# Live Application Review — SOP gap audit, 2026-08-15

Target: `https://scena.kpnsolute.com` and the Scena production Supabase
project. Governing baseline:

- `docs/sop/Purpose.md`
- `docs/sop/Roadmap.md`
- `docs/sop/Workspace_and_Asset_Processing.md`
- the live `plan_entitlements` rows

The application was reviewed from an authenticated Owner account in a
`personal_free` Workspace. The review was read-only: no Session was launched,
no Display was registered, no Checkout was submitted, no production record was
edited, and no destructive confirmation was accepted.

## Verdict

**Scena is usable for controlled Personal Workspace pilots, but it is not ready
for unrestricted paid onboarding.** The core content path is materially real:
Boards have a functioning multi-Scene editor, images/PDFs/PowerPoint Assets are
processed, Display pairing has a clear self-device path, the Session wizard can
select a Display and Board, and the Session detail page exposes a genuine live
control-room surface.

Three launch blockers remain:

1. Max is marked `unavailable` in `plan_entitlements` and disabled on the public
   pricing page, but the authenticated Billing page offers an enabled Max
   checkout flow. The underlying `plans.max` row is active and has a configured
   Stripe price, so this is not merely a cosmetic button.
2. There is still no accepted paid lifecycle in production: zero Checkout
   Sessions, zero subscriptions, zero one-time purchases, and only one
   test-mode billing event. This does not satisfy Stage 0.
3. The public legal pages are still engineering drafts. The source explicitly
   lists six legal decisions requiring review, but none are disclosed on the
   rendered pages even though paid checkout offerings are active.

Automation, Max orchestration, live health reporting, Team invitations,
organization/profile editing, and the legacy Layout composition path are also
incomplete. The official Roadmap remains correctly at **Stage 0**.

---

## P0 — launch blockers

### [SCENA-2026-08-15-001] Max can enter Checkout while its entitlement is unavailable

```
Route:  /app/billing
Class:  Untruthful commercial gate
Layer:  L1 UI + L3 Edge Function + L4 database
Files:  src/pages/billing/BillingPage.tsx:19-26, 92-96
        src/pages/landing/LandingPage.tsx:55-58, 193-198
        supabase/functions/billing-checkout/index.ts:66-105
SOP:    Roadmap.md:66-83, 177-184, 263
```

Live evidence:

- `/` correctly renders Max as **Coming later** with a disabled button.
- `/app/billing` renders **Max Team Workspace — $40/month** with an enabled
  **Get started** button.
- Clicking it opens the real **Name your new Workspace** checkout dialog.
- `plan_entitlements.max.availability = 'unavailable'`.
- `plans.max.is_active = true`, its billing mode is `subscription`, and a
  Stripe price is configured.
- `billing-checkout` validates `plans.is_active` and price configuration; it
  does not reject an offering whose `plan_entitlements.availability` is
  `unavailable`.

Impact: a signed-in customer can proceed toward paying $40/month for Groups,
ACL, templates, and advanced automation that the product and SOP both say are
not deliverable. This directly violates Roadmap §3.1.

Smallest safe correction: make the authenticated Billing catalog use the same
availability control as public pricing, and enforce the availability state
again in `billing-checkout` so a stale or crafted client cannot bypass it.

### [SCENA-2026-08-15-002] No paid Workspace lifecycle has production acceptance

```
Routes: /app/billing, Stripe webhook path
Class:  Unverified service obligation
Layer:  L3-L4
SOP:    Purpose.md:500-523, 941-954
        Roadmap.md:193-220, 459-463
```

Production totals on 2026-08-15:

| Record | Count |
|---|---:|
| `checkout_sessions` | 0 |
| `workspace_subscriptions` | 0 |
| `workspace_purchases` | 0 |
| `billing_events` | 1 |

The only billing event is test mode and processed. There is no evidence of a
completed Additional Personal purchase, Plus/Pro subscription, webhook-created
Team, Owner membership, paid entitlement snapshot, cancellation, failed
payment, downgrade, or portal lifecycle. Plus and Pro remain `limited`, which
is truthful in the entitlement table and on public pricing, but the Billing UI
offers their checkout flows to every signed-in Owner without a controlled
onboarding gate.

Impact: the central Stage 0 commercial loop has code and configuration but no
customer-facing acceptance evidence. The SOP explicitly says configuration is
not completion.

### [SCENA-2026-08-15-003] Legal pages are not cleared for live payments

```
Routes: /terms, /privacy, /app/billing
Class:  Incomplete legal/commercial surface
Layer:  L1
Files:  src/pages/legal/LegalPage.tsx:12-19, 72-101
```

`LEGAL_REVIEW_REQUIRED` names six unresolved decisions:

- governing law and jurisdiction;
- refunds, cancellation, and proration;
- liability and warranty terms;
- data-retention periods;
- sub-processors and international transfers;
- registered entity name and contact address.

That constant is never rendered. The live pages therefore look final while the
source says they must be replaced before accepting live payments. The Privacy
Policy also says users can update their profile and preferences, while the live
Settings page is read-only and route metadata confirms there is no update API.

Impact: checkout offerings are active beside incomplete and partly inaccurate
legal representations.

---

## P1 — required before a paid or unattended rollout

### [SCENA-2026-08-15-004] Pro automation can be configured but cannot execute

```
Route:  /app/automations
Class:  Missing execution path
Layer:  L2-L4
Files:  supabase/functions/automations-run/ (source only)
        src/pages/automations/AutomationsPage.tsx:37-106
SOP:    Purpose.md:259-276; Roadmap.md:159-161, 200
```

- Pro entitlement: `automation_tier = 'basic'`.
- Max entitlement: `automation_tier = 'advanced'`.
- `automations-run` exists in source but is absent from the 14 deployed Edge
  Functions.
- `pg_cron` and `pg_net` are not installed, and `cron.job` does not exist.
- Production contains zero Automations and zero Automation Runs.
- The Personal Free UI still exposes **New automation**, opens the complete
  creation form, and waits for the database to reject an unsupported write.

The schema and claim/run history contract are not an executor. Until a runner
and scheduler are deployed and accepted, Pro's paid automation promise is not
delivered. The Personal/Plus UI should also gate the feature before presenting
a form that cannot succeed.

### [SCENA-2026-08-15-005] Max orchestration exists only as schema and RPCs

```
Routes: no manager routes exist
Class:  Missing product surfaces
Layer:  L2
Files:  src/app/router.tsx:73-107
        docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md:321-371
```

Display Groups, Session Groups, resource ACL, and Session Templates have live
tables and enforcement functions, but no manager page, navigation, domain
workflow, or customer-operable control. Production counts for
`display_groups`, `session_groups`, `resource_grants`, and `session_templates`
are all zero. Pro is also entitled to Session Templates, so this is not solely
a future Max issue.

The database correctly keeps Max unavailable. Finding 001 is the defect that
allows the otherwise-honest availability state to be bypassed.

### [SCENA-2026-08-15-006] An active Session has no current Display health

```
Route:  /app/sessions/:sessionId
Class:  Incomplete live telemetry
Layer:  L0 + L4
```

Production contains one `active` Session whose readiness is `ready`, with one
enabled Display assignment, but its health is `unknown` and it has no
`display_health.last_heartbeat_at` in the last five minutes. The latest
`screens.last_seen_at` anywhere in the project is 2026-08-06, nine days before
this review.

This means lifecycle state can remain active after the player is no longer
reporting. The control room cannot yet be treated as proof that content is
actually playing. Stale-health sweeping and operational reconciliation need a
real scheduled path and UI state.

### [SCENA-2026-08-15-007] Modern Board Scenes cannot populate legacy Layout tiles

```
Routes: /app/boards/:boardId, /app/layouts/:layoutId
Class:  Architectural workflow split
Layer:  L0-L2
Files:  src/app/route-metadata.ts:24, 35
        src/pages/layouts/LayoutDetailPage.tsx:262-263
```

The Board editor has real `board_scenes` and `scene_elements`; the audited
Board had two editable Scenes. The separate Layout editor still consumes the
legacy `scenes` model. Its live empty state says **No Scenes available** and
explicitly states there is no Scene-creation flow, so no tile can be added.

Impact: a customer can build a rich Board but cannot use that content to build
the multi-window Layout workflow advertised by the Layout area. Scena needs
one customer model: either Layout regions host Boards/Board Scenes, or the
legacy Scene authoring path must be completed and clearly differentiated.

### [SCENA-2026-08-15-008] Team member onboarding has no invitation flow

```
Route:  /app/members
Class:  Incomplete Team workflow
Layer:  L2
Files:  src/app/route-metadata.ts:38
        src/pages/members/MembersPage.tsx:1-3
```

Role changes and removal exist, and `team_invitations` plus its RPCs exist in
the database, but there is no invite-by-email client function or UI. Production
contains zero Team invitations. The landing page and SOP present Team
collaboration as a paid capability; a new Team cannot self-serve adding its
first collaborator.

### [SCENA-2026-08-15-009] Workspace and profile settings are incomplete

```
Routes: /app/settings, /app/settings/organization
Class:  Placeholder/read-only surface
Layer:  L1-L3
Files:  src/app/route-metadata.ts:40-41
```

- Profile information is read-only; there is no update-profile API.
- Organization settings is a production-visible placeholder and states that
  no organization-update service exists.
- The Privacy Policy promises profile and preference updates that the product
  cannot perform.

### [SCENA-2026-08-15-010] Connected data works at playback but authoring is still adapter-like

```
Routes: /app/connections, /app/boards/:boardId
Class:  Incomplete integration UX and stale capability documentation
Layer:  L1-L2
Files:  src/components/editor/EditorPanels.tsx:180
        src/components/editor/PropertiesPanel.tsx:262-264
        src/services/scena-api/boards.ts:416-440
        supabase/functions/display-gateway/index.ts:199-218
```

This capability has advanced beyond the SOP's old “preview only” description:
`content-source` is deployed, production has one source and three accepted
events, and `display-gateway` resolves `source_id` + `source_key` into a live
`resolved_value`.

However, the editor still says to connect an API “later,” labels Connected Text
as setup, requires users to paste a raw Connection ID and dot path, and still
classifies `data_text` among elements without a data source. There is no source
picker, payload browser, field preview, validation, or mapping assistant.

Impact: the KpnCompute/Lunchvoice/CloudEvents adapter is technically connected
but not yet a tenant-friendly protocol workflow. The SOP and capability ledger
also need to distinguish live Connected Text from weather/video/music previews.

### [SCENA-2026-08-15-011] Billing portal is offered where it cannot work

```
Route:  /app/billing on Personal Free
Class:  Broken control state
Layer:  L0-L2
Files:  src/pages/billing/BillingPage.tsx:78-85
```

The Personal Free Workspace has no billing customer, yet **Manage billing** is
enabled. Clicking it live returns the inline error **Billing portal could not
be opened.** The control should only be offered when the Workspace has a
portal-eligible billing record; otherwise it should explain that there is no
subscription to manage.

### [SCENA-2026-08-15-012] Required support and operations documents are absent

```
Class:  Missing operational readiness artifacts
Layer:  L1 / governance
SOP:    Purpose.md:955-970; Roadmap.md:485-513
```

The repository has the three governing SOPs and customer docs, but does not
contain the named Billing Policy, Display Deployment Guide, Supported Hardware
Matrix, Customer Onboarding Record, Support and Incident Escalation Policy,
Service Capability Register, Data Retention/Deletion Policy, Security Incident
Response Procedure, Feature Request Register, or Stage Transition Record.

The missing hardware matrix is especially material because `/docs` recommends
Raspberry Pi, Windows kiosk, and smart-TV browser paths without a tested model,
browser, version, limitation, or support matrix.

---

## P2 / P3 — quality and release gaps

### [SCENA-2026-08-15-013] Internal QA routes are public in production

`/dev/components` and `/dev/editor` sit outside `ManagerGuard` in
`src/app/router.tsx:114-116` and render successfully on production. They expose
mock data, unfinished controls, and internal terminology. No secret was
observed, so this is release hygiene rather than a demonstrated data breach.

### [SCENA-2026-08-15-014] Public status is a hardcoded green claim

`src/pages/landing/LandingPage.tsx:268` always renders **All systems
operational**. It is not connected to Display health, Edge Function health,
Supabase status, or an incident feed. On this review date it remained green
while the only active Session had unknown/stale health.

### [SCENA-2026-08-15-015] Release identity is stale and absent from the UI

Git `main` is commit `776005617fbb3bc670c27bffef21f2da578196e2` titled
`v1.0.32`, while `package.json` still says `1.0.2` and the newest repository tag
is `v1.0.1`. Every audited route also uses the same generic document title.
This makes incident correlation, customer support, and deployed-version proof
unnecessarily difficult.

### [SCENA-2026-08-15-016] Raw plan enum reaches the customer

The home page renders `Personal_free`, because it capitalizes the stored enum
without replacing the underscore. Plan Settings renders the same raw value.
Customer-facing text should be **Personal Free**.

---

## Promise / entitlement / delivery matrix

| Capability | Promised or scoped | Entitled | Delivered on 2026-08-15 | Verdict |
|---|---|---|---|---|
| Personal Workspace provisioning | SOP + public site | GA | Authenticated Workspace exists and loads | Delivered |
| Board editor and revisions | Public site + SOP | all plans | Multi-Scene editor, save/revisions controls live | Delivered |
| Image/PDF/PPTX Assets | Public site + SOP | all plans | 4 Assets, 50 pages, 4 succeeded jobs; live upload UI | Delivered |
| Video/audio/font ingest | Explicitly excluded | none | hidden/unsupported | Honest limit |
| Weather/video/music | Preview only | preview only | clearly marked setup/preview | Honest limit |
| Connected Text via CloudEvents | integration scope | workspace source | deployed; one source, three events; rough authoring UX | Partial |
| Display pairing | Public site + SOP | display quota | setup page, player URL, self-device flow, paired Displays | Delivered; current players stale |
| Board → Session → Display | Public site + SOP | session/display quota | wizard reaches launch review with selected Board + Display | Delivered for setup; live health incomplete |
| Board publication workflow | SOP says not available | none | no Publish control | Honest limit |
| Plus checkout / Team provisioning | paid promise, limited | Plus | configured, no completed acceptance record | Unverified P0 |
| Pro automation | paid promise, limited | basic | UI/schema only; no runner/scheduler | Missing P1 |
| Session Templates | Pro and Max | enabled | schema/RPC only; no UI | Missing P1 |
| Max Groups/ACL/advanced automation | Max, unavailable | enabled in Max | schema/RPC only; no UI/executor | Correctly unavailable, but checkout bypass P0 |
| Team invitations | Team collaboration | Team roles | DB RPC only; no UI | Missing P1 |
| Workspace/profile editing | settings/privacy | n/a | placeholder/read-only | Missing P1 |
| Retention | plan retention fields | all plans | pruning function exists; no scheduler | Missing operations path |

---

## Live route coverage

| Surface | Result |
|---|---|
| `/`, `/docs`, `/community`, `/terms`, `/privacy` | rendered; no console errors observed |
| `/login` while authenticated | redirected to `/app/home` |
| `/unauthorized` | rendered expected recovery state |
| `/app/home` | real counts and recent content; raw plan enum |
| `/app/boards`, `/app/boards/new`, `/app/boards/:id` | real list/create/editor surfaces |
| `/app/assets`, `/app/assets/:id` | real upload/list/detail and processed PowerPoint pages |
| `/app/locations` | real list and create control |
| `/app/screens`, `/app/screens/pair`, `/app/screens/:id` | real list/pair/detail; self-device option present |
| `/app/layouts`, `/app/layouts/:id` | real legacy Layout CRUD; blocked by absent legacy Scenes |
| `/app/sessions`, `/app/sessions/new`, `/app/sessions/:id` | real wizard and control room; launch intentionally not submitted |
| `/app/automations` | form opens on unsupported Personal plan; no executor deployed |
| `/app/connections` | real empty state; production backend has accepted events |
| `/app/members` | real member list; no invite flow |
| `/app/billing` | Max checkout bypass and broken Personal portal control confirmed |
| `/app/settings`, `/app/settings/organization`, `/app/settings/plan` | read-only, placeholder, entitlement display |
| `/dev/components`, `/dev/editor` | reachable in production |
| unknown route | branded 404 works |

`/display` was not opened in a fresh browser context because doing so registers
a production Display and creates state. Its manager-side pairing route and
deployed `screen-register`, `screen-claim`, and `display-gateway` functions were
inspected instead. `/auth/callback` was not driven through an external OAuth or
magic-link round trip. Checkout, Session launch, upload, invitations, and
destructive controls were not submitted during this read-only review.

---

## Production evidence snapshot

- Git checkout: `main` equals `origin/main` at `7760056` (`v1.0.32`), with one
  unrelated untracked `.claude/settings.local.json` preserved.
- Deployed Edge Functions: 14 active. Source-only gaps include
  `automations-run`, `presentation-callback`, and
  `screen-credential-rotate`.
- Asset worker activity, last 24 hours: 15,434 successful `media-worker` calls,
  one 502, and one 520. The queued-processing path is active, not merely source.
- Database: 4 Workspaces, 5 Boards, 7 Board Scenes, 13 Scene Elements, 4 Assets,
  7 Displays, 6 Sessions, one active Session, one Content Source, three Content
  Events.
- Scheduler: no `pg_cron`, no `pg_net`, no `cron.job`.
- Security Advisor: warnings require a separate authorization review for
  authenticated access to numerous `SECURITY DEFINER` RPCs. This audit did not
  classify them as vulnerabilities without tracing each function's internal
  authorization checks.

## What is complete enough to keep

- The modern Board editor is no longer a generic placeholder. It supports
  multiple Scenes, element categories, presets, Assets, transitions, timing,
  revisions, and connected-data configuration.
- The Session wizard's card-based Display and Board selection works through the
  review step and no longer depends on an empty Layout dropdown.
- The Session detail page has a credible OBS-like control-room foundation:
  routing modes, Board destinations, task-view controls, history, readiness,
  and live Board editing.
- The Asset pipeline is operational and durable records show successful image
  and PowerPoint processing.
- The Display pairing page now gives the player URL and an explicit **Use this
  device as a Display** path.
- Max is correctly disabled on public pricing and correctly unavailable in
  entitlements; the authenticated Billing page is the inconsistent surface.

These foundations should be completed, not rewritten.
