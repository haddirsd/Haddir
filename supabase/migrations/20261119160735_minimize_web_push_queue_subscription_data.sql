-- Keep only a reference to the active subscription; do not duplicate endpoint secrets in the queue.
create or replace function private.dispatch_haddir_web_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  destination text;
begin
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

  insert into private.haddir_web_push_delivery_queue (
    notification_id, user_id, subscription_id, payload
  )
  select
    new.id,
    new.user_id,
    ps.id,
    jsonb_build_object(
      'notification_id', new.id,
      'title', new.title,
      'message', new.message,
      'type', new.type,
      'url', destination
    )
  from public.push_subscriptions ps
  where ps.user_id = new.user_id
  on conflict (notification_id, subscription_id) do nothing;

  return new;
end;
$$;

alter table private.haddir_web_push_delivery_queue
  drop column endpoint,
  drop column subscription;
