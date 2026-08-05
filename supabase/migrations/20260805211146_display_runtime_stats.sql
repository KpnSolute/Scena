begin;

-- High-frequency player measurements belong on the existing one-row-per-
-- Display health record. They are intentionally kept out of
-- display_health_events so a four-second heartbeat does not create an
-- append-only write stream.
alter table public.display_health
  add column if not exists runtime_stats jsonb not null default '{}'::jsonb;

alter table public.display_health
  drop constraint if exists display_health_runtime_stats_is_object_check,
  drop constraint if exists display_health_runtime_stats_size_check;

alter table public.display_health
  add constraint display_health_runtime_stats_is_object_check
    check (jsonb_typeof(runtime_stats) = 'object'),
  add constraint display_health_runtime_stats_size_check
    check (pg_column_size(runtime_stats) <= 4096);

comment on column public.display_health.runtime_stats is
  'Bounded player measurements reported through display-gateway for the authenticated Manager control room.';

commit;
