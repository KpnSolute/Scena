# Session platform — rollout and rollback checklist

**Series:** `20260731100000` … `20260731101000` (11 migrations)
**Target:** Supabase project `zglbgqeccebqnijcqfkb`
**Status:** **Applied to the live project on 2026-07-31.**

---

## What was already done

- [x] Live schema inventoried directly from the database, not from documentation
- [x] Every migration dry-run against the **live schema and live data** inside a
      transaction that rolled back
- [x] Full 11-migration chain dry-run in one rolled-back transaction
- [x] Rollback script written **before** the first migration was applied
- [x] Migrations applied in order, one at a time
- [x] Database test suite run against the applied schema — all assertions passed
- [x] TypeScript types regenerated from the live schema
- [x] `tsc -b` clean, `npm run build` clean, 166 tests passing
- [x] Own security sweep: no RLS-disabled tables, no SECURITY DEFINER views, no
      SECURITY DEFINER function without a pinned `search_path`, no
      anon-executable SECURITY DEFINER function

## Why applying the same day was safe

Production held 3 Workspaces, 3 members, 2 Displays, 1 draft Session, 2 Boards,
2 Assets and 0 subscriptions. Every migration is additive: new tables, new
columns with defaults, replaced function bodies, and CHECK constraints that were
**widened** rather than narrowed. No column was dropped, no data rewritten
except the deliberate re-projection of `organization_entitlements` from
`plan_entitlements`, which produced identical values plus the new dimensions.

## Defects the test suite caught before they shipped

Three real bugs were found *after* the relevant migration had been applied, and
fixed forward in migration 11:

1. **`enforce_session_start_readiness()` — ambiguous `blocking`.** A local
   variable shadowed a returned column name; every start attempt failed.
2. **`display_sessions_active_shape_check` required `started_by`.** An
   automation or scheduler start has no human actor, so scheduled starts were
   impossible.
3. **`prepare_session_screen_assignment()` was Board-blind.** It rejected an
   enabled Display with no Layout even when the Session carried a Board — the
   same content-model gap that had already been fixed in
   `validate_display_session_activation()`.

All three are corrected in both the originating migration (so a from-scratch run
is right first time) and migration 11 (so the applied database converges).

A fourth issue was caught during a post-implementation self-replay check: four
`CREATE TRIGGER` statements (the `*_set_updated_at` triggers on
`plan_entitlements`, `display_groups`, `session_groups`, `session_templates`)
were missing the `DROP TRIGGER IF EXISTS` guard every other trigger in the
series uses. Harmless on a genuine from-scratch apply, but it meant the
migration files couldn't be safely re-run for repair. Fixed in place in the
four originating files and re-applied live; confirmed no drift against the
live function/constraint/trigger definitions afterward.

---

## Before any further deployment

- [ ] Re-read the live schema immediately before applying anything new
- [ ] Confirm no other session has applied migrations since
      (`select * from supabase_migrations.schema_migrations order by version desc limit 5`)
- [ ] Take a database backup if the change is anything other than additive

## Verification after any change to this series

```bash
# Re-run the database test suite (always inside a rolled-back transaction)
# It creates its own two Workspaces and five users; it never touches real data.
```

Then:

- [ ] `npx.cmd tsc -b` — zero errors
- [ ] `npm.cmd run build` — zero errors
- [ ] `npx.cmd vitest run` — all green

Run those from a **local drive copy**, not from `Z:`. The network share cannot
spawn the native binaries (`spawn EPERM`), and a piped exit code from the share
will lie about success.

---

## Rollback

Script: [`supabase/migrations/rollback/20260731_session_platform_rollback.sql`](../../supabase/migrations/rollback/20260731_session_platform_rollback.sql)

**This is destructive.** It permanently drops Session history, Display health
history, automation run history, groups, grants and templates.

Before running it:

- [ ] Take a full database backup
- [ ] Get explicit authorisation from the repository owner
- [ ] Read the "IRREVERSIBLE" note in the script: collapsing the ten lifecycle
      states back to three loses the distinction between `ready`/`draft`,
      between `starting`/`degraded`/`paused`/`active`, and between
      `stopping`/`failed`/`archived`/`stopped`
- [ ] Restore `prepare_session_screen_assignment()` and
      `validate_display_session_activation()` from the pre-series definitions
      reachable at commit `1e4190b` — the script deliberately does not inline
      them, because transcribing two long function bodies risks silent drift

Partial rollback of a single migration is **not** supported. The series shares
`private.effective_entitlements()`, `private.session_state_holds_displays()` and
`private.emit_session_event()` across migrations; dropping one migration's
objects in isolation leaves dangling references.

---

## Not yet deployed

These exist as schema and enforcement but have no product surface, and must not
be described to a customer as available:

| Capability | State |
|---|---|
| Display Groups | Schema, entitlement gating, health rollup. **No UI.** |
| Session Groups | Schema, group command with partial-failure reporting. **No UI.** |
| Resource ACLs | Model, resolver, enforcement on Sessions. **No UI.** Boards and Assets not yet wired. |
| Automation execution | Claim/complete/fail/reschedule contract. **No executor.** |
| Session templates | Schema, save/instantiate/duplicate functions. **No UI.** |
| History retention | `prune_expired_history()` exists. **Nothing schedules it.** |

`plan_entitlements.availability` records this: Max is `unavailable`.
