# Scena Completion Build Plan

**Created:** 2026-08-15
**Baseline:** `main` at `776005617fbb3bc670c27bffef21f2da578196e2` (`v1.0.32`)
**Evidence:** `docs/review/findings/live-review-2026-08-15.md`
**Current roadmap stage:** Stage 0 — Foundation and First External Delivery

This is the governing implementation plan required by `AGENTS.md`. It closes
findings `SCENA-2026-08-15-001` through `SCENA-2026-08-15-016` without
rewriting the working Board editor, Asset pipeline, Display pairing setup,
Session wizard, or control-room foundation.

## 1. Operating rules

1. P0 work closes before unrelated P1/P2 work ships.
2. Every batch is independently reviewable and receives its own
   owner-approved commit identifier. Claude and Codex must not invent one.
3. Local implementation, database migration, Edge Function deployment,
   production configuration, Git publication, and live acceptance are separate
   states and separate approvals.
4. Claude Code implements only the active approved batch. Codex reviews the
   resulting diff and performs independent verification.
5. Existing user changes, including `.claude/settings.local.json`, are
   preserved. No reset, force-push, history rewrite, or unrelated cleanup.
6. A capability is not complete when its schema, UI, or function exists. It is
   complete only when the promised customer flow passes live acceptance.
7. Max remains unavailable until all Max requirements and Stage 2 entry gates
   are met. No batch below authorizes changing that status.

### Status vocabulary

| Status | Meaning |
|---|---|
| Planned | Scope and acceptance are documented only |
| Implemented | Source and tests pass locally |
| Migrated | Approved database migration applied and verified |
| Deployed | Approved application/function build is in production |
| Live verified | Customer flow passed in the deployed application |
| Accepted | Owner confirms the batch Definition of Done |

## 2. Claude Code workflow

Each batch uses two Claude passes and one independent Codex review.

### Planning pass

```powershell
claude -p "Read docs/BUILD_PLAN.md and docs/review/findings/live-review-2026-08-15.md. Plan only the approved <BATCH-ID>. Inspect the exact files listed, identify conflicts and tests, and make no edits, commits, pushes, deployments, or database changes." `
  --permission-mode plan `
  --tools Read,Glob,Grep `
  --setting-sources project `
  --effort high
```

### Implementation pass

Run only after the owner approves the batch roster:

```powershell
claude -p "Implement only approved <BATCH-ID> from docs/BUILD_PLAN.md. Preserve unrelated work. Add regression tests and update CHANGELOG.md. Do not commit, push, deploy, migrate, or change production. Stop and report if the required solution exceeds the approved file roster." `
  --permission-mode acceptEdits `
  --setting-sources project `
  --effort high
```

### Independent gate

Codex then checks the diff against the finding, runs the required local tests,
and reports residual risk. The owner separately approves:

1. exact commit identifier;
2. commit and push;
3. database migration, if any;
4. Edge Function deployment, if any;
5. web deployment;
6. live acceptance actions.

## 3. Ordered implementation batches

## P0-A — Commercial truth and server-side availability gate

**Findings:** `001`, `011`, `014`
**Objective:** Make every authenticated billing control agree with the live
entitlement and billing state. Remove the unsupported green status claim.

### Approved implementation roster

- `src/pages/billing/BillingPage.tsx`
- `src/domain/billing.ts`
- `src/domain/billing.test.ts`
- `src/pages/landing/LandingPage.tsx`
- `supabase/functions/billing-checkout/index.ts`
- new/updated billing-checkout tests or validation fixture
- `CHANGELOG.md`

### Required behavior

- Billing offerings display `generally_available`, `limited`, and
  `unavailable` truthfully.
- Max has no actionable checkout control while unavailable.
- `billing-checkout` rejects an unavailable entitlement even if `plans` is
  active and a Stripe price exists.
- Limited Plus/Pro offerings show the limitation before checkout.
- Manage Billing appears only for a Workspace with a portal-eligible billing
  customer/subscription; Personal Free gets explanatory copy instead of a
  failing button.
- Remove **All systems operational** until a real status source exists. Do not
  replace it with another fabricated state.

### Tests

- Rendering tests for GA, limited, unavailable, and no-billing-customer states.
- Function tests for unavailable Max, malformed offering, open checkout, and
  valid limited offering.
- `npm.cmd test`, `npx.cmd tsc -b`, `npm.cmd run build`, `git diff --check`.

### Deployment and rollback

- Edge Function deployment requires separate owner approval.
- Deploy function before or with the UI so the server gate is never weaker
  than the client gate.
- Rollback is previous Billing UI plus previous function version; if only one
  side can roll back, keep the stricter server rejection.

### Live acceptance

- Public Max remains disabled.
- Authenticated Max cannot open or call Checkout.
- Plus/Pro show limited availability.
- Personal Free no longer generates a Billing Portal error.

## P0-B — Legal and policy decision gate

**Finding:** `003`
**Objective:** Prevent draft legal copy from looking cleared and reconcile the
Privacy Policy with actual settings behavior.

### Owner/counsel decisions required before final implementation

- registered legal entity and address;
- governing law and jurisdiction;
- refund, cancellation, downgrade, and proration policy;
- liability and warranty terms;
- retention periods and deletion/export process;
- complete sub-processor and international-transfer disclosure.

Claude may prepare a clearly marked draft and wire approved text, but must not
invent these decisions or present itself as counsel.

### Likely files

- `src/pages/legal/LegalPage.tsx`
- `src/pages/legal/*test*` (new)
- `docs/sop/Purpose.md`
- new policy documents from batch OPS-A where approved
- `CHANGELOG.md`

### Acceptance

- No unresolved `LEGAL_REVIEW_REQUIRED` item is hidden from the owner.
- Rendered Privacy choices match features that actually exist.
- Counsel/owner approval is recorded outside source before live-payment
  authorization.

## P0-C — Controlled paid lifecycle acceptance

**Finding:** `002`
**Objective:** Prove the complete Stage 0 commercial loop after P0-A and P0-B.

This is an acceptance batch, not primarily a coding batch. It requires owner
approval for Stripe test-mode actions and a designated test identity.

### Acceptance sequence

1. Additional Personal one-time Checkout.
2. Verified webhook event and idempotent replay.
3. Exactly one Personal Workspace provisioned with correct entitlement.
4. Plus subscription Checkout.
5. Exactly one Team Workspace, Owner membership, subscription, and entitlement.
6. Billing Portal opens for the paid Workspace.
7. Cancellation-at-period-end behavior.
8. Failed-payment behavior and customer-visible state.
9. Pro test only after Plus passes.
10. Confirm Max remains rejected.

### Evidence

- Stripe event IDs and Scena record IDs may be recorded in a private acceptance
  record, never secrets or full customer data.
- Capture Checkout, webhook, provisioning, membership, entitlement, portal,
  cancellation, and replay outcomes separately.
- Do not claim Stage 0 exit until the external-customer and observation-period
  requirements in `docs/sop/Roadmap.md` are also met.

## OPS-A — Live health, retention, and scheduler foundation

**Finding:** `006` plus the retention scheduling gap documented by the SOP
**Objective:** Ensure active Session state cannot remain healthy while its
Display is stale, and establish one auditable scheduler foundation.

### Likely roster

- `supabase/functions/automations-run/index.ts` or a narrowly separated
  maintenance function, selected during the Claude planning pass
- `supabase/functions/_shared/*` only where necessary
- `supabase/migrations/20260731100300_display_health.sql` (historical; do not edit)
- new forward-only migration for scheduler jobs
- `src/pages/sessions/SessionDetailPage.tsx`
- `src/domain/sessions.ts`
- related tests
- `CHANGELOG.md`

### Required behavior

- A stale heartbeat changes Display health deterministically.
- Session control room distinguishes configured, assigned, polling, healthy,
  stale, and offline.
- Stale health, expired automation leases, and retention pruning run on bounded
  schedules with idempotent functions.
- Scheduler failures are observable and do not silently mark Sessions healthy.

### Approval and rollback

- Installing `pg_cron`/`pg_net`, applying a migration, and creating cron jobs
  each require explicit production approval.
- Rollback disables jobs first, then reverts the forward migration/function if
  necessary; never delete history as rollback.

### Live acceptance

- Start with a paired test Display, observe healthy heartbeat, stop its player,
  observe stale/offline within the documented threshold, restart, and observe
  recovery without manual database edits.

## OPS-B — Pro automation executor

**Finding:** `004`
**Depends on:** P0-A and OPS-A
**Objective:** Make Pro daily/weekly automation execute reliably and hide
creation controls from plans with `automation_tier = none`.

### Roster

- `supabase/functions/automations-run/index.ts`
- scheduler migration created in OPS-A
- `src/pages/automations/AutomationsPage.tsx`
- `src/domain/automations.ts`
- tests for entitlement, claim, execution, retry, lease expiry, timezone, and
  next occurrence
- `CHANGELOG.md`

### Acceptance

- Personal/Plus see the plan requirement before any creation form.
- Pro can create daily and weekly schedules only.
- One run fires exactly once, records outcome, updates next run, and survives a
  worker/function retry without duplicate action.
- Failed action exposes a safe error and bounded retry.
- Max advanced schedules remain unavailable with Max itself.

## TEAM-A — Team invitations

**Finding:** `008`
**Depends on:** P0-C Team provisioning proof
**Objective:** Let an Owner/Admin invite, inspect, revoke, and resend Team
membership invitations without database intervention.

### Likely roster

- `src/pages/members/MembersPage.tsx`
- `src/domain/organizations.ts`
- new invitation service/domain tests
- invitation delivery Edge Function if email delivery is selected
- forward migration only if current RPC contract is insufficient
- `CHANGELOG.md`

### Owner decision

Choose the delivery mechanism: configured transactional email provider, or an
explicit copyable invitation link for the first controlled pilot. Do not claim
email invitations if Scena only creates a token/link.

### Acceptance

- Owner invites an unrelated test user with a role.
- Invitee accepts once; replay and expired tokens fail safely.
- Owner protection, role limits, Workspace isolation, revoke, and resend pass.

## TEAM-B — Profile and Workspace settings

**Finding:** `009`
**Objective:** Replace the organization placeholder and make the Privacy Policy
claim truthful.

### Likely roster

- `src/pages/settings/SettingsIndexPage.tsx`
- new `src/pages/settings/OrganizationSettingsPage.tsx`
- `src/app/router.tsx`
- `src/app/route-metadata.ts`
- `src/domain/organizations.ts`
- profile/preferences service or domain module
- RLS/RPC migration only if direct scoped updates are not sufficient
- tests and `CHANGELOG.md`

### Required behavior

- Update allowed profile fields and preferences with validation.
- Rename/update allowed Workspace fields by role.
- Never expose immutable ownership, billing, slug, or identity fields as casual
  editable text.
- Reload persistence, errors, unauthorized roles, and Workspace switching pass.

## DATA-A — Tenant-friendly Connected Text authoring

**Finding:** `010`
**Objective:** Turn the working CloudEvents adapter into a user-operable
connection workflow.

### Roster

- `src/pages/connections/ConnectionsPage.tsx`
- `src/services/scena-api/contentSources.ts`
- `src/components/editor/EditorPanels.tsx`
- `src/components/editor/PropertiesPanel.tsx`
- `src/services/scena-api/boards.ts`
- focused connection/editor tests
- SOP and capability-matrix corrections
- `CHANGELOG.md`

### Required behavior

- Connected Text offers an active-source picker instead of pasted IDs.
- The user can inspect a bounded sample payload and select/validate a field
  path without exposing secrets.
- Preview shows resolved value, last event time/version, fallback, and a clear
  stale/disconnected state.
- Update stale copy that says the live provider is still future work.
- Keep weather, video, and music explicitly preview-only.

### Cross-project acceptance

Use a controlled KpnCompute/Lunchvoice CloudEvent through KpnSolute Events,
then verify the selected field updates a live Board/Display. Changes in those
repositories require their own plans, identifiers, commits, deployments, and
acceptance; this Scena batch does not authorize them.

## Studio Phase A — Canonical content and composition decision

**Finding:** `007`
**Objective:** End the customer-facing split between modern Board Scenes and
legacy Layout Scenes before adding more editor concepts.

### Recommended product decision

- **Board** is the playable program.
- **Board Scene** is a timed frame in that program.
- **Scene layout** is a preset/freeform arrangement of regions inside a Board
  Scene: single, horizontal split, vertical split, grid, and freeform.
- **Elements and Assets** live inside those regions.
- **Session display mode** routes Boards to Displays: single, duplicate,
  extend, or independent.
- The legacy `scenes`/`display_layouts` authoring route is removed from customer
  navigation after compatibility/migration proof; it is not expanded into a
  second editor.

This recommendation matches the current working Board model and the desired
Windows-style composition. Owner approval is required before implementation.

### Deliverables

- Architecture decision record and terminology update.
- Inventory of legacy Layout references in sessions, automations, gateway, and
  migrations.
- Compatibility and rollback plan for existing legacy Layout records.
- No schema deletion in this phase.

## Studio Phase B — Scene layouts and Board composition

**Depends on:** Studio Phase A approval
**Objective:** Implement multi-region Scene layouts in the modern Board editor
without breaking freeform element positioning.

### Likely roster

- `src/components/editor/EditorShell.tsx`
- `src/components/editor/EditorCanvas.tsx`
- `src/components/editor/EditorPanels.tsx`
- new Scene layout picker/preset components
- `src/services/scena-api/boards.ts`
- `src/pages/boards/BoardEditorPage.tsx`
- Board/editor/display tests
- `CHANGELOG.md`

Use existing `board_scenes.config` for preset metadata unless the planning pass
proves a normalized schema is required. Presets must be reversible and must not
destroy manually positioned Elements.

### Acceptance

- Apply each preset, assign content to two or more regions, save/reload, switch
  Scenes, revise, and render on `/display`.
- Existing freeform Boards remain pixel-stable.
- PowerPoint/PDF pages can be placed as Elements or rotations; importing a deck
  must not silently create an unwanted second content model.

## Studio Phase C — Max orchestration and reusable Sessions

**Finding:** `005`
**Depends on:** OPS-B, TEAM-A/B, Studio A/B, stable Plus/Pro operation
**Objective:** Complete the manager surfaces already entitled for Pro/Max.

### Sub-batches

1. Pro/Max Session Template list, create-from-Session, create-Session-from-
   template, archive, version, and slot assignment.
2. Max Display Groups and membership.
3. Max Session Groups and group commands.
4. Max resource ACL UI with effective-access explanation and Owner recovery.
5. Operational notifications if still part of the approved Max promise.

Each sub-batch gets its own approved roster and commit identifier. Do not ship
all Max surfaces as one unreviewable change.

### Acceptance

- Role and entitlement rejection is tested at UI, RPC, and RLS layers.
- Group commands are idempotent and show partial failure per destination.
- ACL cannot lock the Owner out or widen access across Workspaces.
- Templates reproduce Board, mode, fallback, and slot assignments accurately.
- Max remains unavailable until all sub-batches, automation, docs, support, and
  Stage 2 gates pass.

## OPS-C — Support and operational documents

**Finding:** `012`
**Runs in parallel after P0 scope is settled.**

Create and approve:

- Billing and Subscription Policy
- Display Deployment Guide
- Supported Hardware Matrix
- Customer Onboarding Record
- Support and Incident Escalation Policy
- Service Capability Register
- Data Retention and Workspace Deletion Policy
- Security Incident Response Procedure
- Feature Request Register
- Stage Transition Record template

Claude may draft technical facts from verified behavior. Owner, operations,
and counsel must supply commercial, support, legal, and escalation decisions.
Hardware may be marked supported only after model/browser/version acceptance.

## RELEASE-A — Production hygiene and release identity

**Findings:** `013`, `015`, `016`
**Objective:** Make production self-identifying and remove internal-only
surfaces and raw enums.

### Roster

- `src/app/router.tsx`
- route tests
- shared plan-label formatter and tests
- `src/pages/home/HomePage.tsx`
- `src/pages/settings/PlanSettingsPage.tsx`
- document title handling
- `package.json` only after the owner supplies the release identifier
- `CHANGELOG.md`, `RELEASE_NOTES.md`

### Required behavior

- `/dev/*` is absent from production builds or protected by an explicit
  non-production flag.
- Plan labels render `Personal Free`, `Plus`, `Pro`, and `Max` consistently.
- Route-specific document titles identify the active page/Board/Session.
- A safe build/release identifier is available for support diagnostics.
- Package/release metadata uses the exact owner-approved identifier; do not
  infer `v1.0.33` or any other version.

## 4. Dependency graph

```text
P0-A commercial gate ──┬── P0-B legal decisions ── P0-C paid acceptance
                       └── OPS-A health/scheduler ── OPS-B automation

P0-C ── TEAM-A invitations
     └─ TEAM-B settings

DATA-A connected authoring can proceed after P0-A

Studio Phase A decision ── Studio Phase B composition

OPS-B + TEAM-A/B + Studio A/B + stable Plus/Pro
    └── Studio Phase C Max orchestration

OPS-C documentation runs alongside implementation, but approval gates release.
RELEASE-A lands after the relevant behavior is stable and an identifier exists.
```

## 5. Batch verification standard

Every implementation batch must pass:

```powershell
npm.cmd test
npx.cmd tsc -b
npm.cmd run build
git diff --check
```

Edge Function batches additionally require isolated `deno check` for each
changed function and its shared imports. Database batches require:

- forward-only migration review;
- project-scoped Scena Supabase connection only;
- RLS and function-grant review;
- Supabase security and performance advisors;
- exact production migration proof after separate approval;
- documented rollback/disable procedure.

Live UI batches require desktop and mobile route checks, console and request
inspection, reload persistence, empty/error/permission states, and real
customer-flow acceptance. A green build is not live acceptance.

## 6. Definition-of-Done matrix

| Finding | Closing batch | Required evidence |
|---|---|---|
| 001 Max checkout bypass | P0-A | Max rejected in UI and function; live probe |
| 002 paid lifecycle unverified | P0-C | Checkout, webhook, Workspace, membership, entitlement, portal, replay |
| 003 legal drafts | P0-B | owner/counsel decisions and rendered approved copy |
| 004 automation inert | OPS-A/B | deployed runner, scheduler job, exactly-once live run |
| 005 Max UI absent | Studio Phase C | templates/groups/ACL acceptance; Max still gated until Stage 2 |
| 006 stale active Session health | OPS-A | stale/offline/recovery live Display test |
| 007 Board/legacy Layout split | Studio Phase A/B | approved ADR, compatibility proof, modern composition live |
| 008 invitations absent | TEAM-A | invite/accept/revoke/expiry/isolation live test |
| 009 settings placeholder | TEAM-B | update/reload/role/error acceptance and Privacy alignment |
| 010 connected authoring rough | DATA-A | source picker, field mapping, real CloudEvent-to-Display update |
| 011 broken Personal portal | P0-A | no failing portal control on unbilled Workspace |
| 012 operations docs absent | OPS-C | approved document set with owners and review dates |
| 013 public dev routes | RELEASE-A | production 404/guard and route tests |
| 014 hardcoded green status | P0-A | claim removed or backed by real status source |
| 015 stale release identity | RELEASE-A | approved version, build identity, remote/deploy/live proof |
| 016 raw plan enum | RELEASE-A | formatter tests and live labels |

## 7. Immediate next action

Start with a Claude Code planning pass for **P0-A only**. Do not combine it
with legal drafting, Stripe acceptance, automation, Studio changes, or Max UI.
After Claude reports the exact diff roster, the owner approves or adjusts that
roster before any implementation pass begins.
