-- Enable scoped Realtime updates for public events and gatekeeper scan history.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='events') then
    alter publication supabase_realtime add table public.events;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ticket_types') then
    alter publication supabase_realtime add table public.ticket_types;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='gatekeeper_scan_logs') then
    alter publication supabase_realtime add table public.gatekeeper_scan_logs;
  end if;
end $$;

drop policy if exists "Assigned gatekeepers read event scan updates" on public.gatekeeper_scan_logs;
create policy "Assigned gatekeepers read event scan updates"
on public.gatekeeper_scan_logs
for select
to authenticated
using (
  exists (
    select 1 from public.event_role_assignments a
    where a.user_id = (select auth.uid())
      and a.event_id = gatekeeper_scan_logs.event_id
      and a.assignment_role in ('gatekeeper','organizer')
  )
);
