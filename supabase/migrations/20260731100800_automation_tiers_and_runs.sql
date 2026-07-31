-- Scena automation: plan tiers and execution history.
--
-- SOP Purpose §6:
--   Personal Free -- no automation
--   Plus          -- no automation
--   Pro           -- daily and weekly
--   Max           -- hourly, daily, weekly and approved custom scheduling
--
-- Design decisions recorded in docs/implementation/SCENA_FULL_SYSTEM_PROGRAM.md:
--   * The tier is enforced SERVER-SIDE on the automation row, and again at claim
--     time. A Workspace that downgrades from Max to Pro cannot keep running an
--     hourly schedule just because the row already existed.
--   * Idempotency is a unique key on (automation_id, scheduled_for), not a
--     best-effort check. Two schedulers racing on the same slot produce one run.
--   * Claiming uses FOR UPDATE SKIP LOCKED with a lease, matching the pattern
--     already proven by claim_asset_processing_job.

begin;

-- ---------------------------------------------------------------------------
-- 1. Schedule vocabulary and tier mapping
-- ---------------------------------------------------------------------------

create or replace function private.automation_tier_allows(tier text, schedule_kind text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select case tier
    when 'none'     then false
    when 'basic'    then schedule_kind in ('once', 'daily', 'weekly')
    when 'advanced' then schedule_kind in ('once', 'hourly', 'daily', 'weekly', 'custom')
    else false
  end;
$$;

comment on function private.automation_tier_allows(text, text) is
  'SOP Purpose §6 automation matrix. Pro = basic (daily/weekly), Max = advanced (adds hourly and approved custom).';

alter table public.display_automations
  add column if not exists schedule_kind        text,
  add column if not exists target_type          text not null default 'session',
  add column if not exists target_id            uuid,
  add column if not exists last_status          text,
  add column if not exists last_error_code      text,
  add column if not exists last_error_message_safe text,
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists max_attempts         integer not null default 3,
  add column if not exists retry_backoff_seconds integer not null default 300,
  add column if not exists disabled_reason      text;

-- Backfill: every existing automation targets a Session, and 'cron' schedules
-- become 'custom' until an operator narrows them.
update public.display_automations
   set schedule_kind = coalesce(schedule_kind,
                                case when schedule_type = 'once' then 'once' else 'custom' end),
       target_id     = coalesce(target_id, session_id)
 where schedule_kind is null or target_id is null;

alter table public.display_automations
  alter column schedule_kind set default 'custom';

do $$ begin
  execute 'alter table public.display_automations alter column schedule_kind set not null';
exception when others then null;
end $$;

do $$ begin
  execute 'alter table public.display_automations alter column target_id set not null';
exception when others then null;
end $$;

alter table public.display_automations
  add constraint display_automations_schedule_kind_check
    check (schedule_kind in ('once', 'hourly', 'daily', 'weekly', 'custom')),
  add constraint display_automations_target_type_check
    check (target_type in ('session', 'session_group', 'display_group')),
  add constraint display_automations_last_status_check
    check (last_status is null or last_status in ('succeeded', 'failed', 'skipped')),
  add constraint display_automations_max_attempts_check
    check (max_attempts between 1 and 10),
  add constraint display_automations_backoff_check
    check (retry_backoff_seconds between 30 and 86400),
  add constraint display_automations_error_len_check
    check (last_error_message_safe is null or length(last_error_message_safe) <= 500);

create index if not exists display_automations_due_idx
  on public.display_automations (next_run_at)
  where is_enabled and next_run_at is not null;
create index if not exists display_automations_org_target_idx
  on public.display_automations (org_id, target_type, target_id);

-- ---------------------------------------------------------------------------
-- 2. Tier enforcement
-- ---------------------------------------------------------------------------

create or replace function public.enforce_automation_entitlement()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  ent private.effective_entitlement;
begin
  ent := private.effective_entitlements(new.org_id);

  if ent.org_id is null or ent.automation_tier = 'none' then
    raise exception 'Automation is available on the Pro and Max plans'
      using errcode = '42501', hint = 'entitlement_automation';
  end if;

  if not private.automation_tier_allows(ent.automation_tier, new.schedule_kind) then
    raise exception '% scheduling is available on the Max plan', new.schedule_kind
      using errcode = '42501', hint = 'entitlement_automation_schedule';
  end if;

  if new.target_type = 'session_group' and not ent.allow_session_groups then
    raise exception 'Session Groups are available on the Max plan' using errcode = '42501';
  end if;
  if new.target_type = 'display_group' and not ent.allow_display_groups then
    raise exception 'Display Groups are available on the Max plan' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists display_automations_enforce_entitlement on public.display_automations;
create trigger display_automations_enforce_entitlement
  before insert or update on public.display_automations
  for each row execute function public.enforce_automation_entitlement();

-- ---------------------------------------------------------------------------
-- 3. Execution history
-- ---------------------------------------------------------------------------

create table if not exists public.automation_runs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  automation_id  uuid not null references public.display_automations(id) on delete cascade,
  session_id     uuid references public.display_sessions(id) on delete set null,
  scheduled_for  timestamptz not null,
  status         text not null default 'queued',
  attempt        integer not null default 1 check (attempt >= 1),
  lease_owner    text,
  lease_expires_at timestamptz,
  claimed_at     timestamptz,
  started_at     timestamptz,
  finished_at    timestamptz,
  action_type    text,
  action_result  jsonb not null default '{}'::jsonb,
  error_code     text,
  error_message_safe text,
  actor_type     text not null default 'scheduler',
  source         text not null default 'scheduler',
  created_at     timestamptz not null default now(),

  constraint automation_runs_status_check check (status in (
    'queued', 'leased', 'running', 'succeeded', 'failed', 'skipped', 'expired'
  )),
  constraint automation_runs_result_is_object_check check (jsonb_typeof(action_result) = 'object'),
  constraint automation_runs_result_size_check check (pg_column_size(action_result) <= 8192),
  constraint automation_runs_error_len_check
    check (error_message_safe is null or length(error_message_safe) <= 500),
  -- Idempotency: one run per automation per scheduled slot, whatever races.
  constraint automation_runs_slot_unique unique (automation_id, scheduled_for)
);

comment on table public.automation_runs is
  'Append-only automation execution record. The unique (automation_id, scheduled_for) key is what makes execution idempotent.';

create index if not exists automation_runs_org_time_idx
  on public.automation_runs (org_id, scheduled_for desc);
create index if not exists automation_runs_automation_time_idx
  on public.automation_runs (automation_id, scheduled_for desc);
create index if not exists automation_runs_claimable_idx
  on public.automation_runs (scheduled_for)
  where status in ('queued', 'leased');

alter table public.automation_runs enable row level security;

drop policy if exists automation_runs_select_member on public.automation_runs;
create policy automation_runs_select_member on public.automation_runs
  for select to authenticated using (private.is_org_member(org_id));
-- No write policy: runs are created and completed by the scheduler functions below.

-- ---------------------------------------------------------------------------
-- 4. Claim / complete / fail
-- ---------------------------------------------------------------------------

-- Atomically claims due automations. Re-checks the plan tier at claim time so a
-- downgrade stops execution even for rows created while the plan was higher.
create or replace function public.claim_due_automations(
  worker_id text,
  lease_seconds integer default 120,
  batch_size integer default 10
)
returns setof public.automation_runs
language plpgsql
security definer
set search_path to ''
as $$
declare
  due    record;
  run    public.automation_runs;
  ent    private.effective_entitlement;
begin
  if lease_seconds < 30 or lease_seconds > 3600 then
    raise exception 'lease_seconds must be between 30 and 3600' using errcode = '22023';
  end if;

  for due in
    select a.*
      from public.display_automations a
     where a.is_enabled
       and a.next_run_at is not null
       and a.next_run_at <= now()
     order by a.next_run_at
     limit greatest(1, least(batch_size, 100))
     for update skip locked
  loop
    ent := private.effective_entitlements(due.org_id);

    -- Tier re-check at execution time, not just at creation time.
    if ent.org_id is null
       or not private.automation_tier_allows(ent.automation_tier, due.schedule_kind) then
      insert into public.automation_runs (
        org_id, automation_id, session_id, scheduled_for, status,
        action_type, error_code, error_message_safe, finished_at)
      values (due.org_id, due.id, due.session_id, due.next_run_at, 'skipped',
              due.action_type, 'entitlement_automation',
              'This Workspace''s plan no longer includes this schedule.', now())
      on conflict (automation_id, scheduled_for) do nothing;

      update public.display_automations
         set is_enabled = false,
             disabled_reason = 'plan_no_longer_includes_schedule',
             last_status = 'skipped',
             next_run_at = null
       where id = due.id;
      continue;
    end if;

    insert into public.automation_runs (
      org_id, automation_id, session_id, scheduled_for, status,
      action_type, lease_owner, lease_expires_at, claimed_at)
    values (due.org_id, due.id, due.session_id, due.next_run_at, 'leased',
            due.action_type, worker_id, now() + make_interval(secs => lease_seconds), now())
    on conflict (automation_id, scheduled_for) do nothing
    returning * into run;

    -- Another scheduler already owns this slot; that is the idempotency
    -- guarantee doing its job, not an error.
    if run.id is null then
      continue;
    end if;

    -- Clear the due marker so the same slot is not offered again. The executor
    -- sets the next occurrence via reschedule_automation().
    update public.display_automations set next_run_at = null where id = due.id;

    return next run;
  end loop;
end;
$$;

revoke all on function public.claim_due_automations(text, integer, integer)
  from public, anon, authenticated;

create or replace function public.complete_automation_run(
  target_run_id uuid,
  target_lease_owner text,
  target_result jsonb default '{}'::jsonb
)
returns public.automation_runs
language plpgsql
security definer
set search_path to ''
as $$
declare
  run public.automation_runs;
begin
  update public.automation_runs r
     set status = 'succeeded',
         action_result = coalesce(target_result, '{}'::jsonb),
         finished_at = now(),
         started_at = coalesce(r.started_at, r.claimed_at),
         lease_owner = null,
         lease_expires_at = null
   where r.id = target_run_id
     and r.lease_owner = target_lease_owner
     and r.status in ('leased', 'running')
  returning * into run;

  if run.id is null then
    raise exception 'Automation run is not leased by this worker' using errcode = '42501';
  end if;

  update public.display_automations
     set last_run_at = now(), last_status = 'succeeded',
         consecutive_failures = 0, last_error_code = null, last_error_message_safe = null
   where id = run.automation_id;

  perform private.emit_session_event(
    run.org_id, run.session_id, 'automation.executed', 'automation', null, 'automation',
    null, 'automation', run.automation_id,
    jsonb_build_object('run_id', run.id, 'action', run.action_type));

  return run;
end;
$$;

revoke all on function public.complete_automation_run(uuid, text, jsonb)
  from public, anon, authenticated;

create or replace function public.fail_automation_run(
  target_run_id uuid,
  target_lease_owner text,
  target_error_code text,
  target_error_message_safe text default null
)
returns public.automation_runs
language plpgsql
security definer
set search_path to ''
as $$
declare
  run  public.automation_runs;
  auto public.display_automations;
begin
  update public.automation_runs r
     set status = 'failed',
         error_code = target_error_code,
         error_message_safe = left(target_error_message_safe, 500),
         finished_at = now(),
         lease_owner = null,
         lease_expires_at = null
   where r.id = target_run_id
     and r.lease_owner = target_lease_owner
     and r.status in ('leased', 'running')
  returning * into run;

  if run.id is null then
    raise exception 'Automation run is not leased by this worker' using errcode = '42501';
  end if;

  update public.display_automations a
     set last_run_at = now(),
         last_status = 'failed',
         consecutive_failures = a.consecutive_failures + 1,
         last_error_code = target_error_code,
         last_error_message_safe = left(target_error_message_safe, 500),
         -- Bounded retry: give up rather than loop forever (SOP Purpose §12).
         is_enabled = case when a.consecutive_failures + 1 >= a.max_attempts
                           then false else a.is_enabled end,
         disabled_reason = case when a.consecutive_failures + 1 >= a.max_attempts
                                then 'repeated_failure' else a.disabled_reason end,
         next_run_at = case when a.consecutive_failures + 1 >= a.max_attempts
                            then null
                            else now() + make_interval(secs => a.retry_backoff_seconds) end
   where a.id = run.automation_id
  returning * into auto;

  perform private.emit_session_event(
    run.org_id, run.session_id, 'automation.failed', 'automation', null, 'automation',
    null, 'automation', run.automation_id,
    jsonb_strip_nulls(jsonb_build_object(
      'run_id', run.id, 'error_code', target_error_code,
      'disabled', not auto.is_enabled)));

  return run;
end;
$$;

revoke all on function public.fail_automation_run(uuid, text, text, text)
  from public, anon, authenticated;

-- Sets the next occurrence after a run. The executor supplies the computed time
-- so timezone arithmetic lives in one place rather than being reimplemented here.
create or replace function public.reschedule_automation(
  target_automation_id uuid,
  next_occurrence timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.display_automations
     set next_run_at = next_occurrence
   where id = target_automation_id and is_enabled;
  return next_occurrence;
end;
$$;

revoke all on function public.reschedule_automation(uuid, timestamptz)
  from public, anon, authenticated;

-- Recovers slots whose worker died mid-run.
create or replace function public.expire_stale_automation_leases()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare affected integer;
begin
  with expired as (
    update public.automation_runs r
       set status = 'expired', lease_owner = null, lease_expires_at = null, finished_at = now(),
           error_code = 'lease_expired'
     where r.status in ('leased', 'running')
       and r.lease_expires_at is not null
       and r.lease_expires_at < now()
    returning 1
  )
  select count(*) into affected from expired;
  return affected;
end;
$$;

revoke all on function public.expire_stale_automation_leases()
  from public, anon, authenticated;

grant select on public.automation_runs to authenticated;

commit;
