-- Send one welcome notification to each confirmed booking when its event starts.
-- The existing five-minute cron job calls this function, so no second scheduler is needed.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type = any (array[
    'ticket_approved'::text,
    'payment_rejected'::text,
    'general'::text,
    'booking_expired'::text,
    'event_reminder_3d'::text,
    'event_reminder_24h'::text,
    'event_reminder_6h'::text,
    'ticket_checked_in'::text,
    'broadcast'::text,
    'event_started'::text
  ]));

drop index if exists public.notifications_booking_reminder_unique;

create unique index notifications_booking_reminder_unique
  on public.notifications (booking_id, type)
  where booking_id is not null
    and type in (
      'event_reminder_3d',
      'event_reminder_24h',
      'event_reminder_6h',
      'event_started'
    );

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
    select
      b.user_id,
      b.id as booking_id,
      e.title as event_title,
      e.venue,
      e.starts_at,
      rw.notification_type,
      rw.label
    from public.bookings b
    join public.events e on e.id = b.event_id
    cross join reminder_windows rw
    where b.status = 'confirmed'
      and b.user_id is not null
      and e.status = 'published'
      and e.starts_at > now() + rw.lead_time - interval '5 minutes'
      and e.starts_at <= now() + rw.lead_time

    union all

    select
      b.user_id,
      b.id as booking_id,
      e.title as event_title,
      e.venue,
      e.starts_at,
      'event_started'::text as notification_type,
      null::text as label
    from public.bookings b
    join public.events e on e.id = b.event_id
    where b.status = 'confirmed'
      and b.user_id is not null
      and e.status = 'published'
      and coalesce(e.is_continuous, false) = false
      and e.starts_at > now() - interval '10 minutes'
      and e.starts_at <= now()
  )
  insert into public.notifications (user_id, booking_id, title, message, type, is_read)
  select
    due.user_id,
    due.booking_id,
    case
      when due.notification_type = 'event_started' then 'بدأت فعاليتك الآن 🎉'
      else 'تذكير بفعاليتك القادمة'
    end,
    case
      when due.notification_type = 'event_started' then
        'أهلاً بك في فعالية «' || due.event_title ||
        '»! بدأت الفعالية الآن. نتمنى لك قضاء وقت جميل وممتع وتجربة مليئة باللحظات السعيدة.' ||
        case when nullif(due.venue, '') is not null then ' المكان: ' || due.venue || '.' else '' end
      else
        'فعالية ' || due.event_title || ' تبدأ ' || due.label ||
        '. الموعد: ' || to_char(due.starts_at at time zone 'Africa/Khartoum', 'DD/MM/YYYY HH24:MI') ||
        case when nullif(due.venue, '') is not null then '. المكان: ' || due.venue else '' end ||
        '. افتح تذاكري لعرض تذكرتك.'
    end,
    due.notification_type,
    false
  from due
  on conflict (booking_id, type)
    where booking_id is not null
      and type in (
        'event_reminder_3d',
        'event_reminder_24h',
        'event_reminder_6h',
        'event_started'
      )
  do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function private.generate_event_reminders() from public, anon, authenticated;

create or replace function private.dispatch_haddir_web_push()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  hook_secret text;
  destination text;
begin
  select decrypted_secret into hook_secret
  from vault.decrypted_secrets
  where name = 'haddir_push_hook_secret'
  limit 1;

  if hook_secret is null then
    return new;
  end if;

  destination := case
    when new.type in (
      'ticket_approved',
      'event_reminder_3d',
      'event_reminder_24h',
      'event_reminder_6h',
      'event_started'
    ) then '/?tab=tickets'
    else '/?tab=notifications'
  end;

  perform net.http_post(
    url := 'https://puhmvcekxkcxfdvgygpk.supabase.co/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-haddir-push-hook', hook_secret
    ),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'notification_id', new.id,
      'title', new.title,
      'message', new.message,
      'type', new.type,
      'url', destination
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

revoke all on function private.dispatch_haddir_web_push() from public, anon, authenticated;
