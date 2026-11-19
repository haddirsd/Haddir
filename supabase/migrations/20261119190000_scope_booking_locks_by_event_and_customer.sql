-- Replace the cross-platform advisory mutex with ordered row-level locks.
-- Lock order:
--   event SHARE -> customer profile(s) -> payment/booking rows -> ticket type rows.
-- Event deletion/completion takes an event UPDATE lock and therefore waits for active
-- booking/payment operations without blocking independent events.

do $migration$
declare
  v_function oid;
  v_definition text;
begin
  for v_function in
    select p.oid
    from pg_catalog.pg_proc p
    where p.prosrc like '%748231905441%'
    order by p.oid
  loop
    v_definition := pg_catalog.pg_get_functiondef(v_function);
    v_definition := replace(
      v_definition,
      'perform pg_catalog.pg_advisory_xact_lock(748231905441::bigint);',
      ''
    );
    v_definition := replace(
      v_definition,
      'perform pg_advisory_xact_lock(748231905441::bigint);',
      ''
    );

    if position('748231905441' in v_definition) > 0 then
      raise exception 'Could not safely remove the legacy global lock from function OID %', v_function;
    end if;

    execute v_definition;
  end loop;
end;
$migration$;

create or replace function public.create_booking(
  p_event_id uuid,
  p_ticket_type_id uuid,
  p_quantity integer
)
returns table(
  booking_id uuid,
  booking_number text,
  subtotal numeric,
  currency character
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_ticket public.ticket_types%rowtype;
  v_event public.events%rowtype;
  v_profile public.profiles%rowtype;
  v_email text;
  v_booking_id uuid;
  v_booking_number text;
  v_total numeric;
  v_expired_quantity integer := 0;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول لإتمام الحجز';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 5 then
    raise exception 'عدد التذاكر يجب أن يكون بين 1 و5';
  end if;

  -- Shared event lock: independent events do not block each other.
  -- Event completion/deletion requires a conflicting row lock.
  select *
    into v_event
  from public.events
  where id = p_event_id
  for share;

  if not found
     or v_event.status <> 'published'
     or (
       not coalesce(v_event.is_continuous, false)
       and (
         v_event.starts_at is null
         or coalesce(v_event.ends_at, v_event.starts_at) <= now()
       )
     ) then
    raise exception 'الفعالية غير متاحة للحجز';
  end if;

  -- Lock all affected customers in UUID order before touching booking rows.
  -- This also serializes account deletion with booking creation and expiry cleanup.
  perform 1
  from public.profiles p
  where p.id = v_user_id
     or p.id in (
       select b.user_id
       from public.bookings b
       where b.event_id = p_event_id
         and b.status = 'pending_payment'
         and b.expires_at is not null
         and b.expires_at <= now()
         and exists (
           select 1
           from public.booking_items bi
           where bi.booking_id = b.id
             and bi.ticket_type_id = p_ticket_type_id
         )
     )
  order by p.id
  for update;

  -- Expire matching bookings only after customer locks; lock bookings before inventory.
  with expired_candidates as materialized (
    select b.id
    from public.bookings b
    where b.event_id = p_event_id
      and b.status = 'pending_payment'
      and b.expires_at is not null
      and b.expires_at <= now()
      and exists (
        select 1
        from public.booking_items bi
        where bi.booking_id = b.id
          and bi.ticket_type_id = p_ticket_type_id
      )
    order by b.id
    for update
  ),
  expired as (
    update public.bookings b
       set status = 'expired',
           updated_at = now()
      from expired_candidates c
     where b.id = c.id
       and b.status = 'pending_payment'
    returning b.id
  )
  select coalesce(sum(bi.quantity), 0)::integer
    into v_expired_quantity
  from public.booking_items bi
  join expired e on e.id = bi.booking_id
  where bi.ticket_type_id = p_ticket_type_id;

  if v_expired_quantity > 0 then
    update public.ticket_types
       set quantity_sold = greatest(0, quantity_sold - v_expired_quantity),
           updated_at = now()
     where id = p_ticket_type_id
       and event_id = p_event_id;
  end if;

  -- Inventory row is locked after expired booking rows, matching the expiry worker.
  select *
    into v_ticket
  from public.ticket_types
  where id = p_ticket_type_id
    and event_id = p_event_id
  for update;

  if not found or not v_ticket.is_active then
    raise exception 'فئة التذكرة غير متاحة';
  end if;

  if (v_ticket.sales_start_at is not null and now() < v_ticket.sales_start_at)
     or (v_ticket.sales_end_at is not null and now() > v_ticket.sales_end_at) then
    raise exception 'فترة بيع هذه التذكرة غير متاحة حالياً';
  end if;

  select *
    into v_profile
  from public.profiles
  where id = v_user_id;

  select email
    into v_email
  from auth.users
  where id = v_user_id;

  if coalesce(nullif(trim(v_profile.full_name), ''), '') = ''
     or coalesce(nullif(trim(v_profile.phone), ''), '') = '' then
    raise exception 'أكمل اسمك ورقم هاتفك في الملف الشخصي قبل الحجز';
  end if;

  if v_ticket.quantity_total is not null
     and v_ticket.quantity_sold + p_quantity > v_ticket.quantity_total then
    raise exception 'الكمية المطلوبة غير متوفرة. المتاح حالياً: %',
      greatest(0, v_ticket.quantity_total - v_ticket.quantity_sold);
  end if;

  v_total := v_ticket.price * p_quantity;
  v_booking_id := gen_random_uuid();
  v_booking_number := 'HDR-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.bookings(
    id, booking_number, user_id, customer_name, customer_email, customer_phone,
    event_id, subtotal, currency, status, expires_at
  ) values (
    v_booking_id, v_booking_number, v_user_id, v_profile.full_name, v_email,
    v_profile.phone, p_event_id, v_total, v_ticket.currency, 'pending_payment',
    now() + interval '20 minutes'
  );

  insert into public.booking_items(
    booking_id, ticket_type_id, quantity, unit_price, line_total
  )
  values (
    v_booking_id, p_ticket_type_id, p_quantity, v_ticket.price, v_total
  );

  update public.ticket_types
     set quantity_sold = quantity_sold + p_quantity,
         updated_at = now()
   where id = p_ticket_type_id;

  return query
  select v_booking_id, v_booking_number, v_total, v_ticket.currency;
end;
$function$;

create or replace function public.submit_payment(
  p_booking_id uuid,
  p_payment_method_id text,
  p_receipt_path text,
  p_transfer_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_event_id uuid;
  v_locked_event_id uuid;
  v_booking public.bookings%rowtype;
  v_submission uuid;
  v_account_name text;
  v_account_number text;
  v_account_beneficiary text;
begin
  if v_user is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  if p_booking_id is null or p_payment_method_id is null or btrim(p_payment_method_id) = '' then
    raise exception 'اختر حساب الدفع الخاص بهذه الفعالية';
  end if;

  if p_receipt_path is null
     or p_receipt_path !~ ('^' || v_user::text || '/' || p_booking_id::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'مسار الإيصال غير صالح';
  end if;

  -- Read the event key first, then acquire locks in the common order.
  select b.event_id
    into v_event_id
  from public.bookings b
  where b.id = p_booking_id
    and b.user_id = v_user;

  if not found then
    raise exception 'الحجز غير موجود';
  end if;

  select e.id
    into v_locked_event_id
  from public.events e
  where e.id = v_event_id
  for share;

  if not found then
    raise exception 'الفعالية غير موجودة';
  end if;

  perform 1
  from public.profiles p
  where p.id = v_user
  for update;

  select *
    into v_booking
  from public.bookings
  where id = p_booking_id
    and user_id = v_user
    and event_id = v_event_id
  for update;

  if not found then
    raise exception 'الحجز غير موجود';
  end if;

  select epa.account_name, epa.account_number, epa.beneficiary
    into v_account_name, v_account_number, v_account_beneficiary
  from public.event_payment_accounts epa
  where epa.id = p_payment_method_id
    and epa.event_id = v_booking.event_id
    and epa.is_active = true;

  if not found or v_account_name is null or v_account_number is null then
    raise exception 'حساب الدفع غير متاح لهذه الفعالية';
  end if;

  if v_booking.status <> 'pending_payment'
     or v_booking.expires_at is null
     or v_booking.expires_at <= now() then
    raise exception 'انتهت مهلة الحجز أو تم إرسال إثبات دفع مسبقاً';
  end if;

  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id = 'payment-receipts'
      and so.name = p_receipt_path
  ) then
    raise exception 'لم يتم العثور على الإيصال المرفوع';
  end if;

  insert into public.payment_submissions (
    booking_id, submitted_by, transfer_reference, receipt_path,
    amount, currency, status, payment_account_id,
    payment_account_name, payment_account_number, payment_account_beneficiary
  )
  values (
    p_booking_id, v_user, nullif(btrim(p_transfer_reference), ''),
    p_receipt_path, v_booking.subtotal, v_booking.currency, 'submitted',
    p_payment_method_id, v_account_name, v_account_number, v_account_beneficiary
  )
  returning id into v_submission;

  update public.bookings
     set status = 'under_review',
         updated_at = now()
   where id = p_booking_id;

  return v_submission;
end;
$function$;

create or replace function public.review_payment_submission(
  p_submission_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_event_id uuid;
  v_user_id uuid;
  v_locked_event_id uuid;
  v_payment public.payment_submissions%rowtype;
  v_booking public.bookings%rowtype;
  v_item record;
  v_ticket_code text;
  v_ticket_count integer := 0;
  v_attendee_count integer := 0;
begin
  v_role := private.current_profile_role();

  if coalesce(v_role, '') not in ('owner', 'admin', 'supervisor') then
    raise exception 'غير مصرح لك بمراجعة المدفوعات';
  end if;

  if p_decision is null or p_decision not in ('approve', 'reject') then
    raise exception 'قرار المراجعة غير صحيح';
  end if;

  if p_decision = 'reject'
     and nullif(trim(coalesce(p_rejection_reason, '')), '') is null then
    raise exception 'اكتب سبب رفض إثبات الدفع';
  end if;

  -- Discover immutable routing keys without row locks, then lock event/customer first.
  select b.event_id, b.user_id
    into v_event_id, v_user_id
  from public.payment_submissions ps
  join public.bookings b on b.id = ps.booking_id
  where ps.id = p_submission_id;

  if not found then
    raise exception 'إثبات الدفع أو الحجز غير موجود';
  end if;

  if v_user_id is null then
    raise exception 'الحجز غير مرتبط بحساب مستخدم';
  end if;

  select e.id
    into v_locked_event_id
  from public.events e
  where e.id = v_event_id
  for share;

  if not found then
    raise exception 'الفعالية غير موجودة';
  end if;

  perform 1
  from public.profiles p
  where p.id = v_user_id
  for update;

  select *
    into v_payment
  from public.payment_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'إثبات الدفع غير موجود';
  end if;

  if v_payment.status <> 'submitted' then
    raise exception 'تمت مراجعة إثبات الدفع مسبقاً';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = v_payment.booking_id
  for update;

  if not found then
    raise exception 'الحجز غير موجود';
  end if;

  if v_booking.user_id is distinct from v_user_id
     or v_booking.event_id is distinct from v_event_id then
    raise exception 'تغير ارتباط الحجز أثناء المراجعة؛ أعد المحاولة';
  end if;

  if v_role = 'supervisor' and not exists (
    select 1
    from public.event_role_assignments a
    where a.user_id = auth.uid()
      and a.event_id = v_booking.event_id
      and a.assignment_role = 'supervisor'
  ) then
    raise exception 'لا تملك تكليفاً لمراجعة حجوزات هذه الفعالية';
  end if;

  if p_decision = 'approve' then
    select coalesce(sum(bi.quantity), 0)::integer
      into v_attendee_count
    from public.booking_items bi
    where bi.booking_id = v_booking.id;

    for v_item in
      select bi.*, tt.name as ticket_name
      from public.booking_items bi
      join public.ticket_types tt on tt.id = bi.ticket_type_id
      where bi.booking_id = v_booking.id
      order by bi.ticket_type_id, bi.id
    loop
      loop
        v_ticket_code := lpad(floor(random() * 10000000000)::bigint::text, 10, '0');
        exit when not exists (
          select 1 from public.tickets where ticket_code = v_ticket_code
        );
      end loop;

      insert into public.tickets(
        booking_item_id, booking_id, event_id, ticket_type_id,
        ticket_code, attendee_name, status
      )
      values (
        v_item.id, v_booking.id, v_booking.event_id, v_item.ticket_type_id,
        v_ticket_code, v_booking.customer_name, 'valid'
      );

      v_ticket_count := v_ticket_count + 1;
    end loop;

    update public.payment_submissions
       set status = 'approved',
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           review_note = null
     where id = v_payment.id;

    update public.bookings
       set status = 'confirmed',
           expires_at = null,
           updated_at = now()
     where id = v_booking.id;

    insert into public.notifications(user_id, booking_id, title, message, type)
    values (
      v_booking.user_id,
      v_booking.id,
      'تم قبول حجزك وإصدار تذكرتك',
      'تم اعتماد الدفع لحجزك رقم ' || v_booking.booking_number ||
      '. أُصدرت ' || v_ticket_count || ' تذكرة تشمل ' || v_attendee_count ||
      ' من الأشخاص، ويمكنك مشاهدة كود الدخول في قسم تذاكري.',
      'ticket_approved'
    );
  else
    update public.payment_submissions
       set status = 'rejected',
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           review_note = trim(p_rejection_reason)
     where id = v_payment.id;

    for v_item in
      select ticket_type_id, quantity
      from public.booking_items
      where booking_id = v_booking.id
      order by ticket_type_id
    loop
      update public.ticket_types
         set quantity_sold = greatest(0, quantity_sold - v_item.quantity),
             updated_at = now()
       where id = v_item.ticket_type_id;
    end loop;

    update public.bookings
       set status = 'rejected',
           updated_at = now()
     where id = v_booking.id;

    insert into public.notifications(user_id, booking_id, title, message, type)
    values (
      v_booking.user_id,
      v_booking.id,
      'تعذر قبول إثبات الدفع',
      'تم رفض إثبات الدفع للحجز رقم ' || v_booking.booking_number ||
      '. السبب: ' || trim(p_rejection_reason),
      'payment_rejected'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'decision', p_decision,
    'tickets_created', v_ticket_count,
    'attendee_count', v_attendee_count,
    'booking_id', v_booking.id
  );
end;
$function$;

create or replace function private.expire_pending_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_ids uuid[];
  v_booking_ids uuid[];
  v_booking record;
  v_item record;
  v_expired_count integer := 0;
begin
  -- Lock every affected event in UUID order; SHARE locks remain compatible
  -- with bookings for those events and conflict with completion/deletion.
  select coalesce(array_agg(x.event_id order by x.event_id), array[]::uuid[])
    into v_event_ids
  from (
    select distinct b.event_id
    from public.bookings b
    where b.status = 'pending_payment'
      and b.expires_at is not null
      and b.expires_at <= now()
  ) x;

  if cardinality(v_event_ids) = 0 then
    return 0;
  end if;

  perform 1
  from public.events e
  where e.id = any(v_event_ids)
  order by e.id
  for share;

  -- Lock affected customer profiles in a global deterministic order.
  perform 1
  from public.profiles p
  where p.id in (
    select distinct b.user_id
    from public.bookings b
    where b.event_id = any(v_event_ids)
      and b.status = 'pending_payment'
      and b.expires_at is not null
      and b.expires_at <= now()
      and b.user_id is not null
  )
  order by p.id
  for update;

  -- Claim booking rows only after profiles; SKIP LOCKED keeps overlapping workers safe.
  select coalesce(array_agg(locked.id order by locked.id), array[]::uuid[])
    into v_booking_ids
  from (
    select b.id
    from public.bookings b
    where b.event_id = any(v_event_ids)
      and b.status = 'pending_payment'
      and b.expires_at is not null
      and b.expires_at <= now()
    order by b.id
    for update skip locked
  ) locked;

  if cardinality(v_booking_ids) = 0 then
    return 0;
  end if;

  -- Lock all affected inventory rows in UUID order before changing any of them.
  perform 1
  from public.ticket_types tt
  where tt.id in (
    select distinct bi.ticket_type_id
    from public.booking_items bi
    where bi.booking_id = any(v_booking_ids)
  )
  order by tt.id
  for update;

  for v_booking in
    select b.id, b.user_id, b.booking_number
    from public.bookings b
    where b.id = any(v_booking_ids)
    order by b.id
  loop
    update public.bookings
       set status = 'expired',
           updated_at = now()
     where id = v_booking.id
       and status = 'pending_payment';

    if not found then
      continue;
    end if;

    for v_item in
      select bi.ticket_type_id, bi.quantity
      from public.booking_items bi
      where bi.booking_id = v_booking.id
      order by bi.ticket_type_id
    loop
      update public.ticket_types
         set quantity_sold = greatest(0, quantity_sold - v_item.quantity),
             updated_at = now()
       where id = v_item.ticket_type_id;
    end loop;

    if v_booking.user_id is not null then
      insert into public.notifications(user_id, booking_id, title, message, type)
      values (
        v_booking.user_id,
        v_booking.id,
        'انتهت مهلة الحجز',
        'انتهت مهلة الدفع للحجز رقم ' || v_booking.booking_number ||
        ' وتم تحرير كمية التذاكر المحجوزة. يمكنك إنشاء حجز جديد إذا كانت التذاكر لا تزال متاحة.',
        'booking_expired'
      );
    end if;

    v_expired_count := v_expired_count + 1;
  end loop;

  return v_expired_count;
end;
$function$;

create or replace function private.guard_customer_account_deletion_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_user_id uuid;
  v_new_user_id uuid;
  v_old_booking_id uuid;
  v_new_booking_id uuid;
  v_old_submitter uuid;
  v_new_submitter uuid;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  if tg_table_name = 'bookings' then
    if tg_op <> 'INSERT' then
      v_old_user_id := old.user_id;
    end if;

    if tg_op <> 'DELETE' then
      v_new_user_id := new.user_id;
    end if;

    -- Deterministic customer lock order also covers ownership changes.
    perform 1
    from public.profiles p
    where p.id in (v_old_user_id, v_new_user_id)
    order by p.id
    for update;

    if tg_op <> 'INSERT' then
      if v_old_user_id is not null and exists (
        select 1
        from private.customer_account_deletion_cleanup q
        where q.user_id = v_old_user_id
      ) then
        raise exception 'الحساب قيد الحذف ولا يمكن تعديل الحجوزات';
      end if;
    end if;

    if tg_op <> 'DELETE' then
      if v_new_user_id is not null and exists (
        select 1
        from private.customer_account_deletion_cleanup q
        where q.user_id = v_new_user_id
      ) then
        raise exception 'الحساب قيد الحذف ولا يمكن إنشاء حجوزات جديدة';
      end if;
    end if;
  else
    if tg_op <> 'INSERT' then
      v_old_booking_id := old.booking_id;
      v_old_submitter := old.submitted_by;
    end if;

    if tg_op <> 'DELETE' then
      v_new_booking_id := new.booking_id;
      v_new_submitter := new.submitted_by;
    end if;

    -- Payment writes lock both submitter and booking owner, sorted by profile UUID.
    perform 1
    from public.profiles p
    where p.id in (v_old_submitter, v_new_submitter)
       or p.id in (
         select b.user_id
         from public.bookings b
         where b.id in (v_old_booking_id, v_new_booking_id)
       )
    order by p.id
    for update;

    if tg_op <> 'INSERT' then
      if v_old_submitter is not null and exists (
        select 1
        from private.customer_account_deletion_cleanup q
        where q.user_id = v_old_submitter
      ) then
        raise exception 'الحساب قيد الحذف ولا يمكن تعديل إثباتات الدفع';
      end if;

      if exists (
        select 1
        from public.bookings b
        join private.customer_account_deletion_cleanup q on q.user_id = b.user_id
        where b.id = v_old_booking_id
      ) then
        raise exception 'الحساب قيد الحذف ولا يمكن تعديل إثباتات الدفع';
      end if;
    end if;

    if tg_op <> 'DELETE' then
      if v_new_submitter is not null and exists (
        select 1
        from private.customer_account_deletion_cleanup q
        where q.user_id = v_new_submitter
      ) then
        raise exception 'الحساب قيد الحذف ولا يمكن إرسال إثباتات دفع جديدة';
      end if;

      if exists (
        select 1
        from public.bookings b
        join private.customer_account_deletion_cleanup q on q.user_id = b.user_id
        where b.id = v_new_booking_id
      ) then
        raise exception 'الحساب قيد الحذف ولا يمكن إرسال إثباتات دفع جديدة';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$function$;

notify pgrst, 'reload schema';
