create or replace function public.admin_update_profile_role(p_user_id uuid, p_role text, p_event_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor_role text;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  v_actor_role := private.current_profile_role();
  if v_actor_role not in ('owner','admin') then raise exception 'ليست لديك صلاحية تعديل أدوار المستخدمين'; end if;
  if p_user_id = auth.uid() then raise exception 'لا يمكنك تغيير دور حسابك الحالي'; end if;
  if p_role not in ('admin','supervisor','gatekeeper','advertiser','customer') then raise exception 'الدور المطلوب غير مسموح'; end if;
  if p_role in ('gatekeeper','advertiser') then
    if p_event_id is null then raise exception 'يجب اختيار فعالية لهذا الدور'; end if;
    if not exists(select 1 from public.events e where e.id=p_event_id and e.status in ('draft','published')) then raise exception 'الفعالية المحددة غير متاحة للإسناد'; end if;
  elsif p_event_id is not null then
    raise exception 'لا يتم ربط هذا الدور بفعالية';
  end if;
  update public.profiles set role=p_role, updated_at=now() where id=p_user_id and role <> 'owner';
  if not found then raise exception 'المستخدم غير موجود أو لا يمكن تغيير صلاحياته'; end if;
  delete from public.event_role_assignments where user_id=p_user_id;
  if p_role in ('gatekeeper','advertiser') then
    insert into public.event_role_assignments(user_id,event_id,assignment_role) values(p_user_id,p_event_id,p_role);
  end if;
end; $$;
revoke all on function public.admin_update_profile_role(uuid,text,uuid) from public,anon;
grant execute on function public.admin_update_profile_role(uuid,text,uuid) to authenticated;