create or replace function public.admin_update_profile_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
begin
  if auth.uid() is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  v_actor_role := private.current_profile_role();
  if v_actor_role not in ('owner', 'admin') then
    raise exception 'ليست لديك صلاحية تعديل أدوار المستخدمين';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'لا يمكنك تغيير دور حسابك الحالي';
  end if;

  if p_role not in ('supervisor', 'organizer', 'gatekeeper', 'advertiser', 'customer') then
    raise exception 'الدور المطلوب غير مسموح';
  end if;

  update public.profiles
     set role = p_role
   where id = p_user_id
     and role not in ('owner', 'admin');

  if not found then
    raise exception 'المستخدم غير موجود أو لا يمكن تغيير صلاحياته';
  end if;
end;
$$;

revoke all on function public.admin_update_profile_role(uuid, text) from public, anon;
grant execute on function public.admin_update_profile_role(uuid, text) to authenticated;
