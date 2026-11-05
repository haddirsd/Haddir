-- Role labels are presentation only; keep stable internal role keys.
-- Legacy organizer accounts must be re-assigned to a specific event by an admin.
update public.profiles set role='gatekeeper', updated_at=now() where role='organizer';

create table if not exists public.event_role_assignments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  assignment_role text not null check (assignment_role in ('gatekeeper','advertiser')),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id, assignment_role)
);
create index if not exists event_role_assignments_event_role_idx on public.event_role_assignments(event_id, assignment_role);
alter table public.event_role_assignments enable row level security;
drop policy if exists "Users read own event role assignments" on public.event_role_assignments;
create policy "Users read own event role assignments" on public.event_role_assignments
for select to authenticated using (user_id = (select auth.uid()) or private.current_profile_role() in ('owner','admin'));
drop policy if exists "Platform admins manage event role assignments" on public.event_role_assignments;
create policy "Platform admins manage event role assignments" on public.event_role_assignments
for all to authenticated using (private.current_profile_role() in ('owner','admin'))
with check (private.current_profile_role() in ('owner','admin'));
grant select, insert, update, delete on public.event_role_assignments to authenticated;

create or replace function public.admin_update_profile_role(p_user_id uuid, p_role text, p_event_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor_role text;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  v_actor_role := private.current_profile_role();
  if v_actor_role not in ('owner','admin') then raise exception 'ليست لديك صلاحية تعديل أدوار المستخدمين'; end if;
  if p_user_id = auth.uid() then raise exception 'لا يمكنك تغيير دور حسابك الحالي'; end if;
  if p_role not in ('supervisor','gatekeeper','advertiser','customer') then raise exception 'الدور المطلوب غير مسموح'; end if;
  if p_role in ('gatekeeper','advertiser') then
    if p_event_id is null then raise exception 'يجب اختيار فعالية لهذا الدور'; end if;
    if not exists(select 1 from public.events e where e.id=p_event_id) then raise exception 'الفعالية المحددة غير موجودة'; end if;
  elsif p_event_id is not null then
    raise exception 'لا يتم ربط هذا الدور بفعالية';
  end if;
  update public.profiles set role=p_role, updated_at=now()
   where id=p_user_id and role not in ('owner','admin');
  if not found then raise exception 'المستخدم غير موجود أو لا يمكن تغيير صلاحياته'; end if;
  delete from public.event_role_assignments where user_id=p_user_id;
  if p_role in ('gatekeeper','advertiser') then
    insert into public.event_role_assignments(user_id,event_id,assignment_role)
    values(p_user_id,p_event_id,p_role);
  end if;
end; $$;
revoke all on function public.admin_update_profile_role(uuid,text) from public,anon,authenticated;
revoke all on function public.admin_update_profile_role(uuid,text,uuid) from public,anon;
grant execute on function public.admin_update_profile_role(uuid,text,uuid) to authenticated;

drop policy if exists "Assigned staff can read assigned events" on public.events;
create policy "Assigned staff can read assigned events" on public.events
for select to authenticated using (
 exists(select 1 from public.event_role_assignments a where a.user_id=(select auth.uid()) and a.event_id=events.id and a.assignment_role in ('gatekeeper','advertiser'))
);
