-- Scope supervisors to explicitly assigned events, matching gatekeeper isolation.
alter table public.event_role_assignments
  drop constraint if exists event_role_assignments_assignment_role_check;
alter table public.event_role_assignments
  add constraint event_role_assignments_assignment_role_check
  check (assignment_role in ('supervisor','gatekeeper','advertiser'));

drop policy if exists "Assigned staff can read assigned events" on public.events;
create policy "Assigned staff can read assigned events"
on public.events for select to authenticated
using (
  exists (
    select 1 from public.event_role_assignments a
    where a.user_id = (select auth.uid())
      and a.event_id = events.id
      and a.assignment_role in ('supervisor','gatekeeper','advertiser')
  )
);

drop policy if exists "Platform staff read all bookings" on public.bookings;
create policy "Platform staff read assigned bookings"
on public.bookings for select to authenticated
using (
  private.current_profile_role() in ('owner','admin')
  or (
    private.current_profile_role() = 'supervisor'
    and exists (
      select 1 from public.event_role_assignments a
      where a.user_id = (select auth.uid())
        and a.event_id = bookings.event_id
        and a.assignment_role = 'supervisor'
    )
  )
);

drop policy if exists "Platform staff read booking items" on public.booking_items;
create policy "Platform staff read assigned booking items"
on public.booking_items for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_items.booking_id
      and (
        private.current_profile_role() in ('owner','admin')
        or (
          private.current_profile_role() = 'supervisor'
          and exists (
            select 1 from public.event_role_assignments a
            where a.user_id = (select auth.uid())
              and a.event_id = b.event_id
              and a.assignment_role = 'supervisor'
          )
        )
      )
  )
);

drop policy if exists "Platform staff read payment submissions" on public.payment_submissions;
create policy "Platform staff read assigned payment submissions"
on public.payment_submissions for select to authenticated
using (
  private.current_profile_role() in ('owner','admin')
  or (
    private.current_profile_role() = 'supervisor'
    and exists (
      select 1
      from public.bookings b
      join public.event_role_assignments a
        on a.event_id = b.event_id
       and a.user_id = (select auth.uid())
       and a.assignment_role = 'supervisor'
      where b.id = payment_submissions.booking_id
    )
  )
);

drop policy if exists "Owners and admins read payment receipts" on storage.objects;
create policy "Assigned staff read payment receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'payment-receipts'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or private.current_profile_role() in ('owner','admin')
    or (
      private.current_profile_role() = 'supervisor'
      and exists (
        select 1
        from public.bookings b
        join public.event_role_assignments a
          on a.event_id = b.event_id
         and a.user_id = (select auth.uid())
         and a.assignment_role = 'supervisor'
        where b.id::text = (storage.foldername(objects.name))[2]
      )
    )
  )
);

create or replace function private.admin_update_profile_role(
  p_user_id uuid, p_role text, p_event_id uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor_role text;
  v_target_role text;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  v_actor_role := private.current_profile_role();
  if v_actor_role not in ('owner','admin') then raise exception 'ليست لديك صلاحية تعديل أدوار المستخدمين'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'لا يمكنك تغيير دور حسابك الحالي'; end if;
  if p_role not in ('admin','supervisor','gatekeeper','advertiser','customer') then raise exception 'الدور المطلوب غير مسموح'; end if;
  if p_role = 'admin' and v_actor_role <> 'owner' then raise exception 'تعيين المشرف الإداري من صلاحيات مالك المنصة فقط'; end if;

  select p.role into v_target_role from public.profiles p where p.id = p_user_id for update;
  if not found then raise exception 'المستخدم غير موجود'; end if;
  if v_target_role = 'owner' then raise exception 'لا يمكن تغيير صلاحيات مالك المنصة'; end if;
  if v_actor_role = 'admin' and v_target_role = 'admin' then raise exception 'لا يحق للمشرف الإداري تغيير صلاحيات مشرف إداري آخر'; end if;

  if p_role in ('supervisor','gatekeeper','advertiser') then
    if p_event_id is null then raise exception 'يجب اختيار فعالية لهذا الدور'; end if;
    if not exists (select 1 from public.events e where e.id=p_event_id and e.status in ('draft','published')) then
      raise exception 'الفعالية المحددة غير متاحة للإسناد';
    end if;
  elsif p_event_id is not null then
    raise exception 'لا يتم ربط هذا الدور بفعالية';
  end if;

  if v_target_role = p_role and p_role in ('supervisor','gatekeeper','advertiser') then
    insert into public.event_role_assignments(user_id,event_id,assignment_role)
    values (p_user_id,p_event_id,p_role)
    on conflict (user_id,event_id,assignment_role) do nothing;
    return;
  end if;

  update public.profiles set role=p_role, updated_at=now() where id=p_user_id;
  delete from public.event_role_assignments where user_id=p_user_id;
  if p_role in ('supervisor','gatekeeper','advertiser') then
    insert into public.event_role_assignments(user_id,event_id,assignment_role)
    values (p_user_id,p_event_id,p_role);
  end if;
end;
$$;

create or replace function private.admin_remove_event_role_assignment(
  p_user_id uuid, p_role text, p_event_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor_role text;
  v_target_role text;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  v_actor_role := private.current_profile_role();
  if v_actor_role not in ('owner','admin') then raise exception 'ليست لديك صلاحية إدارة تكليفات الفعاليات'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'لا يمكنك تعديل تكليفات حسابك الحالي'; end if;
  if p_role not in ('supervisor','gatekeeper','advertiser') or p_event_id is null then raise exception 'التكليف المحدد غير صالح'; end if;

  select role into v_target_role from public.profiles where id=p_user_id for update;
  if not found or v_target_role <> p_role then raise exception 'الدور المحدد لا يطابق حساب المستخدم'; end if;
  if v_target_role='owner' or (v_actor_role='admin' and v_target_role='admin') then raise exception 'لا يمكنك تعديل صلاحيات هذا المستخدم'; end if;

  delete from public.event_role_assignments
  where user_id=p_user_id and event_id=p_event_id and assignment_role=p_role;
  if not found then raise exception 'التكليف المحدد غير موجود'; end if;

  if not exists (select 1 from public.event_role_assignments where user_id=p_user_id and assignment_role=p_role) then
    update public.profiles set role='customer',updated_at=now() where id=p_user_id and role=p_role;
  end if;
end;
$$;

create or replace function public.admin_remove_event_role_assignment(
  p_user_id uuid, p_role text, p_event_id uuid
) returns void
language sql set search_path = ''
as $$ select private.admin_remove_event_role_assignment(p_user_id,p_role,p_event_id); $$;

revoke all on function private.admin_remove_event_role_assignment(uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.admin_remove_event_role_assignment(uuid,text,uuid) to authenticated;
revoke all on function public.admin_remove_event_role_assignment(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_remove_event_role_assignment(uuid,text,uuid) to authenticated;

create or replace function public.review_payment_submission(
  p_submission_id uuid, p_decision text, p_rejection_reason text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_payment public.payment_submissions%rowtype;
  v_booking public.bookings%rowtype;
  v_item record;
  v_ticket_code text;
  v_ticket_count integer := 0;
  v_attendee_count integer := 0;
begin
  v_role := private.current_profile_role();
  if coalesce(v_role,'') not in ('owner','admin','supervisor') then
    raise exception 'غير مصرح لك بمراجعة المدفوعات';
  end if;
  if p_decision is null or p_decision not in ('approve','reject') then
    raise exception 'قرار المراجعة غير صحيح';
  end if;
  if p_decision='reject' and nullif(trim(coalesce(p_rejection_reason,'')),'') is null then
    raise exception 'اكتب سبب رفض إثبات الدفع';
  end if;
  perform pg_advisory_xact_lock(748231905441::bigint);
  select * into v_payment from public.payment_submissions where id=p_submission_id for update;
  if not found then raise exception 'إثبات الدفع غير موجود'; end if;
  if v_payment.status <> 'submitted' then raise exception 'تمت مراجعة إثبات الدفع مسبقاً'; end if;
  select * into v_booking from public.bookings where id=v_payment.booking_id for update;
  if not found then raise exception 'الحجز غير موجود'; end if;
  if v_booking.user_id is null then raise exception 'الحجز غير مرتبط بحساب مستخدم'; end if;

  if v_role='supervisor' and not exists (
    select 1 from public.event_role_assignments a
    where a.user_id=auth.uid()
      and a.event_id=v_booking.event_id
      and a.assignment_role='supervisor'
  ) then
    raise exception 'لا تملك تكليفاً لمراجعة حجوزات هذه الفعالية';
  end if;

  if p_decision='approve' then
    select coalesce(sum(bi.quantity),0)::integer into v_attendee_count
    from public.booking_items bi where bi.booking_id=v_booking.id;
    for v_item in
      select bi.*,tt.name as ticket_name
      from public.booking_items bi
      join public.ticket_types tt on tt.id=bi.ticket_type_id
      where bi.booking_id=v_booking.id
    loop
      loop
        v_ticket_code := lpad(floor(random()*10000000000)::bigint::text,10,'0');
        exit when not exists(select 1 from public.tickets where ticket_code=v_ticket_code);
      end loop;
      insert into public.tickets(
        booking_item_id,booking_id,event_id,ticket_type_id,ticket_code,attendee_name,status
      ) values (
        v_item.id,v_booking.id,v_booking.event_id,v_item.ticket_type_id,
        v_ticket_code,v_booking.customer_name,'valid'
      );
      v_ticket_count := v_ticket_count+1;
    end loop;
    update public.payment_submissions
    set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_note=null
    where id=v_payment.id;
    update public.bookings
    set status='confirmed',expires_at=null,updated_at=now()
    where id=v_booking.id;
    insert into public.notifications(user_id,booking_id,title,message,type)
    values (
      v_booking.user_id,v_booking.id,'تم قبول حجزك وإصدار تذكرتك',
      'تم اعتماد الدفع لحجزك رقم '||v_booking.booking_number||
      '. أُصدرت '||v_ticket_count||' تذكرة تشمل '||v_attendee_count||
      ' من الأشخاص، ويمكنك مشاهدة كود الدخول في قسم تذاكري.','ticket_approved'
    );
  else
    update public.payment_submissions
    set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),review_note=trim(p_rejection_reason)
    where id=v_payment.id;
    for v_item in
      select ticket_type_id,quantity from public.booking_items where booking_id=v_booking.id
    loop
      update public.ticket_types
      set quantity_sold=greatest(0,quantity_sold-v_item.quantity),updated_at=now()
      where id=v_item.ticket_type_id;
    end loop;
    update public.bookings set status='rejected',updated_at=now() where id=v_booking.id;
    insert into public.notifications(user_id,booking_id,title,message,type)
    values (
      v_booking.user_id,v_booking.id,'تعذر قبول إثبات الدفع',
      'تم رفض إثبات الدفع للحجز رقم '||v_booking.booking_number||
      '. السبب: '||trim(p_rejection_reason),'payment_rejected'
    );
  end if;
  return jsonb_build_object(
    'success',true,'decision',p_decision,'tickets_created',v_ticket_count,
    'attendee_count',v_attendee_count,'booking_id',v_booking.id
  );
end;
$$;

revoke all on function public.review_payment_submission(uuid,text,text) from public,anon;
grant execute on function public.review_payment_submission(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
