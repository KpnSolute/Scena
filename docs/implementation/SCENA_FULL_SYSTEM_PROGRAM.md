# Scena Full System Program

**Status:** In delivery
**Started:** 2026-07-31
**Governing SOPs:** [`docs/sop/Purpose.md`](../sop/Purpose.md) v1.3, [`docs/sop/Roadmap.md`](../sop/Roadmap.md) v1.2
**Governing repo rules:** [`AGENTS.md`](../../AGENTS.md) / [`CLAUDE.md`](../../CLAUDE.md)
**Supabase project:** `zglbgqeccebqnijcqfkb`

This document is the authoritative architecture for the Session platform:
entitlements, Session lifecycle, readiness, health, history, groups, resource
permissions, automation and templates. Where it refines or extends the SOP, the
refinement is called out and the SOP has been amended to match.

---

## 1. What already existed

The inventory below was taken from the live schema on 2026-07-31, not from
documentation.

| Area | State before this program |
|---|---|
| Workspaces | `organizations` + `organization_members` + `organization_entitlements`, surfaced as the `workspaces` / `workspace_memberships` / `workspace_entitlements` views |
| Billing | `plans`, `workspace_subscriptions`, `checkout_sessions`, `billing_events`, `billing_customers`, `billing_notification_outbox` — complete |
| Content | `boards`, `board_scenes`, `scene_elements`, `board_revisions`, `board_publications`; legacy `display_layouts` + `display_layout_tiles` coexisting |
| Assets | `assets`, `asset_variants`, `asset_pages`, `asset_processing_jobs`, `asset_upload_events`, `media_workers` — complete durable queue |
| Displays | `screens`, `screen_pairing_codes`, `locations` |
| Sessions | `display_sessions` (draft / active / stopped only), `display_session_screens` |
| Automations | `display_automations` — definitions only, no execution, no tier gating, no run history |
| RLS | `private.is_org_member()` / `private.has_org_role()` on every public table |
| Quotas | Board, Display, member and concurrent-Session triggers, all reading `organization_entitlements` directly |

**Absent entirely:** Display Groups, Session Groups, resource ACLs, Session
readiness, Session history, Display health, automation runs, Session templates,
entitlement overrides, entitlement audit.

**Production data volume at migration time:** 3 Workspaces, 3 members, 2
Displays, 1 draft Session, 2 Boards, 2 Assets, 0 subscriptions. This is what made
an additive migration series safe to apply the same day.

---

## 2. Architecture decisions

Each decision below was made during implementation, is recorded here, and where
it refines the SOP the SOP has been amended in the same change.

### 2.1 Four entitlement authorities, not one

| Authority | Table | Meaning |
|---|---|---|
| Commercial catalogue | `plans` | What Stripe sells |
| **Designed capability** | `plan_entitlements` *(new)* | SOP §6 expressed as data |
| **Per-Workspace baseline** | `organization_entitlements` | Projection of the plan |
| **Approved deviation** | `workspace_limits_overrides` *(new)* | Raise-only numeric overrides |

`private.effective_entitlements(org_id)` merges baseline + live override and is
**the only authority** any server-side check may consult. Reading
`organization_entitlements` directly is now a bug, because it silently ignores
approved overrides. Every quota trigger was rewritten to use the resolver.

**Drift is structurally impossible.** `private.project_plan_entitlements()` runs
`BEFORE INSERT OR UPDATE` on `organization_entitlements` and overwrites every
capability column from `plan_entitlements`, whatever the caller supplied. A
hand-edit that tries to grant `allow_display_groups` on a Plus Workspace is
silently corrected rather than accepted. The pre-existing
`organization_entitlements_plan_shape_check` was kept as defence in depth.

**Overrides may only raise numeric limits, and may never grant a capability.**
Allowing an override to flip `allow_display_groups` would mean Max features
could be handed out without a Max subscription, which SOP Roadmap §3.1 forbids.
`private.enforce_override_is_raise_only()` rejects any override that lowers a
limit, so an "override" can never become a stealth downgrade.
*SOP amendment: Purpose §7 gained a Limit Overrides subsection.*

**`max_displays_per_session` is not overridable at all.** SOP Purpose §6.4 makes
the four-Display Session cap universal, so it is deliberately absent from the
override table.

**Usage is a view, not a counter table.** The program brief proposed
`workspace_usage_counters`. A stored counter drifts the first time a delete
path misses a decrement; at Scena's data volume a view cannot.
`public.workspace_usage_current` computes Displays, Boards, members, active
Sessions and monthly uploads live, backed by the indexes in migration 11.
*Deliberate deviation from the proposed table name, justified by the brief's own
instruction not to duplicate structures that already satisfy the contract.*

### 2.2 Session lifecycle

Ten states, one column. `status` was extended rather than joined by a parallel
`lifecycle_state` column — two columns describing one fact is how drift starts,
and every existing caller already reads `status`.

```
draft ──► ready ──► starting ──► active ⇄ paused
             ▲          │           │  ╲
             │          ▼           ▼   ╲──► degraded ⇄ active
             │       failed ◄───────┤
             │          │           ▼
             └──────────┘        stopping ──► stopped ──► archived
```

`private.session_transition_allowed(from, to)` is the transition table;
`enforce_session_lifecycle_transition()` enforces it `BEFORE UPDATE` and stamps
the timestamps the caller is not trusted to set. `public.session_transition()`
is the single transactional command surface: it checks the Workspace role,
applies the transition and lets the audit trigger record it.

**States that hold Displays consume concurrent-Session capacity:** `starting`,
`active`, `degraded`, `paused`. A paused Session has *not* released its screens,
so counting it as free capacity would let a one-Session plan hold two Sessions'
worth of Displays. This is asserted by test 6.
*SOP amendment: Purpose §6.4 now states which states consume capacity.*

**Recovery from `failed` returns to `ready`, never straight to `active`.**
Readiness must be re-proven before Displays are driven again.

**`started_by` is not required on an active Session.** An automation or the
scheduler can legitimately start a Session with no human actor; requiring one
made scheduled starts impossible. Attribution for those lives in
`session_events.actor_type`. *This defect was caught by the test suite after the
lifecycle migration had already been applied; migration 11 carries the
corrective `ALTER`, and the lifecycle migration was corrected so a from-scratch
run is right first time.*

### 2.3 Readiness is computed once, in the database

`public.session_readiness(session_id)` returns fourteen rows — `check_key`,
`passed`, `severity`, `blocking`, safe `message`, `resource_type`,
`resource_id`. `public.session_readiness_summary()` aggregates it.

Before this program readiness was inferred in TypeScript, which meant the start
button could say "ready" while the activation trigger disagreed. The UI now
**renders** this checklist and must not compute a second opinion.

`enforce_session_start_readiness()` blocks entry to `starting` when any blocking
check fails, which is what makes readiness enforceable rather than decorative.

`blocking` is separate from `severity` so a Display that is paired but currently
offline is a visible warning rather than a refusal — it will pick up content
when it reconnects.

**Content-model correction.** `validate_display_session_activation()` previously
required a per-screen `layout_id` in independent/single mode, which meant a
Session carrying a Board but no legacy Layout could not activate. The Board
bridge was therefore reachable only through duplicate/extend. A screen now has
usable content if it carries its own Layout **or** the Session carries a Board.
This closes the content-delivery gap recorded in the 2026-07-23 compliance audit.

### 2.4 Health: current state plus change events

Two shapes. `display_health` holds exactly one upserted row per Display;
`display_health_events` is the append-only trail, written **only on a state
change or sync outcome**. Emitting an event per heartbeat would produce enormous
write amplification for a fleet heartbeating every few seconds.

`public.ingest_display_heartbeat()` derives the health state once, server-side,
rather than trusting each player's self-assessment. It is service-role only:
devices authenticate with device tokens through display-gateway and never hold
an `authenticated` JWT.

`public.session_health_summary` is the authoritative rollup;
`display_sessions.health_state` is a cache of it.

### 2.5 History is append-only by construction

`session_events` has a `SELECT` policy for members and **no insert, update or
delete policy at all**. Every row is written by `private.emit_session_event()`,
a `SECURITY DEFINER` function that is not granted to `authenticated`. The
timeline cannot be edited through the API to hide an operation. Asserted by
test 14g.

`metadata` is capped at 8 KB and documented as safe-only. Provider payloads,
signed URLs and device credentials never belong there; the safe
`failure_code` / `failure_message_safe` pair on `display_sessions` is the error
surface.

### 2.6 Groups never bypass the plan

Display Groups and Session Groups are Max-only, enforced in the database — a
Plus Workspace calling PostgREST directly still cannot create one.

`public.session_group_command()` is a **loop over `session_transition()`**, never
a bulk `UPDATE`. Every per-Session gate — readiness, concurrency, role,
per-Session Display cap — therefore still fires, so a group can never become a
route around the plan. Partial failure is defined behaviour: the function returns
one row per member Session with its own outcome, and the timeline records both
successes and failures.

### 2.7 Resource ACLs are additive only

A grant can **raise** a member's access to one resource; it can never lower it
below what their Workspace role already carries. SOP Purpose §9 defines what
each role may do Workspace-wide, and a per-resource deny would silently
contradict that while creating lockouts with no safe recovery.

Workspace Owners and Admins always resolve to `owner` on every resource — the
recovery path required by SOP §9.1. Asserted by test 11c.

**No recursive RLS.** `private.resource_access_level()` reads
`organization_members` and `resource_grants` only. `resource_grants`' own
policies use `is_org_member` / `has_org_role` — never `resource_access_level` —
so evaluation always terminates.

The whole layer is inert unless the plan grants it: on Personal Free, Plus and
Pro the role baseline is the entire answer, which is exactly today's behaviour.

*SOP amendment: Purpose §9 gained a Resource Permissions subsection stating that
grants are additive and Owners cannot be narrowed.*

### 2.8 Automation tiers enforced twice

`private.automation_tier_allows(tier, schedule_kind)` encodes SOP §6:
`none` → nothing, `basic` (Pro) → once/daily/weekly, `advanced` (Max) → adds
hourly and custom.

Enforced **at creation** by a trigger and **again at claim time** in
`claim_due_automations()`, so a Workspace that downgrades from Max to Pro stops
running its hourly schedule instead of coasting on a row created while the plan
was higher. The downgrade path disables the automation and records a `skipped`
run explaining why.

Idempotency is a unique key on `(automation_id, scheduled_for)`, not a
best-effort check: two schedulers racing on the same slot produce exactly one
run. Claiming uses `FOR UPDATE SKIP LOCKED` with a lease, matching the pattern
already proven by `claim_asset_processing_job`. Retries are bounded by
`max_attempts`; exhausting them disables the automation rather than looping
forever (SOP Purpose §12).

### 2.9 Templates store slots, not Displays

`session_template_slots` deliberately holds **no Display ID**. Baking a device
into a template means instantiating it later either fails (the Display was
revoked) or silently seizes a Display showing something else. A slot describes
the role — order, primary, viewport, rotation, content — and the operator binds
a real Display at instantiation.

Instantiation always produces a **draft**. A template cannot bypass readiness.

`duplicate_session(include_displays => true)` only copies Displays that are not
currently held by a live Session, so a duplicate can never seize a Display from
the Session it was copied from.

Templates are gated to Pro and Max. *SOP is silent on templates; this is a new
decision, recorded as a Purpose §6 amendment.*

---

## 3. Migration sequence

Applied in this order to `zglbgqeccebqnijcqfkb` on 2026-07-31. Every migration
was first dry-run against the live schema **and live data** inside a transaction
that rolled back.

| # | File | Adds |
|---|---|---|
| 1 | `20260731100000_entitlement_control_plane.sql` | `plan_entitlements`, `workspace_limits_overrides`, `workspace_entitlement_snapshots`, `private.effective_entitlements()`, `workspace_effective_entitlements`, `workspace_usage_current`; rewrites 4 quota triggers |
| 2 | `20260731100100_session_lifecycle.sql` | 24 columns + 10-state machine on `display_sessions`, transition table, `session_transition()`, Board-aware activation |
| 3 | `20260731100200_session_events.sql` | `session_events`, `emit_session_event()`, automatic lifecycle + screen emission |
| 4 | `20260731100300_display_health.sql` | `display_health`, `display_health_events`, `ingest_display_heartbeat()`, `sweep_stale_display_health()`, `session_health_summary` |
| 5 | `20260731100400_session_readiness.sql` | `session_readiness()`, `session_readiness_summary()`, `refresh_session_readiness()`, start gate |
| 6 | `20260731100500_display_groups.sql` | `display_groups`, `display_group_members`, `display_group_health` |
| 7 | `20260731100600_session_groups.sql` | `session_groups`, `session_group_members`, `session_group_command()`, `session_group_health` |
| 8 | `20260731100700_resource_access_control.sql` | `resource_grants`, `resource_access_level()`, `can_access_resource()`, `my_resource_access()` |
| 9 | `20260731100800_automation_tiers_and_runs.sql` | tier gating, `automation_runs`, claim/complete/fail/reschedule/expire |
| 10 | `20260731100900_session_templates.sql` | `session_templates`, `session_template_slots`, save/instantiate/duplicate |
| 11 | `20260731101000_indexes_and_hardening.sql` | corrective constraint fixes, 12 indexes, grant sweep, `search_path` assertion, `prune_expired_history()` |

**Rollback:** [`supabase/migrations/rollback/20260731_session_platform_rollback.sql`](../../supabase/migrations/rollback/20260731_session_platform_rollback.sql).
It is destructive and drops history permanently. Its one irreversible step is
collapsing the ten lifecycle states back to three; that mapping is documented in
the file.

### Index rationale

The single most valuable index in the series is
`organization_members_user_org_active_idx`. Every RLS policy in the schema
resolves through `private.is_org_member()`, which without it is a sequential
scan on **every policy evaluation of every table**.

The rest cover: unindexed foreign keys (each one turns a parent delete into a
full child scan), the available-Display picker, board quota enforcement, the
monthly-upload quota predicate in `workspace_usage_current`, the readiness
content-processing join, and the event timelines by `(resource, time)`.

---

## 4. Verification matrix

`supabase/tests/session_platform_tests.sql` — two Workspaces (Max and Plus),
five roles, run inside a transaction that rolls back.

| # | Case | Proves |
|---|---|---|
| 1 | `session.created` emitted ×3 | history captures creation |
| 2 | `draft → active`, `draft → stopped` rejected | transition table enforced |
| 3 | unready Session cannot enter `starting` | readiness is a gate, not a hint |
| 4 | `has_enabled_display` fails with no Displays | readiness reports the real reason |
| 5 | full start → pause → resume → stop path + timeline + screen release | happy path and history |
| 6 | paused Session does not free a concurrency slot | plan capacity cannot be gamed |
| 7 | Plus cannot create a Display Group; cross-Workspace Display rejected | Max gating + isolation |
| 8 | Plus cannot create a Session Group; group command returns per-Session rows | Max gating + partial failure |
| 9 | Plus cannot create an automation; Max may schedule hourly | tier matrix |
| 10 | Plus cannot create a template | tier gating |
| 11 | ACL baseline, grant raises, Owner cannot be narrowed, non-member gets nothing | ACL semantics + recovery |
| 12 | heartbeat health derivation, connected event, stale-revision detection | health ingestion |
| 13 | Plus blocked at 2 Displays; override raises it; override grants no capability | entitlement authority |
| 14 | cross-Workspace reads return 0 for Sessions, events, health, groups; timeline not writable; viewer cannot create a group | RLS under real JWTs |

---

## 5. Task graph and ownership

| Package | Owner | Files | Status |
|---|---|---|---|
| A — Entitlement control plane | Lead | migration 1 | **Applied** |
| B — Session lifecycle + readiness | Lead | migrations 2, 5, 11 | **Applied** |
| C — History + health | Lead | migrations 3, 4 | **Applied** |
| D — Display Groups | Lead | migration 6 | **Applied** |
| E — Session Groups | Lead | migration 7 | **Applied** |
| F — Resource ACL | Lead | migration 8 | **Applied** |
| G — Automation tiers + runs | Lead | migration 9 | **Applied** |
| H — Templates + duplication | Lead | migration 10 | **Applied** |
| I — Generated types + domain layer | Lead | `src/shared/database.types.ts`, `src/domain/*` | In progress |
| J — Control room UI | Lead | `src/pages/sessions/SessionDetailPage.tsx` | In progress |
| K — Edge Function consolidation | Not started | `supabase/functions/_shared/*` | **Deferred — see §7** |
| L — ACL wiring for Boards and Assets | Not started | RLS on `boards`, `assets` | **Deferred — see §7** |

**Note on delegation.** The program brief named external CLIs (Codex, Agy,
OpenCode) as contractors. Those CLIs are not reachable from this environment, so
every package above was implemented and verified directly rather than being
farmed out and reviewed. No package was skipped as a result; the ownership
column records who actually did the work.

---

## 6. Honest capability status

Per SOP Roadmap §3.1, nothing here may be sold as complete until it is.
`plan_entitlements.availability` now carries this in the database:

| Plan | `availability` | Why |
|---|---|---|
| Personal Free | `generally_available` | Provisioning, quotas and Session flow verified |
| Plus | `limited` | Sellable once Plus Checkout + Team provisioning + one concurrent Session are verified end to end |
| Pro | `limited` | Sellable once Plus is stable and daily/weekly automation executes reliably |
| Max | `unavailable` | Groups, ACL and advanced automation now have working schema and enforcement, but Stage 2 entry conditions are not met and the manager UI for them does not exist yet |

**Max remains unavailable.** The database can now enforce every Max promise;
that is not the same as the product delivering them. Do not flip this field
without a recorded Stage 2 transition (SOP Roadmap §12).

---

## 7. Remaining work

1. **Edge Function consolidation (package K).** The 17 existing functions each
   implement their own CORS, auth and error shaping. A `_shared` middleware for
   CORS + workspace resolution + entitlement resolution + request IDs +
   idempotency is designed but not built. No function was modified by this
   program, so nothing regressed.
2. **ACL wiring for Boards and Assets (package L).** `resource_grants` supports
   all nine resource types and the resolver handles them, but only
   `display_sessions` has the additive RLS policies wired. Boards and Assets
   still resolve on Workspace role alone. This is a *narrower* enforcement
   surface than the model supports, never a wider one — no access was widened.
3. **Automation executor.** The claim/complete/fail/reschedule contract exists
   and is testable; the Edge Function or worker that drives it, and the timezone
   arithmetic for computing the next occurrence, are not written.
4. **Group and template manager UI.** Schema and commands exist; no screens.
5. **Retention scheduling.** `prune_expired_history()` exists; nothing calls it
   on a schedule yet.

---

## Appendix — pre-series function bodies

The rollback script restores most replaced functions inline. Two are long enough
that transcribing them risks drift; take them from git instead:

```bash
git show 1e4190b:supabase/migrations/20260722153000_media_assets_and_board_interaction.sql
```

`prepare_session_screen_assignment()` and
`validate_display_session_activation()` in their pre-2026-07-31 form are defined
in the migration history reachable from commit `1e4190b`.
