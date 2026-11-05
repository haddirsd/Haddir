create extension if not exists pg_cron with schema pg_catalog;

create unique index if not exists notifications_booking_reminder_unique
on public.notifications (booking_id, type)
where booking_id is not null
  and type in ('event_reminder_3d', 'event_reminder_24h', 'event_reminder_6h');

create or replace function private.generate_event_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  with reminder_windows as (
    select *
    from (values
      ('event_reminder_3d'::text, interval '3 days', 'بعد 3 أيام'::text),
      ('event_reminder_24h'::text, interval '24 hours', 'بعد 24 ساعة'::text),
      ('event_reminder_6h'::text, interval '6 hours', 'بعد 6 ساعات'::text)
    ) as r(notification_type, lead_time, label)
  ),
  due as (
    select b.user_id, b.id as booking_id, e.title as event_title, e.venue,
      e.starts_at, rw.notification_type, rw.label
    from public.bookings b
    join public.events e on e.id = b.event_id
    cross join reminder_windows rw
    where b.status = 'confirmed'
      and b.user_id is not null
      and e.status = 'published'
      and e.starts_at > now() + rw.lead_time - interval '5 minutes'
      and e.starts_at <= now() + rw.lead_time
  )
  insert into public.notifications (user_id, booking_id, title, message, type, is_read)
  select due.user_id, due.booking_id, 'تذكير بفعاليتك القادمة',
    'فعالية ' || due.event_title || ' تبدأ ' || due.label ||
      '. الموعد: ' || to_char(due.starts_at at time zone 'Africa/Khartoum', 'DD/MM/YYYY HH24:MI') ||
      case when nullif(due.venue, '') is not null then '. المكان: ' || due.venue else '' end ||
      '. افتح تذاكري لعرض تذكرتك.',
    due.notification_type, false
  from due
  on conflict (booking_id, type)
    where booking_id is not null
      and type in ('event_reminder_3d', 'event_reminder_24h', 'event_reminder_6h')
  do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function private.generate_event_reminders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'haddir-event-reminders') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'haddir-event-reminders';
  end if;
end;
$$;

select cron.schedule(
  'haddir-event-reminders',
  '*/5 * * * *',
  'select private.generate_event_reminders();'
);