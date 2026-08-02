# Live Application Review — findings, 2026-08-02

Target: `https://scena.kpnsolute.com` (deployed). Method:
[LIVE_APPLICATION_REVIEW.md](../LIVE_APPLICATION_REVIEW.md). Signed in as
`jeremiahmcdowell874@gmail.com`, Workspace on `personal_free`.

## Verdict

**The site cannot ship Friday and Stripe must not go live yet.** One defect
dominates everything: a cold load of any `/app/*` URL logs the user out. A
customer who refreshes, bookmarks, or clicks a link into the app is told to sign
in while holding a valid session, and the only button offered destroys it. That
alone makes the product unusable and it blocked most of this review.

Separately, three tier promises are not deliverable today: `/docs` sells Plus an
automation tier the database explicitly denies; automation is sold on Pro and
Max but nothing in production ever executes it; and Max is sold at $40/month
with a live CTA while its own `availability` field says `unavailable`. Charging
real money against any of those is a refund and a chargeback, not a bug.

The foundations are good — the kiosk pairing flow, Board editor, Asset
pipeline, and the DB's enforcement layer are real and working. This is a
launch-blocking correctness problem, not a rewrite.

---

## P0 — launch blockers

### [P0-1] Cold-loading any `/app/*` route signs the user out
```
Route:  every /app/* (verified /app/home, /app/automations)
Class:  Broken            Layer: L0 (behaviour) — client-side session read
Files:  src/services/scena-api/client.ts:29, src/app/ManagerGuard.tsx:29,
        src/app/ManagerGuard.tsx:74-82
```
**Root cause — the server-side session was revoked; the client cannot tell.**

Probed directly from the page against the live backend with the stored token:

| Probe | Result |
|---|---|
| JWT decode | `alg ES256`, `iss …/auth/v1`, `sub` + `email` correct, **2459 s left** |
| `GET /auth/v1/user` (real anon key + this JWT) | **403 `session_not_found`** — *"Session from session_id claim in JWT does not exist"* |
| `GET /rest/v1/profiles` (same pair) | **200**, returns the user's own row |
| `POST /functions/v1/workspace-context` | **401** `{"code":"UNAUTHENTICATED","message":"Sign in is required."}` |

The access token is cryptographically valid and unexpired, but the Auth server
record for `session_id 772f0bb5-440c-4f2d-b96c-39bbb295b3d4` **no longer exists**
in `auth.sessions`. The stored `refresh_token` is a 12-character value
(`ikcgfgg25kro`), consistent with a session that was already rotated or revoked.

This produces a **split brain** that explains everything observed:

* **PostgREST keeps working** — it only verifies the JWT signature and reads
  claims; it never consults `auth.sessions`. So `src/domain/*.ts` table queries
  succeed, which is why the pre-existing tab's `/app/home` still rendered.
* **Every Edge Function fails** — they all authenticate via
  `auth.getUser()` (`asset-upload:310`, `billing-portal:28`,
  `billing-checkout:58`, `board-interaction`, `workspace-context`), which *does*
  hit the Auth server, gets `session_not_found`, and maps it to
  `UNAUTHENTICATED` → "Sign in is required."

`ManagerGuard` then treats that as `status:"error"` and routes to
**`/unauthorized`** — the wrong destination for an auth failure — where the only
control is **Sign out**.

Client-side, `getSession()` only reads `localStorage` and compares `expires_at`;
it never validates server-side state, and `autoRefreshToken` won't fire for
another ~48 minutes. So a dead session looks perfectly healthy to the app,
indefinitely.

**Impact.** Any customer whose session is revoked server-side — sign-out
elsewhere, session timebox, refresh-token rotation, or a JWT signing-key
change — is left holding a token the app believes is good. They get "Access
unavailable" on every Edge-Function-backed feature with **no path back to
sign-in**, while table reads keep working, so the app looks half-alive.

> ⚠️ **This also means `billing-checkout` and `billing-portal` are dead for this
> session** — same `getUser()` path. Stripe cannot be exercised end to end until
> this is fixed. Confirm both during the fix pass.

**Fix (two parts, both needed).**
1. **Recovery path:** treat a `UNAUTHENTICATED` / 401 from `callScenaFunction`
   as *unauthenticated*, not as a generic error — clear the local session and
   `Navigate to="/login"`. Today `ManagerGuard.tsx:74-82` sends it to
   `/unauthorized`, a dead end.
2. **Detection:** validate the session against the server on cold start (or
   treat the first 401 as authoritative) instead of trusting `expires_at` alone.

Then determine *why* the session was revoked — check Auth session-timebox /
inactivity settings and whether a JWT signing-key rotation to ES256 invalidated
existing sessions. That governs whether this hits every customer or only this one.

> This defect also **blocked this review**: no `/app/*` route could be reached
> on a cold load, so the manager surface is unverified (see Coverage).

### [P0-2] `/docs` sells Plus an automation tier the database denies
```
Route:  /docs → "Plans and capacity"
Class:  Untruthful        Layer: L1 (copy)
Files:  src/pages/docs/DocsPage.tsx:51
```
The published plan table lists **Plus → Automation: Basic**. The database says
`plan_entitlements.plus.automation_tier = 'none'`, and `enforce_automation_entitlement`
rejects it at write time. The landing page correctly omits automation from Plus,
so the two customer-facing surfaces also contradict each other.

**Impact.** A Plus customer who buys for scheduling hits a hard entitlement
rejection. Plus is `limited` availability and is one of the tiers about to be
charged real money.

**Fix.** Change `automation: "Basic"` to `"—"` on line 51, or raise the Plus
entitlement — a pricing decision, not an engineering one (SOP §6).

### [P0-3] Automation is sold on Pro and Max but never executes
```
Routes: /docs, / (pricing)
Class:  Untruthful (sold but never executes)   Layer: L3 + L4
Files:  supabase/functions/automations-run/ (not deployed)
```
`supabase functions list` returns 13 deployed functions; **`automations-run` is
not among them** (nor are `presentation-callback` or `screen-credential-rotate`).
`pg_extension` contains no `pg_cron` and no `pg_net`, so nothing schedules
anything either.

The DB side is complete and correct — `claim_due_automations()`,
`automation_runs` with its idempotent `(automation_id, scheduled_for)` key,
tier re-check at claim time, bounded retries. **None of it is ever invoked.**
Also inert for the same reason: `sweep_stale_display_health()` (Displays never
go offline automatically), `expire_stale_automation_leases()`, and
`prune_expired_history()` (`session_events` grows unbounded).

**Impact.** A Pro customer at $25/month schedules content that silently never
fires, with no error surfaced anywhere.

**Fix.** Deploy `automations-run`, enable `pg_cron` + `pg_net`, schedule the four
maintenance functions. Until then automation must not appear in paid copy.

### [P0-4] Max is sold with a live CTA while marked `unavailable`
```
Route:  / → Pricing
Class:  Untruthful        Layer: L1 (copy) + L2 (no client code)
Files:  src/pages/landing/LandingPage.tsx:51, :178-182
```
Max renders at **$40/month** with an active **"Choose plan"** button and the
feature line *"Advanced automation, groups"*. But
`plan_entitlements.max.availability = 'unavailable'`, and Display Groups /
Session Groups / ACL / templates have **zero client code** — `display_groups`,
`session_groups`, `resource_grants`, `session_templates` and their RPCs
(`session_group_command`, `create_session_from_template`, `my_resource_access`)
appear in `src/` only inside generated `database.types.ts`. No page, no domain
module, no reachable UI.

This violates SOP §3.1 (never sell an unavailable capability) and §6, which
states plainly that Max having working schema *is not* Max being deliverable.

**Fix.** Mark Max Waitlist / Coming later and disable its CTA until the manager
UI exists.

### [P0-5] Terms of Service and Privacy Policy do not exist
```
Route:  / → footer
Class:  Missing           Layer: L1
Files:  src/pages/landing/LandingPage.tsx:240-241
```
Both links point at `https://scena.kpnsolute.com` — the homepage. There are no
legal pages. Stripe requires published terms and a privacy policy before
accepting live payments, and this is legal exposure independent of Stripe.

---

## P1 — must fix by launch

### [P1-1] Pricing never consults `plan_entitlements.availability`
`src/pages/landing/LandingPage.tsx:46-52` is a hardcoded `PRICING` const. Every
plan gets an identical "Choose plan" CTA regardless of availability. Plus and Pro
are both `limited` yet are presented as generally available with no §3.1 written
limitation. The limit *numbers* were checked row by row against
`plan_entitlements` and **all match** — the defect is availability, not capacity.
Drive availability from the DB, the same way §6 already treats it as data.

### [P1-2] "All systems operational" is a hardcoded string
`src/pages/landing/LandingPage.tsx:247` renders this unconditionally, wired to no
health check. It would keep claiming green during a full outage. Remove it or
back it with a real status source.

---

## P2 / P3

* **[P2] Kiosk vocabulary.** `/display` says *"Enter this code in the Scena
  **control room**"*. "Control room" appears nowhere else in the product, the
  docs, or the SOP glossary; docs say to pair "from the Displays area". Align to
  SOP §11 terms.
* **[P3] Page titles.** `document.title` stays *"Scena — Design once, display
  everywhere"* on every `/app/*` route, so tabs and history are unusable.
* **[P3] Raw enum in UI.** `/app/home` renders the plan as **"Personal_free"**.
  Should be "Personal Free".

---

## Tier-promise matrix

| Capability | Promised | Entitled (`plan_entitlements`) | Delivered | Verdict |
|---|---|---|---|---|
| Displays / Boards / Members / Sessions limits | Landing + docs | matches exactly, all tiers | enforced by triggers | ✅ |
| Board editor, revisions | Landing, FAQ | n/a | real | ✅ |
| Asset upload (image/PDF/PPTX) | Landing, docs | n/a | real, workers deployed | ✅ |
| Display pairing (6-digit) | Landing, docs | n/a | verified live on `/display` | ✅ |
| Publish Board → Display | FAQ says **not yet** | n/a | `boards.publish: false` | ✅ honest |
| **Automation — Plus** | `/docs` says "Basic" | **`none`** | nothing runs | ❌ P0-2 |
| **Automation — Pro** | Landing + docs "Basic" | `basic` | **never executes** | ❌ P0-3 |
| **Automation — Max** | Landing + docs "Advanced" | `advanced` | **never executes** | ❌ P0-3 |
| **Groups (Display/Session)** | Landing "groups" | `true` on Max | **no client code** | ❌ P0-4 |
| Resource ACL, templates | not advertised | `true` (Max / Pro templates) | no client code | ⚠️ entitled but unsold |
| Team roles | Landing + docs | roles enforced | real (no invite-by-email UI) | ⚠️ incomplete |

---

## Coverage

**Reached:** `/` · `/docs` · `/display` · `/app/home` (pre-existing tab only)

**Not reached — blocked by P0-1:** every `/app/*` route on a cold load —
`boards`, `boards/new`, `boards/:id`, `assets`, `assets/:id`, `locations`,
`screens`, `screens/pair`, `screens/:id`, `sessions`, `sessions/new`,
`sessions/:id`, `layouts`, `layouts/:id`, `automations`, `members`, `billing`,
`settings`, `settings/organization`, `settings/plan`.

**Not reached — not attempted this pass:** `/community`, `/login`,
`/unauthorized` (seen only as a redirect target), `/dev/components`,
`/dev/editor`, 404 handling.

The manager surface needs a second pass once P0-1 is fixed. Treat every
"functional" claim in `src/app/route-metadata.ts` as unverified until then.
