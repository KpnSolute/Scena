# Handoff → Codex CLI — 2026-08-02

Prepared by Claude Code after Ultrareview Phase 1 (diff) and Phase 2 (live app).
You are picking up **Phase 2 continuation + fixes**. Target ship date: **Friday
2026-08-07**, first public version, immediately before enabling live Stripe.

## Start here

1. `docs/review/findings/live-review-2026-08-02.md` — the findings. Read in full.
2. `docs/review/LIVE_APPLICATION_REVIEW.md` — the review method.
3. `.codex/prompts/live-review.md` — your slash-command adapter (`/live-review`).
4. `CLAUDE.md` / `AGENTS.md` — **binding**. Especially §5 git rules.

## State of play

Branch `main`, clean except: modified `.mcp.json`, untracked `.cursor/`,
`.vscode/`, and a stray root file `NDH6SA~M` (1 KB, unidentified — do not commit).

Phase 1 produced two nits, both unfixed: stale `SUPABASE_PROJECT_REF` docs
(`README.md:14`, `.env.example:2`, `docs/API_V2_PROGRESS.md:16`) and a missing
CHANGELOG entry for the `.mcp.json` transport switch.

## The one thing that matters most

> **STATUS: client-side fix applied by Claude Code, not yet deployed.**
> `src/app/ManagerGuard.tsx` now treats `UNAUTHENTICATED` as signed out (clears
> the dead token, routes to `/login`); `src/auth/session.ts` gained
> `clearLocalSession()` and a local-scope fallback in `signOut()`. Regression
> tests in `src/app/ManagerGuard.test.ts`. 170 tests pass, `tsc -b` clean,
> build clean.
>
> **Still open, and yours:** (a) verify the 401→`/login` branch in a *browser*
> against a genuinely revoked session — the unit test covers it but the
> end-to-end run below only exercised the no-session branch; (b) find out **why**
> the session was revoked (Auth inactivity/timebox settings, or an ES256 signing
> key rotation invalidating existing sessions) — that decides whether this hits
> every customer; (c) confirm `billing-checkout` and `billing-portal` recover.

**P0-1: a revoked server-side session is invisible to the client, and there is
no way back to sign-in.**

Verified against live: the stored JWT is valid ES256, unexpired (~41 min left),
correct `sub`/`email` — but `GET /auth/v1/user` returns
**403 `session_not_found`** ("Session from session_id claim in JWT does not
exist"). Meanwhile `GET /rest/v1/profiles` with the *same* token returns **200**.

Consequence — a split brain:
* **PostgREST works** (signature-only verification) → `src/domain/*.ts` queries succeed.
* **Every Edge Function fails** → they all call `auth.getUser()`, which hits the
  Auth server: `asset-upload:310`, `billing-portal:28`, `billing-checkout:58`,
  `board-interaction`, `workspace-context`. All return
  `{"code":"UNAUTHENTICATED","message":"Sign in is required."}`.

`ManagerGuard.tsx:74-82` routes that to `/unauthorized`, whose only control is
**Sign out**. Dead end.

**This blocks Stripe**: `billing-checkout` and `billing-portal` use the identical
`getUser()` path, so checkout cannot be exercised end to end until fixed.

Fix has two halves — do both:
1. Treat `UNAUTHENTICATED`/401 from `callScenaFunction` as *unauthenticated*:
   clear the local session, `Navigate to="/login"`. Not `/unauthorized`.
2. Stop trusting `expires_at` alone — validate against the server on cold start,
   or treat the first 401 as authoritative.

Then find *why* the session died: Auth session-timebox / inactivity settings, or
a JWT signing-key rotation to ES256 invalidating pre-existing sessions. That
decides whether this hits every customer or just one.

## Remaining P0s (detail in the findings file)

* **P0-2** `src/pages/docs/DocsPage.tsx:51` sells Plus "Basic" automation;
  `plan_entitlements.plus.automation_tier = 'none'`. Copy fix or pricing
  decision — pricing is **not** an engineering call (SOP §6).
* **P0-3** Automation sold on Pro/Max never executes: `automations-run` is **not
  deployed** (13 of 16 functions are), and there is no `pg_cron`/`pg_net`. Also
  leaves `sweep_stale_display_health`, `expire_stale_automation_leases`,
  `prune_expired_history` inert. `presentation-callback` and
  `screen-credential-rotate` are also undeployed.
* **P0-4** Max sold at $40/mo with a live CTA while
  `plan_entitlements.max.availability = 'unavailable'`; Groups/ACL/templates
  have **zero** client code (generated types only).
* **P0-5** Terms of Service and Privacy Policy both link to the homepage — they
  do not exist. Stripe requires both.

## What is NOT verified

The P0-1 defect blocked cold-loading every `/app/*` route, so the entire manager
surface is **unreviewed**: boards, assets, locations, screens, sessions,
layouts, automations, members, **billing**, settings. Also unreviewed:
`/community`, `/login`, `/dev/*`, 404.

Treat every `"functional"` claim in `src/app/route-metadata.ts` as unproven.

**Re-run `/live-review` over the manager surface once P0-1 is fixed.** Billing is
in that unreviewed set — assume more findings before Stripe.

## Rules you must not break

* **Review and fix are separate passes.** Do not fix while reviewing.
* **Read-only against the live DB** during review: no migrations, no writes, no
  Edge Function deploys without explicit approval from the repo owner.
* **Never enter real payment details.** Walk checkout to the redirect and stop.
* **Git (CLAUDE.md §5):** commit title is **exactly** the owner-supplied
  identifier — no prefix, no `feat:`, no description. If no identifier has been
  supplied, **do not invent one**; leave the work uncommitted and ask. Never
  force-push, never rewrite shared history, never commit secrets.
* Verify with `npm.cmd run build` and `npx.cmd tsc -b`; log changes to
  `CHANGELOG.md` before task close.

## Suggested order

1. P0-1 (unblocks everything, including the rest of the review)
2. Re-run `/live-review` on the manager surface — expect new findings in billing
3. P0-5 legal pages, then P0-2 / P0-4 copy + availability
4. P0-3 deploy + scheduler — needs owner approval, touches live infrastructure
5. Phase 1 nits + CHANGELOG
6. Only then: live Stripe
