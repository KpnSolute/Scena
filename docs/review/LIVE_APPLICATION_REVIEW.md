# Live Application Review — Scena

**Ultrareview Phase 2.** Phase 1 (`/code-review ultra`) reads the diff. This phase
drives the *running site* and asks a different question:

> Does what the user sees actually work, and does every plan deliver what we sold?

This is the gate before Stripe goes live. A tier that charges for a capability
with no working UI is a refund, a chargeback, and a support ticket — not a bug.

This document is the single source of truth. `.claude/skills/live-review/SKILL.md`
and `.codex/prompts/live-review.md` are thin adapters that both point here. Change
the method here, never in the adapters.

---

## 1. Non-negotiables

* **Never fabricate a result.** If a route could not be reached, say "not reached"
  and why. A review that guesses is worse than no review.
* **Never fix while reviewing.** This phase produces findings. Fixing is a
  separate, approved pass. A half-fixed app makes the remaining findings untrustworthy.
* **Never write to the live database.** Read-only. No `apply_migration`, no
  `INSERT`/`UPDATE`/`DELETE`, no deploying Edge Functions.
* **Never enter real payment details.** Stripe checkout is walked up to the
  redirect and no further.
* **Evidence or it didn't happen.** Every finding carries a route, a file:line,
  and either a console/network excerpt or a described screenshot.

---

## 2. The four-layer trace

The deliverable is not "this page is broken." It is *which layer* is broken, so
the fix lands once in the right place. For every finding, walk down until you hit
the layer that is actually missing:

| Layer | Where it lives | Question |
|---|---|---|
| **L1 — UI** | `src/pages/**`, `src/components/**` | Is the control rendered? Enabled? Labelled truthfully? |
| **L2 — Client** | `src/domain/*.ts`, `src/services/scena-api/*.ts` | Is there a function that performs this? Is it wired to the control? |
| **L3 — API** | `supabase/functions/**` (deployed?), PostgREST tables, RPCs | Does the endpoint exist *and is it deployed*? |
| **L4 — DB** | tables, RLS policies, functions, triggers, scheduler | Does the data model support it? Is there a write policy or RPC? Does anything ever *run* it? |

Then classify the gap by its **deepest missing layer**:

* `L1-only` — backend is ready, UI absent. Cheapest fix.
* `L2` — API/DB ready, no client function.
* `L3` — code exists but is **not deployed**, or no endpoint.
* `L4` — schema/policy/scheduler gap. Most expensive.
* `L0` — everything exists and is wired; it's a *behaviour* bug.

State the classification explicitly on every finding. A finding without a layer
is an observation, not a finding.

---

## 3. Defect classes

Hunt all seven. The last one is the launch blocker.

| Class | Definition |
|---|---|
| **Missing** | Promised or expected; no UI exists at all. |
| **Incomplete** | UI exists but is partial — read-only, no create, no delete, no error path. |
| **Broken** | Throws, 4xx/5xx, blank render, console error, infinite spinner. |
| **Dead control** | Button/link/field renders and is enabled, but clicking it does nothing. |
| **Wrong** | Mislabelled, wrong vocabulary, stale copy, wrong data, misleading empty state. |
| **Unpolished** | Layout break, overflow, contrast, mobile, dark mode, missing loading/empty state. |
| **Untruthful** ⚠️ | The site states or implies a capability that does not work. **Blocks Stripe.** |

"Untruthful" is judged against what a *paying customer* would reasonably conclude
from the page — not against what the code intends.

---

## 4. Route inventory

Enumerate from `src/app/router.tsx` (`routeTree`) every run — never from memory,
never from this list. Routes change. Current shape:

**Public** — `/`, `/docs`, `/community`, `/login`, `/auth/callback`, `/unauthorized`
**Manager** (`/app`, behind `ManagerGuard`) — `home`, `boards`, `boards/new`,
`boards/:boardId` (full-screen editor), `assets`, `assets/:assetId`, `locations`,
`screens`, `screens/pair`, `screens/:screenId`, `sessions`, `sessions/new`,
`sessions/:sessionId`, `layouts`, `layouts/:layoutId`, `automations`, `members`,
`billing`, `settings`, `settings/organization`, `settings/plan`, `*`
**Kiosk** — `/display` (isolated tree; imports nothing from `src/auth` or `src/app`)
**Internal** — `/dev/components`, `/dev/editor` (must NOT be linked from production nav)

Cross-check against `src/app/route-metadata.ts`. That file is a self-declared
inventory of what is `functional` vs `placeholder`, with notes naming known gaps.

**Treat it as a hypothesis, not as truth.** Two findings live here:
a route marked `functional` that isn't, and a route whose `note` understates the
gap. Both are worth more than confirming the placeholders.

---

## 5. Per-route procedure

For each route:

1. Navigate. Record final URL (catch silent redirects and guard bounces).
2. `read_page` — structure, labels, controls, empty states. Prefer this over
   screenshots for verifying text; screenshots for layout only.
3. `read_console_messages` — errors *and* warnings.
4. `read_network_requests` — any non-2xx; note the failing table/RPC/function.
5. Exercise every interactive control. A control that is never clicked is never
   verified. For destructive controls, confirm the dialog appears — then cancel.
6. Note loading, empty, error, and populated states. Most gaps hide in empty state.
7. `resize_window` mobile + dark mode on visually dense routes (editor, boards,
   sessions, billing, landing).

Depth budget: every route gets steps 1–4. Steps 5–7 on routes that are part of
the customer's core loop — sign up → pair a Display → build a Board → run a
Session → get billed.

---

## 6. Tier-promise audit (the Stripe gate)

This is the part that decides whether Stripe can go live. It is a **three-way**
comparison, and every row needs all three columns filled:

| Column | Source |
|---|---|
| **Promised** | Landing pricing section, `/docs`, `/app/settings/plan`, `/app/billing`, any marketing copy |
| **Entitled** | `public.plan_entitlements` — the DB's own answer |
| **Delivered** | Does client code exist and is it reachable from the UI? |

Procedure:

1. Read `plan_entitlements` for every plan (`personal_free`, `plus`, `pro`, `max`)
   including `availability`.
2. Extract every capability claim from customer-facing copy, verbatim. Quote it.
3. For each capability, grep `src/` for a client function that performs it, and
   confirm a UI path reaches it.
4. Produce the matrix. Flag every row where the three columns disagree.

**Failure modes, in descending severity:**

* **Sold but undeliverable** — copy promises it, entitlement grants it, no
  implementation. *Blocks Stripe for that tier.*
* **Sold but never executes** — implemented and entitled, but nothing runs it
  (no scheduler, undeployed worker). Silently fails forever. *Blocks Stripe.*
* **Entitled but unsold** — DB grants it, copy never mentions it. Wasted build.
* **Sold above availability** — copy sells a plan whose `availability` is
  `limited`/`unavailable` without the SOP §3.1 written limitation.
* **Limit mismatch** — a number in copy differs from `plan_entitlements`.

Governing rules: SOP §3.1 (never sell an unavailable capability), §3.2
(current-plan promises take priority), §6 (`availability` is data, and a Stripe
price existing does not prove a plan is ready to sell).

---

## 7. Cross-cutting checks

* **Vocabulary (SOP §11).** Customer-facing text must say **Board** (not layout
  or tile), **Display** (not screen), **Workspace**/**Team**. The schema uses the
  old names on purpose; the *UI* must not leak them. Note that `/app/layouts`
  and `/app/screens` are the two highest-risk routes here.
* **Dual content model.** `boards`/`board_scenes`/`scene_elements` (live, has
  data) vs `display_layouts`/`display_layout_tiles`/`scenes`/`menus` (legacy,
  empty, still queried by `src/domain/layouts.ts`). Determine what a customer
  actually sees when both are surfaced in nav.
* **Auth boundaries.** `/app/*` while signed out → `/login`. Kiosk `/display`
  must never require a manager session.
* **Internal leakage.** `/dev/*` unlinked; no debug output, stack traces, IDs,
  or raw Postgres errors surfaced to customers.
* **Truthful empty states.** An empty list must not imply a broken feature, and
  a missing feature must not be disguised as an empty list.

---

## 8. Severity

Anchored on the Friday first-public-release and the Stripe go-live.

| Severity | Meaning |
|---|---|
| **P0 — launch blocker** | Money is wrong, a tier can't deliver what it sells, data crosses a Workspace boundary, or the core loop is impassable. |
| **P1 — must fix by launch** | A promised capability is missing/broken, or a customer hits a dead end with no workaround. |
| **P2 — should fix** | Visible incompleteness with a workaround; wrong vocabulary in customer copy. |
| **P3 — polish** | Cosmetic, responsive, or copy nits that don't mislead. |

Every P0/P1 needs a named fix location (`file:line`) and a layer classification.

---

## 9. Output

Two parts, in this order.

**A. Verdict** — 3–5 sentences. Can the site ship Friday? Can Stripe go live?
Name the single biggest problem. No hedging.

**B. Findings**, grouped by severity, each as:

```
### [P0] <short title>
Route:      /app/…                  Class:  Untruthful
Layer:      L3 (deployed?)          Files:  src/pages/x.tsx:42, src/domain/y.ts:10
Evidence:   <console excerpt / network status / quoted copy / what was seen>
Trace:      UI → client fn → endpoint → table/RPC. Where it actually stops.
Impact:     What the paying customer experiences.
Fix:        Smallest correct change, at the right layer.
```

Then the **tier-promise matrix** (§6) as its own table, and a **coverage list**:
every route, marked reached / not reached, with a reason for each miss.

Rank strictly by severity, not by discovery order or by route.

---

## 10. Running it

### Target

Default target is the **deployed site**, `https://scena.kpnsolute.com` — that is
what customers meet, and this phase reviews reality, not intent. Review a local
build only when explicitly asked, or to confirm a deployed defect is already
fixed in source; say which target produced each finding.

Local configs, if needed: `.claude/launch.json` — `scena-dev` (port 5174, HMR
and real error overlays) and `scena-preview` (serves `dist` on 5173). On a
network share, `spawn EPERM` means use the `CLAUDE.md` §4 local-copy workaround.

### Browser control

Each CLI drives the browser with **its own** integrated tooling. The method in
this document is tool-agnostic; the adapter for your CLI names the specific
calls. Do not shell out to a scripted browser, and do not start a dev server
through a generic shell — use the integrated browser surface.

Attach to an already-open tab when one exists rather than opening a second one;
a duplicate tab loses the signed-in session and silently turns a manager-route
review into a login-redirect review.

### Session

Signed-out routes are always reachable. Manager routes need a session. If the
open tab is already authenticated, use it. If no session is available, record
the affected routes as "not reached — no session" in the coverage list rather
than reporting the guard redirect as a finding.
