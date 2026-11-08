-- Harden role assignment and scoped staff access.
-- One gatekeeper/advertiser account can be assigned to one event only.
alter table public.event_role_assignments
  add constraint event_role_assignments_one_event_per_user unique (user_id);

-- Assignment writes are only allowed through the privileged role RPC.
revoke all on table public.event_role_assignments from anon, authenticated;
grant select on table public.event_role_assignments to authenticated;

drop policy if exists "Platform admins manage event role assignments" on public.event_role_assignments;
drop policy if exists "Users read own event role assignments" on public.event_role_assignments;
create policy "Users read own event role assignments"
on public.event_role_assignments
for select to authenticated
using (
  user_id = (select auth.uid())
  or private.current_profile_role() in ('owner','admin')
);

-- Users may update their basic profile fields, but never their role.
revoke update (role) on table public.profiles from anon, authenticated;

-- Keep the SECURITY DEFINER implementation outside the exposed public API schema.
drop function if exists public.admin_update_profile_role(uuid, text, uuid);
create or replace function private.admin_update_profile_role(
  p_user_id uuid,
  p_role text,
  p_event_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_role text;
  v_target_role text;
begin
  if auth.uid() is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  v_actor_role := private.current_profile_role();
  if v_actor_role not in ('owner','admin') then
    raise exception 'ليست لديك صلاحية تعديل أدوار المستخدمين';
  end if;

  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'لا يمكنك تغيير دور حسابك الحالي';
  end if;

  if p_role not in ('admin','supervisor','gatekeeper','advertiser','customer') then
    raise exception 'الدور المطلوب غير مسموح';
  end if;

  -- Only the platform owner may grant or revoke the admin role.
  if p_role = 'admin' and v_actor_role <> 'owner' then
    raise exception 'تعيين المشرف الإداري من صلاحيات مالك المنصة فقط';
  end if;

  select p.role into v_target_role
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'المستخدم غير موجود';
  end if;

  if v_target_role = 'owner' then
    raise exception 'لا يمكن تغيير صلاحيات مالك المنصة';
  end if;

  if v_actor_role = 'admin' and v_target_role = 'admin' then
    raise exception 'لا يحق للمشرف الإداري تغيير صلاحيات مشرف إداري آخر';
  end if;

  if p_role in ('gatekeeper','advertiser') then
    if p_event_id is null then
      raise exception 'يجب اختيار فعالية لهذا الدور';
    end if;
    if not exists (
      select 1 from public.events e
      where e.id = p_event_id and e.status in ('draft','published')
    ) then
      raise exception 'الفعالية المحددة غير متاحة للإسناد';
    end if;
  elsif p_event_id is not null then
    raise exception 'لا يتم ربط هذا الدور بفعالية';
  end if;

  update public.profiles
  set role = p_role, updated_at = now()
  where id = p_user_id;

  delete from public.event_role_assignments
  where user_id = p_user_id;

  if p_role in ('gatekeeper','advertiser') then
    insert into public.event_role_assignments(user_id,event_id,assignment_role)
    values (p_user_id,p_event_id,p_role);
  end if;
end;
$function$;

revoke all on function private.admin_update_profile_role(uuid,text,uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.admin_update_profile_role(uuid,text,uuid) to authenticated;

create or replace function public.admin_update_profile_role(
  p_user_id uuid,
  p_role text,
  p_event_id uuid default null
)
returns void
language sql
security invoker
set search_path = ''
as $function$
  select private.admin_update_profile_role(p_user_id,p_role,p_event_id);
$function$;

revoke all on function public.admin_update_profile_role(uuid,text,uuid) from public, anon;
grant execute on function public.admin_update_profile_role(uuid,text,uuid) to authenticated;
