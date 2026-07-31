-- Follow-up to the 2026-07-31 session-platform series.
--
-- A post-implementation FK/index coverage sweep (see
-- docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md) found two real gaps among
-- the tables introduced by that series:
--
--   * session_template_slots.org_id backs an RLS predicate
--     (private.is_org_member(org_id) on every policy for this table) with no
--     supporting index -- the same class of gap that made
--     organization_members(user_id, org_id) the highest-value index in the
--     whole series.
--   * automation_runs.session_id backs the "runs for this Session" query the
--     control room needs once the automation history UI exists.
--
-- The remaining unindexed foreign keys found by the same sweep
-- (display_groups.fallback_board_id, display_health.current_board_id,
-- resource_grants.granted_by, session_template_slots.layout_id,
-- session_templates.board_id/fallback_board_id/shared_layout_id/source_session_id)
-- are nullable, single-direction reference columns with no known reverse-query
-- pattern. Postgres does not require an index to enforce a foreign key, and
-- indexing every nullable reference column regardless of access pattern is the
-- "index everything" anti-pattern this series deliberately avoided elsewhere.
-- They are left unindexed until a real query path needs one.

begin;

create index if not exists session_template_slots_org_idx
  on public.session_template_slots (org_id);

create index if not exists automation_runs_session_idx
  on public.automation_runs (session_id) where session_id is not null;

commit;
