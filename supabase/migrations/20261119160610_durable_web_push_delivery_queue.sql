-- Durable, per-device Web Push delivery queue with bounded retries.
create table if not exists private.haddir_web_push_delivery_queue (
  id bigint generated always as identity primary key,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  endpoint text not null,
  subscription jsonb not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry', 'sent', 'expired', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, subscription_id)
);

create index if not exists haddir_web_push_queue_ready_idx
  on private.haddir_web_push_delivery_queue (next_attempt_at, id)
  where status in ('pending', 'retry', 'processing');

revoke all on table private.haddir_web_push_delivery_queue from public, anon, authenticated, service_role;

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
    notification_id, user_id, subscription_id, endpoint, subscription, payload
  )
  select
    new.id,
    new.user_id,
    ps.id,
    ps.endpoint,
    ps.subscription,
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

revoke all on function private.dispatch_haddir_web_push() from public, anon, authenticated;

create or replace function public.claim_haddir_web_push_deliveries(p_limit integer default 50)
returns table (
  delivery_id bigint,
  endpoint text,
  subscription jsonb,
  payload jsonb,
  attempt_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.haddir_web_push_delivery_queue q
  set status = 'cancelled',
      updated_at = now(),
      last_error = 'Push subscription is no longer owned by the notification recipient'
  where q.status in ('pending', 'retry')
    and not exists (
      select 1
      from public.push_subscriptions ps
      where ps.id = q.subscription_id
        and ps.user_id = q.user_id
    );

  return query
  with candidates as (
    select q.id
    from private.haddir_web_push_delivery_queue q
    join public.push_subscriptions ps
      on ps.id = q.subscription_id
     and ps.user_id = q.user_id
    where (
      (q.status in ('pending', 'retry') and q.next_attempt_at <= now())
      or (q.status = 'processing' and q.locked_until < now())
    )
    order by q.next_attempt_at, q.id
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update of q skip locked
  ),
  claimed as (
    update private.haddir_web_push_delivery_queue q
    set status = 'processing',
        attempt_count = q.attempt_count + 1,
        locked_until = now() + interval '2 minutes',
        updated_at = now()
    from candidates c
    where q.id = c.id
    returning q.id, q.subscription_id, q.user_id, q.payload, q.attempt_count
  )
  select c.id, ps.endpoint, ps.subscription, c.payload, c.attempt_count
  from claimed c
  join public.push_subscriptions ps
    on ps.id = c.subscription_id
   and ps.user_id = c.user_id;
end;
$$;

create or replace function public.complete_haddir_web_push_delivery(
  p_delivery_id bigint,
  p_outcome text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempt integer;
  current_subscription_id uuid;
begin
  select q.attempt_count, q.subscription_id
    into current_attempt, current_subscription_id
  from private.haddir_web_push_delivery_queue q
  where q.id = p_delivery_id
    and q.status = 'processing'
  for update;

  if not found then
    raise exception 'Web Push delivery % is not currently claimed', p_delivery_id
      using errcode = 'P0002';
  end if;

  if p_outcome = 'sent' then
    update private.haddir_web_push_delivery_queue
    set status = 'sent', sent_at = now(), locked_until = null,
        last_error = null, updated_at = now()
    where id = p_delivery_id;
  elsif p_outcome = 'expired' then
    update private.haddir_web_push_delivery_queue
    set status = 'expired', locked_until = null,
        last_error = null, updated_at = now()
    where id = p_delivery_id;

    delete from public.push_subscriptions where id = current_subscription_id;
  elsif p_outcome = 'retry' and current_attempt < 6 then
    update private.haddir_web_push_delivery_queue
    set status = 'retry',
        next_attempt_at = now() + case current_attempt
          when 1 then interval '1 minute'
          when 2 then interval '5 minutes'
          when 3 then interval '15 minutes'
          when 4 then interval '30 minutes'
          else interval '1 hour'
        end,
        locked_until = null,
        last_error = left(coalesce(p_error, 'Temporary Web Push delivery failure'), 1000),
        updated_at = now()
    where id = p_delivery_id;
  else
    update private.haddir_web_push_delivery_queue
    set status = 'failed', locked_until = null,
        last_error = left(coalesce(p_error, 'Permanent Web Push delivery failure'), 1000),
        updated_at = now()
    where id = p_delivery_id;
  end if;
end;
$$;

revoke all on function public.claim_haddir_web_push_deliveries(integer) from public, anon, authenticated;
revoke all on function public.complete_haddir_web_push_delivery(bigint, text, text) from public, anon, authenticated;
grant execute on function public.claim_haddir_web_push_deliveries(integer) to service_role;
grant execute on function public.complete_haddir_web_push_delivery(bigint, text, text) to service_role;

create or replace function private.invoke_haddir_web_push_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_secret text;
begin
  select decrypted_secret into hook_secret
  from vault.decrypted_secrets
  where name = 'haddir_push_hook_secret'
  limit 1;

  if hook_secret is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://puhmvcekxkcxfdvgygpk.supabase.co/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-haddir-push-hook', hook_secret
    ),
    body := jsonb_build_object('source', 'haddir-web-push-queue'),
    timeout_milliseconds := 5000
  );
end;
$$;

revoke all on function private.invoke_haddir_web_push_worker() from public, anon, authenticated;

select cron.schedule(
  'haddir-web-push-delivery-worker',
  '* * * * *',
  'select private.invoke_haddir_web_push_worker();'
);
