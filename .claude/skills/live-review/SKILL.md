---
name: live-review
description: Ultrareview Phase 2 — drive the running Scena site in a browser and validate what a real user sees. Use when asked to review the live app/site, check whether pages actually work, find missing/incomplete/broken/misleading features, audit whether each plan tier delivers what it promises, or verify the site is ready to ship or to enable live Stripe. Triggers include "live review", "ultrareview phase 2", "is the site working", "what's missing on the site", "tier promise audit", "check every page".
---

# Live Application Review (Ultrareview Phase 2)

Phase 1 reviews the diff. **This phase drives the running site** and answers:
does what the user sees actually work, and does every plan deliver what we sold?

## Read this first

The full method lives in **[docs/review/LIVE_APPLICATION_REVIEW.md](../../../docs/review/LIVE_APPLICATION_REVIEW.md)**.
Read it now, in full, before touching the browser. It is the single source of
truth; this file only tells you how to run it in Claude Code.

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
3. Attach to the browser. Call `mcp__Claude_Browser__tabs_context` first — if a
   tab is already open on the target (normally `https://scena.kpnsolute.com`),
   **use it**; opening a second tab loses the signed-in session. Only if no tab
   exists: `preview_start` with `{url}` for the deployed site, or
   `{name: "scena-dev"}` for a local build (see `.claude/launch.json`). Never
   use Bash to run a dev server.
4. Walk every route with the §5 procedure: `navigate` → `read_page` →
   `read_console_messages` → `read_network_requests` → exercise controls →
   `resize_window` for mobile/dark on dense routes.
5. Run the §6 tier-promise audit. Use the Supabase MCP tools (read-only) for
   `plan_entitlements`; grep `src/` for whether each capability has client code
   and a reachable UI path.
6. Classify every finding by **layer** (L1 UI / L2 client / L3 API-or-deploy /
   L4 DB-or-scheduler / L0 behaviour) and **class** (§3).
7. Emit the §9 output: verdict, findings by severity, tier matrix, coverage list.

## Tooling notes

* Browser: the in-app Browser pane, `mcp__Claude_Browser__*` — `navigate`,
  `read_page`, `find`, `computer`, `form_input`, `read_console_messages`,
  `read_network_requests`, `resize_window`, `tabs_context`. Prefer `read_page`
  over `screenshot` for verifying text and structure; screenshots for layout
  only. Do not use `mcp__claude-in-chrome__*` unless the task needs the user's
  real logged-in Chrome profile.
* Check whether an Edge Function is *deployed* (`supabase functions list`), not
  merely present in `supabase/functions/`. Undeployed code is an L3 gap and is
  invisible from the UI until it silently fails.
* Check whether anything *schedules* a DB function. `pg_cron`/`pg_net` absent
  means every maintenance and automation routine is inert regardless of how
  complete its schema looks.

## Reporting

Write findings to `docs/review/findings/live-review-<YYYY-MM-DD>.md` and
summarise the verdict plus all P0/P1 items in chat. Do not bury a P0 in a file.
