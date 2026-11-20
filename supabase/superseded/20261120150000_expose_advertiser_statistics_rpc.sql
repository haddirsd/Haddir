-- Expose the advertiser statistics through the public PostgREST RPC schema.
-- The implementation remains private and enforces the advertiser role and single-event assignment.
grant usage on schema private to authenticated;

create or replace function public.get_advertiser_event_statistics()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_advertiser_event_statistics();
$$;

revoke all on function public.get_advertiser_event_statistics() from public, anon;
grant execute on function public.get_advertiser_event_statistics() to authenticated;

notify pgrst, 'reload schema';
