-- Enforce one role and one active event assignment per staff account.
-- The existing UNIQUE(user_id) constraint remains the database guarantee.

create or replace function private.admin_update_profile_role(
  p_user_id uuid, p_role text, p_event_id uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor_role text;
  v_target_role text;
  v_existing_event_id uuid;
  v_existing_assignment_role text;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  v_actor_role := private.current_profile_role();
  if v_actor_role not in ('owner','admin') then raise exception 'ليست لديك صلاحية تعديل أدوار المستخدمين'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'لا يمكنك تغيير دور حسابك الحالي'; end if;
  if p_role not in ('admin','supervisor','gatekeeper','advertiser','customer') then raise exception 'الدور المطلوب غير مسموح'; end if;
  if p_role = 'admin' and v_actor_role <> 'owner' then raise exception 'تعيين المشرف الإداري من صلاحيات مالك المنصة فقط'; end if;

  select p.role into v_target_role from public.profiles p where p.id=p_user_id for update;
  if not found then raise exception 'المستخدم غير موجود'; end if;
  if v_target_role='owner' then raise exception 'لا يمكن تغيير صلاحيات مالك المنصة'; end if;
  if v_actor_role='admin' and v_target_role='admin' then
    raise exception 'لا يحق للمشرف الإداري تغيير صلاحيات مشرف إداري آخر';
  end if;

  if p_role in ('supervisor','gatekeeper','advertiser') then
    if p_event_id is null then raise exception 'يجب اختيار فعالية لهذا الدور'; end if;
    if not exists (select 1 from public.events e where e.id=p_event_id and e.status in ('draft','published')) then
      raise exception 'الفعالية المحددة غير متاحة للإسناد';
    end if;
  elsif p_event_id is not null then
    raise exception 'لا يتم ربط هذا الدور بفعالية';
  end if;

  -- The profile row lock serializes concurrent assignment attempts.
  if v_target_role=p_role and p_role in ('supervisor','gatekeeper','advertiser') then
    select a.event_id,a.assignment_role
      into v_existing_event_id,v_existing_assignment_role
    from public.event_role_assignments a
    where a.user_id=p_user_id;

    if found then
      if v_existing_assignment_role<>p_role then
        raise exception 'يوجد تكليف حالي لا يتطابق مع دور المستخدم؛ راجع التكليف قبل تغييره';
      end if;
      if v_existing_event_id<>p_event_id then
        raise exception 'هذا المستخدم لديه تكليف قائم بفعالية أخرى. ألغِ التكليف الحالي أولاً قبل إسناد فعالية جديدة';
      end if;
      return;
    end if;

    insert into public.event_role_assignments(user_id,event_id,assignment_role)
    values(p_user_id,p_event_id,p_role);
    return;
  end if;

  update public.profiles set role=p_role,updated_at=now() where id=p_user_id;
  delete from public.event_role_assignments where user_id=p_user_id;
  if p_role in ('supervisor','gatekeeper','advertiser') then
    insert into public.event_role_assignments(user_id,event_id,assignment_role)
    values(p_user_id,p_event_id,p_role);
  end if;
end;
$$;

create or replace function private.gatekeeper_manual_ticket_action(
  p_ticket_code text,p_confirm boolean default true
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_assigned_event_id uuid;
  v_ticket_id uuid;
  v_ticket_event_id uuid;
  v_result jsonb;
  v_outcome text;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  select p.role into v_role from public.profiles p where p.id=v_uid;
  if coalesce(v_role,'') not in ('gatekeeper','organizer') then raise exception 'هذه الخدمة مخصصة للبواب فقط'; end if;
  if coalesce(btrim(p_ticket_code),'') !~ '^[0-9]{10}$' then
    raise exception 'كود التذكرة يجب أن يتكون من 10 أرقام فقط';
  end if;

  -- UNIQUE(user_id) guarantees at most one assignment; do not select "latest".
  select a.event_id into v_assigned_event_id
  from public.event_role_assignments a
  where a.user_id=v_uid and a.assignment_role in ('gatekeeper','organizer');
  if not found then raise exception 'حسابك غير مربوط بفعالية'; end if;

  select t.id,t.event_id into v_ticket_id,v_ticket_event_id
  from public.tickets t where t.ticket_code=btrim(p_ticket_code) limit 1;

  if v_ticket_id is not null and v_ticket_event_id<>v_assigned_event_id then
    raise exception 'هذه التذكرة لا تخص الفعالية المصرح لك بها';
  end if;

  v_result:=private.gatekeeper_ticket_action_core(btrim(p_ticket_code),p_confirm);
  v_outcome:=case v_result->>'status'
    when 'checked_in' then 'accepted' when 'used' then 'used'
    when 'not_found' then 'forged' when 'invalid' then 'invalid' else null end;

  if v_outcome is not null then
    insert into public.gatekeeper_scan_logs(gatekeeper_user_id,event_id,ticket_id,outcome,entry_method,entered_code)
    values(v_uid,v_assigned_event_id,v_ticket_id,v_outcome,'manual',btrim(p_ticket_code));
  end if;
  return v_result;
end;
$$;

create or replace function private.get_advertiser_event_statistics()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid:=auth.uid();
  v_event_id uuid;
  v_assignment_count integer;
  v_result jsonb;
begin
  if v_user_id is null or not exists (
    select 1 from public.profiles p where p.id=v_user_id and p.role='advertiser'
  ) then
    raise exception 'هذه الإحصائيات متاحة لحسابات المعلنين فقط';
  end if;

  select count(*)::integer into v_assignment_count
  from public.event_role_assignments a
  where a.user_id=v_user_id and a.assignment_role='advertiser';

  if v_assignment_count<>1 then
    raise exception 'يجب أن يكون لحساب المعلن تكليف واحد فقط بفعالية واحدة';
  end if;

  select a.event_id into strict v_event_id
  from public.event_role_assignments a
  where a.user_id=v_user_id and a.assignment_role='advertiser';

  select jsonb_build_object(
    'event',jsonb_build_object(
      'id',e.id,'title',e.title,'starts_at',e.starts_at,
      'ends_at',e.ends_at,'venue',e.venue,'city',e.city,
      'status',e.status,'platform_fee_percent',coalesce(e.platform_fee_percent,0)
    ),
    'totals',jsonb_build_object(
      'confirmed_bookings',(select count(*) from public.bookings b where b.event_id=e.id and b.status='confirmed'),
      'rejected_bookings',(select count(*) from public.bookings b where b.event_id=e.id and b.status='rejected'),
      'bookers',(select count(distinct b.user_id) from public.bookings b where b.event_id=e.id and b.status='confirmed'),
      'confirmed_tickets',(select coalesce(sum(bi.quantity),0) from public.booking_items bi join public.bookings b on b.id=bi.booking_id where b.event_id=e.id and b.status='confirmed'),
      'rejected_tickets',(select coalesce(sum(bi.quantity),0) from public.booking_items bi join public.bookings b on b.id=bi.booking_id where b.event_id=e.id and b.status='rejected')
    ),
    'financials',coalesce((
      select jsonb_agg(jsonb_build_object(
        'currency',x.currency,'sales',x.sales,
        'platform_fee',round(x.sales*coalesce(e.platform_fee_percent,0)/100,2),
        'advertiser_net',x.sales-round(x.sales*coalesce(e.platform_fee_percent,0)/100,2)
      ) order by x.currency)
      from (
        select b.currency,sum(b.subtotal)::numeric as sales
        from public.bookings b where b.event_id=e.id and b.status='confirmed'
        group by b.currency
      ) x
    ),'[]'::jsonb),
    'ticket_types',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',tt.id,'name',tt.name,'price',tt.price,'currency',tt.currency,
        'quantity_total',tt.quantity_total,
        'confirmed_quantity',coalesce(s.confirmed_quantity,0),
        'reserved_quantity',coalesce(s.reserved_quantity,0),
        'rejected_quantity',coalesce(s.rejected_quantity,0),
        'remaining_quantity',greatest(0,tt.quantity_total-coalesce(tt.quantity_sold,0)),
        'sales',coalesce(s.sales,0)
      ) order by tt.created_at)
      from public.ticket_types tt
      left join lateral (
        select
          sum(bi.quantity) filter(where b.status='confirmed')::integer as confirmed_quantity,
          sum(bi.quantity) filter(where b.status in ('pending_payment','under_review'))::integer as reserved_quantity,
          sum(bi.quantity) filter(where b.status='rejected')::integer as rejected_quantity,
          sum(bi.line_total) filter(where b.status='confirmed')::numeric as sales
        from public.booking_items bi
        join public.bookings b on b.id=bi.booking_id
        where bi.ticket_type_id=tt.id and b.event_id=e.id
      ) s on true
      where tt.event_id=e.id
    ),'[]'::jsonb)
  ) into v_result
  from public.events e
  where e.id=v_event_id;

  return v_result;
end;
$$;

revoke all on function private.get_advertiser_event_statistics() from public,anon;
grant execute on function private.get_advertiser_event_statistics() to authenticated;

notify pgrst,'reload schema';
