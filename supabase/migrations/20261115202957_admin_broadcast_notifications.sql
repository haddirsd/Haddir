create or replace function public.admin_send_broadcast_notification(p_message text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message text := btrim(coalesce(p_message, ''));
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if private.current_profile_role() not in ('owner', 'admin') then
    raise exception 'Not authorized to send broadcast notifications';
  end if;

  if v_message = '' or char_length(v_message) > 1000 then
    raise exception 'Message must contain between 1 and 1000 characters';
  end if;

  insert into public.notifications (user_id, title, message, type)
  select p.id, 'تنبيه من إدارة حاضر', v_message, 'broadcast'
  from public.profiles p
  where p.id is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_send_broadcast_notification(text) from public, anon;
grant execute on function public.admin_send_broadcast_notification(text) to authenticated;