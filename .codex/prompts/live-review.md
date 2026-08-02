---
description: Ultrareview Phase 2 — drive the running Scena site and validate what a real user sees, including whether each plan tier delivers what it promises.
---

# Live Application Review (Ultrareview Phase 2)

Phase 1 reviews the diff. **This phase drives the running site** and answers:
does what the user sees actually work, and does every plan deliver what we sold?

## Read this first

The full method lives in `docs/review/LIVE_APPLICATION_REVIEW.md`. Read it now,
in full, before touching the browser. It is the single source of truth; this
file only tells you how to run it in Codex CLI.

## Hard rules

1. **Review only — never fix.** Findings are the deliverable. Fixing is a
   separate approved pass. Mixing them makes the rest of the review untrustworthy.
2. **Read-only against the live database.** No migrations, no writes, no Edge
   Function deploys.
3. **No fabrication.** Not reached → say "not reached" and why.
4. **No real payment details.** Walk Stripe checkout to the redirect, stop.

## Procedure

1. Read the spec doc above.
2. Enumerate routes from `src/app/router.tsx` (`routeTree`) — never from memory.
   Cross-check `src/app/route-metadata.ts` as a *hypothesis to test*, not truth.
3. Attach to the browser (see below). Target is the deployed site,
   `https://scena.kpnsolute.com`, unless told otherwise.
4. Walk every route with the §5 procedure: navigate → read page structure →
   read console → read network → exercise controls → check mobile and dark mode
   on dense routes.
5. Run the §6 tier-promise audit. Read `plan_entitlements` read-only via the
   Supabase MCP server configured in `.mcp.json`; grep `src/` for whether each
   capability has client code and a reachable UI path.
6. Classify every finding by **layer** (L1 UI / L2 client / L3 API-or-deploy /
   L4 DB-or-scheduler / L0 behaviour) and **class** (§3).
7. Emit the §9 output: verdict, findings by severity, tier matrix, coverage list.

## Browser control in Codex

Use Codex's own browser tooling — its integrated/headless browser control or the
configured browser MCP server. Do not shell out to `curl`, Playwright scripts, or
a scripted headless run: this review depends on the real rendered page, live
console output, and real network activity, none of which survive a scripted
fetch. If no browser surface is available, stop and say so rather than
substituting static analysis — a Phase 2 review that never opened the site is
not a Phase 2 review.

Reuse an already-open authenticated tab where one exists; opening a fresh tab
loses the session and turns a manager-route review into a login-redirect review.

## Tooling notes

* Check whether an Edge Function is *deployed* (`supabase functions list`), not
  merely present in `supabase/functions/`. Undeployed code is an L3 gap and is
  invisible from the UI until it silently fails.
* Check whether anything *schedules* a DB function. `pg_cron`/`pg_net` absent
  means every maintenance and automation routine is inert regardless of how
  complete its schema looks.

## Reporting

Write findings to `docs/review/findings/live-review-<YYYY-MM-DD>.md` and
summarise the verdict plus all P0/P1 items in your final message. Do not bury a
P0 in a file.
