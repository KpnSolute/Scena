-- Let the Session control plane use the customer-facing Board model without
-- requiring a shadow legacy Layout. Existing Layout-backed Sessions continue
-- to validate during the migration period.

begin;

alter table public.display_sessions
  drop constraint if exists display_sessions_check;

alter table public.display_sessions
  add constraint display_sessions_check check (
    (
      display_mode in ('duplicate', 'extend')
      and (board_id is not null or shared_layout_id is not null)
    )
    or (
      display_mode in ('independent', 'single')
      and shared_layout_id is null
    )
  );

comment on constraint display_sessions_check on public.display_sessions is
  'Duplicate and extend require shared Board or legacy Layout content; independent and single route Boards per Display with the Session Board as fallback.';

commit;
