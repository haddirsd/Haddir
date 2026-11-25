-- Refuse payment approval unless the booking has ticket items and ticket issuance succeeds.
-- Function body is based verbatim on the live production definition read on 2026-11-26.
-- CREATE OR REPLACE preserves the existing function owner and ACL; no GRANT/REVOKE changes.

CREATE OR REPLACE FUNCTION public.review_payment_submission(p_submission_id uuid, p_decision text, p_rejection_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  for key share;

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

  if v_booking.status is distinct from 'under_review' then
    raise exception 'حالة الحجز لا تسمح بمراجعة إثبات الدفع';
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
    if not exists (
      select 1
      from public.booking_items bi
      where bi.booking_id = v_booking.id
    ) then
      raise exception 'لا يمكن اعتماد حجز بدون عناصر تذاكر';
    end if;

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

    if v_ticket_count = 0 then
      raise exception 'تعذر إصدار أي تذكرة لهذا الحجز';
    end if;

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
$function$

