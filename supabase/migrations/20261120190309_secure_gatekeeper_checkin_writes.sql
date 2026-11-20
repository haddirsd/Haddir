-- Keep check-in records inside the trusted gatekeeper confirmation path.
-- Direct table inserts are not an authorized way to validate attendance.

-- Restore historical check-ins only where the scan ledger proves an accepted
-- scan and the scanned ticket still belongs to the same event.
insert into public.checkins (ticket_id, event_id, checked_in_by, checked_in_at)
select distinct on (l.ticket_id)
  l.ticket_id,
  l.event_id,
  l.gatekeeper_user_id,
  l.scanned_at
from public.gatekeeper_scan_logs l
join public.tickets t
  on t.id = l.ticket_id
 and t.event_id = l.event_id
 and t.status = 'used'
where l.outcome = 'accepted'
  and l.ticket_id is not null
order by l.ticket_id, l.scanned_at asc, l.id asc
on conflict (ticket_id) do nothing;

-- A gatekeeper may not create check-ins directly, even for their assigned
-- event. The trusted SECURITY DEFINER scanner writes this row after it
-- atomically changes a valid ticket to used.
drop policy if exists "Gatekeepers record checkins" on public.checkins;
drop policy if exists "Gatekeepers record assigned event checkins" on public.checkins;
revoke insert on table public.checkins from public, anon, authenticated;

-- Keep the existing ticket validation, role check, event assignment check,
-- atomic valid -> used transition, and customer notification. Add the
-- canonical check-in record to the same transaction.
create or replace function private.gatekeeper_ticket_action_core(
  p_ticket_code text,
  p_confirm boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_ticket public.tickets%rowtype;
  v_event_title text;
  v_event_venue text;
  v_event_starts_at timestamptz;
  v_type_name text;
  v_buyer_name text;
  v_attendee_count integer;
  v_booking_user_id uuid;
  v_assignment_exists boolean;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_uid;

  if coalesce(v_role, '') not in ('gatekeeper', 'organizer') then
    raise exception 'هذه الخدمة مخصصة للبواب فقط';
  end if;

  if nullif(btrim(p_ticket_code), '') is null then
    raise exception 'أدخل كود التذكرة';
  end if;

  select t.* into v_ticket
  from public.tickets t
  where upper(t.ticket_code) = upper(btrim(p_ticket_code))
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'status', 'not_found',
      'message', 'هذا الكود غير صادر من نظام حاضر'
    );
  end if;

  select exists (
    select 1
    from public.event_role_assignments a
    where a.user_id = v_uid
      and a.event_id = v_ticket.event_id
      and a.assignment_role in ('gatekeeper', 'organizer')
  ) into v_assignment_exists;

  if not v_assignment_exists then
    raise exception 'هذه التذكرة لا تخص الفعالية المصرح لك بها';
  end if;

  select
    e.title,
    e.venue,
    e.starts_at,
    tt.name,
    coalesce(nullif(b.customer_name, ''), nullif(v_ticket.attendee_name, '')),
    bi.quantity,
    b.user_id
  into
    v_event_title,
    v_event_venue,
    v_event_starts_at,
    v_type_name,
    v_buyer_name,
    v_attendee_count,
    v_booking_user_id
  from public.events e
  left join public.ticket_types tt on tt.id = v_ticket.ticket_type_id
  left join public.bookings b on b.id = v_ticket.booking_id
  left join public.booking_items bi on bi.id = v_ticket.booking_item_id
  where e.id = v_ticket.event_id;

  if v_ticket.status = 'used' then
    return jsonb_build_object(
      'ok', false,
      'status', 'used',
      'message', 'تم استخدام هذه التذكرة مسبقاً',
      'ticket_id', v_ticket.id,
      'ticket_code', v_ticket.ticket_code,
      'attendee_name', v_ticket.attendee_name,
      'buyer_name', v_buyer_name,
      'attendee_count', v_attendee_count,
      'event_title', v_event_title,
      'venue', v_event_venue,
      'starts_at', v_event_starts_at,
      'ticket_type', v_type_name,
      'used_at', v_ticket.used_at
    );
  end if;

  if v_ticket.status <> 'valid' then
    return jsonb_build_object(
      'ok', false,
      'status', 'invalid',
      'message', 'هذه التذكرة موجودة في النظام لكنها غير صالحة للدخول',
      'ticket_id', v_ticket.id,
      'ticket_code', v_ticket.ticket_code,
      'attendee_name', v_ticket.attendee_name,
      'buyer_name', v_buyer_name,
      'attendee_count', v_attendee_count,
      'event_title', v_event_title,
      'venue', v_event_venue,
      'starts_at', v_event_starts_at,
      'ticket_type', v_type_name
    );
  end if;

  if p_confirm then
    update public.tickets t
       set status = 'used',
           used_at = now()
     where t.id = v_ticket.id
       and t.status = 'valid'
    returning t.* into v_ticket;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'status', 'used',
        'message', 'تم استخدام التذكرة بالفعل'
      );
    end if;

    insert into public.checkins (
      ticket_id,
      event_id,
      checked_in_by
    )
    values (
      v_ticket.id,
      v_ticket.event_id,
      v_uid
    )
    on conflict (ticket_id) do nothing;

    if v_booking_user_id is not null then
      insert into public.notifications (
        user_id,
        title,
        message,
        type,
        is_read,
        booking_id
      )
      values (
        v_booking_user_id,
        'مرحباً بك في الفعالية 🎉',
        'نتمنى لك لحظات سعيدة وتجربة ممتعة مع حاضر.',
        'ticket_checked_in',
        false,
        v_ticket.booking_id
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'status', 'checked_in',
      'message', 'تم تأكيد دخول حامل التذكرة بنجاح',
      'ticket_id', v_ticket.id,
      'ticket_code', v_ticket.ticket_code,
      'attendee_name', v_ticket.attendee_name,
      'buyer_name', v_buyer_name,
      'attendee_count', v_attendee_count,
      'event_title', v_event_title,
      'venue', v_event_venue,
      'starts_at', v_event_starts_at,
      'ticket_type', v_type_name,
      'used_at', v_ticket.used_at
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'valid',
    'message', 'التذكرة صالحة ويمكن تأكيد الدخول',
    'ticket_id', v_ticket.id,
    'ticket_code', v_ticket.ticket_code,
    'attendee_name', v_ticket.attendee_name,
    'buyer_name', v_buyer_name,
    'attendee_count', v_attendee_count,
    'event_title', v_event_title,
    'venue', v_event_venue,
    'starts_at', v_event_starts_at,
    'ticket_type', v_type_name
  );
end;
$function$;

-- The helper is callable only through the authenticated QR/manual wrappers.
revoke all on function private.gatekeeper_ticket_action_core(text, boolean)
from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
