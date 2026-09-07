### WORKFORCE-AUTH-HANDOFF-2026-08-17

- Date/time: 2026-08-17 America/New_York
- Agent: Codex with Tesla subagent
- Projects: Website/KpnAuth, KpnCompute, Lunchvoice, Scena, and held Tradora adapter
- Task/finding: Workforce Auth Migration Roster A and detailed Claude handoff
- Work performed: Completed and locally verified the additive central workforce-auth API foundation and four product adapters; corrected token, JWKS, audience, unified-route, and central-session-introspection contracts; wrote a detailed cross-agent handoff capturing owner goals, tone, tools, evidence, release state, and next steps.
- Files affected: Product changes remain isolated in `C:\Projects\Scena\.worktrees\Website-platform` and `workforce-auth-*` worktrees. Durable handoff: `C:\Projects\Scena\docs\handoffs\CLAUDE_HANDOFF_2026-08-17.md`.
- Local verification: Central workspace lint/format/typecheck/tests/build passed (65 tests); API 31 tests; gateway 5 tests; Compute Ruff and 219 tests passed with 14 skipped; Scena 205 tests and build passed; Lunchvoice build and Edge check passed; Scena Edge check passed; Tradora held adapter typecheck passed.
- GitHub state: No commit or push for Roster A.
- Deployment state: No deployment or hosted migration.
- Live verification: Not performed; browser workforce sign-in does not yet exist.
- Remaining work: Build and wire the workforce browser flow; prove compatibility-session revocation; import one tenant in non-production; obtain repository-specific identifiers; publish, deploy in dual mode, and run authenticated acceptance before any legacy removal.
- Evidence/source: `C:\Projects\Scena\docs\handoffs\CLAUDE_HANDOFF_2026-08-17.md` and local verification output from the active Codex task.
