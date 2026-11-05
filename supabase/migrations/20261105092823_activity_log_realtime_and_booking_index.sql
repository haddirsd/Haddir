create index if not exists admin_activity_log_booking_idx on public.admin_activity_log(booking_id, created_at desc);
do $$
begin
 if exists (select 1 from pg_publication where pubname='supabase_realtime')
 and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='admin_activity_log') then
  alter publication supabase_realtime add table public.admin_activity_log;
 end if;
end;
$$;
