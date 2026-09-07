begin;

-- KpnSolute menu connections combine day and cycle events into one logical
-- snapshot. Generic webhooks send complete snapshots, so replace their prior
-- payload instead of retaining top-level keys the provider removed.
create or replace function public.commit_content_source_event(
  target_source_id uuid,
  target_event_id text,
  target_event_type text,
  target_occurred_at timestamptz,
  target_payload jsonb
) returns table(duplicate boolean, version bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.content_sources%rowtype;
begin
  if jsonb_typeof(target_payload) is distinct from 'object' then
    raise exception 'content source payload must be an object';
  end if;

  select * into source_row
    from public.content_sources
   where id = target_source_id and status = 'active'
   for update;
  if not found then raise exception 'content source unavailable'; end if;
  if not (target_event_type = any(source_row.accepted_event_types)) then
    raise exception 'event type not accepted';
  end if;

  insert into public.content_source_events(
    workspace_id, source_id, event_id, event_type, occurred_at, payload
  ) values (
    source_row.workspace_id, source_row.id, target_event_id,
    target_event_type, target_occurred_at, target_payload
  ) on conflict (source_id, event_id) do nothing;

  if not found then
    return query select true, source_row.current_version;
    return;
  end if;

  update public.content_sources set
    current_payload = case
      when source_row.protocol = 'kpnsolute-events-v1'
        then current_payload || target_payload
      else target_payload
    end,
    current_event_id = target_event_id,
    current_event_type = target_event_type,
    current_version = current_version + 1,
    last_received_at = now(),
    updated_at = now()
  where id = source_row.id
  returning current_version into source_row.current_version;

  return query select false, source_row.current_version;
end;
$$;

revoke all on function public.commit_content_source_event(uuid,text,text,timestamptz,jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_content_source_event(uuid,text,text,timestamptz,jsonb)
  to service_role;

commit;
