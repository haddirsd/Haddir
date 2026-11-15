-- Safely transfer a device's unique push endpoint to the currently authenticated account.
-- This avoids weakening table RLS or allowing clients to update another user's row.
create or replace function public.sync_haddir_push_subscription(
  p_endpoint text,
  p_subscription jsonb,
  p_device_label text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_endpoint is null
    or p_endpoint !~ '^https://'
    or p_subscription is null
    or jsonb_typeof(p_subscription) <> 'object'
    or not (p_subscription ? 'keys')
    or not (p_subscription ? 'endpoint')
    or p_subscription->>'endpoint' <> p_endpoint then
    raise exception 'Invalid push subscription' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (
    user_id, endpoint, subscription, device_label, updated_at
  )
  values (
    v_user_id, p_endpoint, p_subscription, p_device_label, now()
  )
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        subscription = excluded.subscription,
        device_label = excluded.device_label,
        updated_at = now();
end;
$$;

revoke all on function public.sync_haddir_push_subscription(text, jsonb, text)
  from public, anon;
grant execute on function public.sync_haddir_push_subscription(text, jsonb, text)
  to authenticated;
