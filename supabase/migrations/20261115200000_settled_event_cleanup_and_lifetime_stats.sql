-- Preserve aggregate event performance and securely remove settled event operations.
create table if not exists public.event_lifetime_stats (
  event_id uuid not null,
  event_month date not null,
  event_year integer not null,
  currency character(3) not null default 'SDG',
  booking_count integer not null default 0,
  ticket_count integer not null default 0,
  checkin_count integer not null default 0,
  gross_amount numeric(14,2) not null default 0,
  platform_fee_amount numeric(14,2) not null default 0,
  organizer_net_amount numeric(14,2) not null default 0,
  archived_at timestamptz not null default now(),
  primary key (event_id, currency)
);

alter table public.event_lifetime_stats enable row level security;
drop policy if exists "Owners read event lifetime statistics" on public.event_lifetime_stats;
create policy "Owners read event lifetime statistics"
on public.event_lifetime_stats for select to authenticated
using (private.current_profile_role() in ('owner','admin'));
grant select on public.event_lifetime_stats to authenticated;
revoke insert, update, delete on public.event_lifetime_stats from anon, authenticated;

-- Allow admins to remove only receipt/cover objects that are still linked to an event.
drop policy if exists "Owners and admins delete settled event receipts" on storage.objects;
create policy "Owners and admins delete settled event receipts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'payment-receipts'
  and private.current_profile_role() in ('owner','admin')
  and exists (
    select 1
    from public.bookings b
    where b.id::text = (storage.foldername(name))[2]
  )
);
drop policy if exists "Owners and admins delete linked event covers" on storage.objects;
create policy "Owners and admins delete linked event covers"
on storage.objects for delete to authenticated
using (
  bucket_id = 'event-covers'
  and private.current_profile_role() in ('owner','admin')
  and exists (
    select 1 from public.events e
    where e.cover_image_url like '%' || storage.objects.name
  )
);

create or replace function private.guard_event_booking_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_status text;
  v_event_end timestamptz;
begin
  select e.status, e.ends_at
    into v_event_status, v_event_end
    from public.events e
   where e.id = new.event_id;

  if not found or v_event_status <> 'published' then
    raise exception 'الفعالية غير متاحة للحجز';
  end if;

  if v_event_end is not null and v_event_end <= now() then
    raise exception 'انتهى وقت الفعالية وتوقف بيع التذاكر';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_event_booking_window on public.bookings;
create trigger guard_event_booking_window
before insert on public.bookings
for each row execute function private.guard_event_booking_window();

create or replace function public.admin_complete_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  v_role := private.current_profile_role();
  if coalesce(v_role,'') not in ('owner','admin') then
    raise exception 'غير مصرح لك بإنهاء الفعالية';
  end if;

  update public.events
     set status = 'completed',
         is_trending = false,
         updated_at = now()
   where id = p_event_id;

  if not found then
    raise exception 'الفعالية غير موجودة';
  end if;

  update public.ticket_types
     set is_active = false,
         updated_at = now()
   where event_id = p_event_id;

  return jsonb_build_object('success', true, 'event_id', p_event_id, 'status', 'completed');
end;
$$;
revoke all on function public.admin_complete_event(uuid) from public, anon;
grant execute on function public.admin_complete_event(uuid) to authenticated;

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
begin
  v_role := private.current_profile_role();
  if coalesce(v_role,'') not in ('owner','admin') then
    raise exception 'حذف الفعاليات متاح للمالك أو المدير فقط';
  end if;
  if p_settlement_confirmed is distinct from true then
    raise exception 'يجب تأكيد إتمام محاسبة صاحب الفعالية أولاً';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(748231905441::bigint);
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'الفعالية غير موجودة أو سبق حذفها';
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
           coalesce(sum(bi.quantity),0)::integer as ticket_count,
           coalesce(sum(bi.line_total),0)::numeric(14,2) as gross_amount
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

  select coalesce(array_agg(distinct ps.receipt_path), '{}'::text[])
    into v_receipt_paths
    from public.payment_submissions ps
    join public.bookings b on b.id = ps.booking_id
   where b.event_id = p_event_id and ps.receipt_path is not null;

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
revoke all on function public.prepare_settled_event_deletion(uuid,boolean) from public, anon;
grant execute on function public.prepare_settled_event_deletion(uuid,boolean) to authenticated;

create or replace function public.finalize_settled_event_deletion(
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
begin
  v_role := private.current_profile_role();
  if coalesce(v_role,'') not in ('owner','admin') then
    raise exception 'حذف الفعاليات متاح للمالك أو المدير فقط';
  end if;
  if p_settlement_confirmed is distinct from true then
    raise exception 'يجب تأكيد إتمام محاسبة صاحب الفعالية أولاً';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(748231905441::bigint);
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'الفعالية غير موجودة أو سبق حذفها';
  end if;

  if not exists (select 1 from public.event_lifetime_stats s where s.event_id = p_event_id) then
    raise exception 'لم يتم حفظ إحصائيات الفعالية؛ أوقفنا الحذف لحماية الأرقام';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.event_id = p_event_id
      and b.status in ('pending_payment','under_review')
  ) or exists (
    select 1 from public.payment_submissions ps
    join public.bookings b on b.id = ps.booking_id
    where b.event_id = p_event_id
      and ps.status not in ('approved','rejected')
  ) then
    raise exception 'ظهرت معاملات معلقة؛ أوقفنا الحذف';
  end if;

  if exists (
    select 1 from storage.objects o
    join public.payment_submissions ps on ps.receipt_path = o.name
    join public.bookings b on b.id = ps.booking_id
    where o.bucket_id = 'payment-receipts' and b.event_id = p_event_id
  ) or exists (
    select 1 from storage.objects o
    where o.bucket_id = 'event-covers'
      and v_event.cover_image_url like '%' || o.name
  ) then
    raise exception 'لم تُحذف كل ملفات الفعالية من التخزين؛ أوقفنا حذف سجلاتها';
  end if;

  delete from public.email_outbox eo
   where eo.booking_id in (select b.id from public.bookings b where b.event_id = p_event_id)
      or eo.notification_id in (
        select n.id from public.notifications n
        where n.booking_id in (select b.id from public.bookings b where b.event_id = p_event_id)
      );

  delete from public.notifications
   where booking_id in (select b.id from public.bookings b where b.event_id = p_event_id);

  delete from public.admin_activity_log
   where event_id = p_event_id
      or booking_id in (select b.id from public.bookings b where b.event_id = p_event_id);

  delete from public.checkins where event_id = p_event_id;
  delete from public.gatekeeper_scan_logs where event_id = p_event_id;
  delete from public.payment_submissions
   where booking_id in (select b.id from public.bookings b where b.event_id = p_event_id);
  delete from public.tickets where event_id = p_event_id;
  delete from public.booking_items
   where booking_id in (select b.id from public.bookings b where b.event_id = p_event_id);
  delete from public.bookings where event_id = p_event_id;

  delete from public.event_role_assignments where event_id = p_event_id;
  delete from public.event_payment_accounts where event_id = p_event_id;
  delete from public.ticket_types where event_id = p_event_id;
  delete from public.events where id = p_event_id;

  return jsonb_build_object('success',true,'statistics_preserved',true,'event_deleted',true);
end;
$$;
revoke all on function public.finalize_settled_event_deletion(uuid,boolean) from public, anon;
grant execute on function public.finalize_settled_event_deletion(uuid,boolean) to authenticated;
