# AGENTS.md — Scena Project Facts & Governance

<!-- KPNSOLUTE-SHARED-MEMORY: BEGIN -->
## Shared KpnSolute operating memory

Before material work, read the canonical cross-project ledger:

`C:\Projects\_config\kpnsolute-governance\SHARED_MEMORY.md`

After material work, append a dated contribution using the governance append
helper. Keep local `AGENTS.md`, `CLAUDE.md`, and `CHANGELOG.md` rules in force;
shared memory records cross-project operational state and never stores secrets.
Do not infer committed, pushed, deployed, or live-verified state from another
status. Use exact finding identifiers; use `Studio Phase A/B/C` for product
phases. Structural or multi-file governance edits require explicit roster
approval. Do not commit or push without an approved repository-specific
identifier.
<!-- KPNSOLUTE-SHARED-MEMORY: END -->

**Single Source of Truth for Scena Manager Portal & Kiosk Display**

> [!IMPORTANT]
> This project operates under the **Global Governance Model** defined in [Root AGENTS.md](file:///\\192.168.1.126\projects\AGENTS.md). 
> All global task force roles, CLI protocols, loop-prevention gates, and tool access boundaries apply here. This file contains only **project-specific facts and schemas**.

---

## 1. Project Identity & Build Plan
*   **What it is:** The manager portal and kiosk display website for Scena displays.
*   **Stack:** React + TypeScript + Vite.
*   **Governing Plan:** All implementations must follow [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) phase gates and Definitions of Done.

---

## 2. SSO Identity Boundary
*   **SSO Authority:** `KpnCompute` (MJCC) acts as the central identity authority.
*   **SSO Exchange:** Scena performs authentication via the server-side `mjcc-sso-exchange` Supabase Edge Function using immutable MJCC identity mappings.
*   **Role Access Scope:** Manager access is organization-scoped to the `mjcc` tenant; kiosk devices use a separate local passcode entry flow.

---

## 3. Database & Edge Function Customizations
*   **Supabase Database:** Scena integrates with Supabase. Use project-scoped MCP endpoints for table query work.
*   **Deployment Boundary:** Edge Functions must be deployed via the project-scoped Supabase CLI. Never commit SSO client secrets, PATs, or service-role keys directly to source control.

---

## 4. Compilation & Verification
*   **Windows Compiling:** When working on Windows network shares (`\\192.168.1.126`), compile and verify types using the local `.cmd` hooks:
    ```powershell
    npm.cmd run build
    npx.cmd tsc -b
    ```
*   **If native binaries (esbuild, vitest, deno) fail to spawn from the network share** (`spawn EPERM`), copy the working tree to a local drive (excluding `node_modules`, `dist`, `build`, `coverage`, `.git`), run `npm ci` there, and run verification from that local copy. Copy legitimate source fixes back to the network-share repo; never copy `node_modules` or build artifacts back.
*   **Definition of Done:** Ensure compilation has zero warnings, RLS is verified via MCP database advisors, and changes are logged to `CHANGELOG.md` before task close.

---

## 5. Permanent Git Transaction Rules

These rules govern every Git transaction in this repository — commits,
merges, tags, pushes, and branch cleanup — not only the release that
introduced them (2026-07-20).

### Commit titles
*   A commit title (the first line of the commit message) **must not**
    contain descriptive prose, a conventional-commit prefix (`feat:`,
    `fix:`, `chore:`, `docs:`, etc.), a feature name, a summary, or any
    commentary.
*   The commit title must be **exactly** the approved identifier supplied
    by the repository owner for that transaction — a version number
    (`v1.0.0`), a release identifier, or an explicitly approved task
    identifier. Nothing added before or after it: no prefix, no suffix,
    no emoji.
*   **When no approved identifier has been supplied, do not invent one.**
    Preserve the changes uncommitted (working tree or a local branch) and
    wait for the repository owner to supply one, rather than fabricating
    a descriptive title to unblock the commit.

### Commit bodies
*   A brief, factual description of what changed belongs in the commit
    **body** (after a blank line following the title), never in the
    title itself. Keep it short — what changed, not why it matters
    rhetorically.

### Merge commits
*   Avoid merge commits where a fast-forward is possible.
*   When a merge commit is unavoidable, its subject follows the same
    title rule above — the approved identifier only. Do not let Git
    generate a default verbose merge message; supply the title
    explicitly (`git merge --no-ff -m "<approved identifier>"`).

### Git tags
*   A tag name contains **only** the version/release identifier supplied
    by the repository owner — never additional descriptive words, and
    never an alternate spelling or format of an identifier the owner
    already gave. If the owner says the tag is `v1.0.0`, the tag is
    `v1.0.0` — not `version-v1.0.0`, not `release-v1.0.0`, not any
    variant.
*   Do not create more than one tag for the same release unless the
    repository owner explicitly requests additional tags.
*   A brief factual description may go in the tag's annotation message,
    never in the tag name.

### Branches
*   Never force-push any shared branch (`main` above all).
*   Never rewrite shared history.
*   Never delete a branch — local or remote — before verifying every
    commit unique to that branch already exists in `main` (or the
    relevant target branch). Document the verification (e.g. `git log
    <branch> --not main`) before deleting.
*   Never delete unmerged work.

### Secrets
*   Never push secrets. Never commit an environment file containing a
    secret value (`.env` and variants stay gitignored; `.env.example`
    holds variable names only, never values).

### Database
*   Git operations (commits, tags, releases) never imply or authorize a
    database change. A schema-alignment tag records that the
    application matches the currently-approved live schema — it does
    not mean a migration was applied as part of that Git transaction.

### General
*   Inspect current Git state before changing it (branch, status, staged
    changes, tags, remotes).
*   Verify before committing, and verify again before pushing.
*   Confirm remote state after pushing (branch matches, tags exist both
    locally and remotely).
*   Keep `main` as the final active branch and the working tree clean
    after any release operation.
