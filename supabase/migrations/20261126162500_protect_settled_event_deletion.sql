-- Protect settled event deletion with an immutable recent-activity window.
-- Based on the live production definition after the 20261119172147 migration
-- removed its legacy global advisory lock. No lock or ACL changes are introduced.

create or replace function public.prepare_settled_event_deletion(
  p_event_id uuid,
  p_settlement_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_event public.events%rowtype;
  v_receipt_paths text[] := '{}'::text[];
  v_cover_paths text[] := '{}'::text[];
  v_activity_cutoff timestamptz;
begin
  v_role := private.current_profile_role();
  if coalesce(v_role,'') not in ('owner','admin') then
    raise exception 'حذف الفعاليات متاح للمالك أو المدير فقط';
  end if;
  if p_settlement_confirmed is distinct from true then
    raise exception 'يجب تأكيد إتمام محاسبة صاحب الفعالية أولاً';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'الفعالية غير موجودة أو سبق حذفها';
  end if;

  v_activity_cutoff := now() - interval '7 days';

  if v_event.ends_at is null then
    raise exception 'لا يمكن حذف الفعالية: تاريخ نهاية الفعالية غير محدد. حدّد تاريخ النهاية أولاً';
  end if;

  if v_event.ends_at > v_activity_cutoff then
    raise exception 'لا يمكن حذف الفعالية قبل % بتوقيت السودان',
      to_char(
        (v_event.ends_at + interval '7 days') at time zone 'Africa/Khartoum',
        'DD/MM/YYYY HH24:MI'
      );
  end if;

  if exists (
    select 1 from public.bookings b
    where b.event_id = p_event_id
      and b.created_at > v_activity_cutoff
  ) or exists (
    select 1
    from public.payment_submissions ps
    join public.bookings b on b.id = ps.booking_id
    where b.event_id = p_event_id
      and (ps.created_at > v_activity_cutoff or ps.reviewed_at > v_activity_cutoff)
  ) or exists (
    select 1 from public.checkins ci
    where ci.event_id = p_event_id
      and ci.checked_in_at > v_activity_cutoff
  ) then
    raise exception 'لا يمكن حذف الفعالية: يوجد نشاط خلال آخر 7 أيام (حجز أو رفع/مراجعة إثبات دفع أو تسجيل دخول). انتظر مرور 7 أيام كاملة بعد آخر نشاط ثم أعد المحاولة';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.event_id = p_event_id
      and b.status in ('pending_payment','under_review')
  ) or exists (
    select 1
    from public.payment_submissions ps
    join public.bookings b on b.id = ps.booking_id
    where b.event_id = p_event_id
      and ps.status not in ('approved','rejected')
  ) then
    raise exception 'لا يمكن الحذف: توجد حجوزات أو إثباتات دفع قيد الانتظار أو المراجعة';
  end if;

  -- One aggregate row per currency; no customer, booking, ticket-code or receipt data is retained.
  with currencies as (
    select distinct tt.currency
    from public.ticket_types tt
    where tt.event_id = p_event_id
    union
    select 'SDG'::character(3)
    where not exists (select 1 from public.ticket_types tt where tt.event_id = p_event_id)
  ),
  paid as (
    select tt.currency,
           count(distinct b.id)::integer as booking_count,
           coalesce(sum(case when b.id is not null then bi.quantity else 0 end),0)::integer as ticket_count,
           coalesce(sum(case when b.id is not null then bi.line_total else 0 end),0)::numeric(14,2) as gross_amount
    from public.ticket_types tt
    left join public.booking_items bi on bi.ticket_type_id = tt.id
    left join public.bookings b on b.id = bi.booking_id
      and b.event_id = p_event_id and b.status = 'confirmed'
    where tt.event_id = p_event_id
    group by tt.currency
  ),
  used as (
    select tt.currency, count(ci.id)::integer as checkin_count
    from public.tickets t
    join public.ticket_types tt on tt.id = t.ticket_type_id
    left join public.checkins ci on ci.ticket_id = t.id
    where t.event_id = p_event_id
    group by tt.currency
  )
  insert into public.event_lifetime_stats (
    event_id,event_month,event_year,currency,booking_count,ticket_count,
    checkin_count,gross_amount,platform_fee_amount,organizer_net_amount
  )
  select v_event.id,
         date_trunc('month', coalesce(v_event.starts_at,v_event.created_at))::date,
         extract(year from coalesce(v_event.starts_at,v_event.created_at))::integer,
         c.currency,
         coalesce(p.booking_count,0),
         coalesce(p.ticket_count,0),
         coalesce(u.checkin_count,0),
         coalesce(p.gross_amount,0),
         round(coalesce(p.gross_amount,0) * coalesce(v_event.platform_fee_percent,0) / 100, 2),
         coalesce(p.gross_amount,0) - round(coalesce(p.gross_amount,0) * coalesce(v_event.platform_fee_percent,0) / 100, 2)
  from currencies c
  left join paid p on p.currency = c.currency
  left join used u on u.currency = c.currency
  on conflict (event_id,currency) do nothing;

  select coalesce(array_agg(distinct o.name), '{}'::text[])
    into v_receipt_paths
    from storage.objects o
   where o.bucket_id = 'payment-receipts'
     and (storage.foldername(o.name))[2] in (
       select b.id::text from public.bookings b where b.event_id = p_event_id
     );

  select coalesce(array_agg(distinct o.name), '{}'::text[])
    into v_cover_paths
    from storage.objects o
   where o.bucket_id = 'event-covers'
     and v_event.cover_image_url like '%' || o.name;

  return jsonb_build_object(
    'event_id', p_event_id,
    'receipt_paths', to_jsonb(v_receipt_paths),
    'cover_paths', to_jsonb(v_cover_paths),
    'statistics_preserved', true
  );
end;
$$;
