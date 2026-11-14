create table if not exists public.event_payment_accounts (
  id text primary key default gen_random_uuid()::text,
  event_id uuid not null references public.events(id) on delete cascade,
  account_name text not null check (length(trim(account_name)) > 0),
  account_number text not null check (length(trim(account_number)) > 0),
  sort_order integer not null default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists event_payment_accounts_event_idx on public.event_payment_accounts(event_id, sort_order);
alter table public.event_payment_accounts enable row level security;
create policy "Active event accounts are visible for published events" on public.event_payment_accounts for select to anon, authenticated using (is_active and exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));
create policy "Platform admins manage event payment accounts" on public.event_payment_accounts for all to authenticated using (private.current_profile_role() = any (array['owner','admin']::text[])) with check (private.current_profile_role() = any (array['owner','admin']::text[]));
grant select on public.event_payment_accounts to anon, authenticated;
grant insert, update, delete on public.event_payment_accounts to authenticated;
create or replace function public.submit_payment(p_booking_id uuid, p_payment_method_id text, p_receipt_path text, p_transfer_reference text default null)
returns uuid language plpgsql security definer set search_path = '' as $function$
declare
 v_user uuid := auth.uid();
 v_booking public.bookings%rowtype;
 v_submission uuid;
begin
 if v_user is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
 if p_receipt_path is null or p_receipt_path !~ ('^'||v_user::text||'/'||p_booking_id::text||'/[A-Za-z0-9._-]+$') then raise exception 'مسار الإيصال غير صالح'; end if;
 select * into v_booking from public.bookings where id=p_booking_id and user_id=v_user for update;
 if not found then raise exception 'الحجز غير موجود'; end if;
 if not (exists(select 1 from public.payment_methods pm where pm.id=p_payment_method_id and pm.is_active)
   or exists(select 1 from public.event_payment_accounts epa where epa.id=p_payment_method_id and epa.event_id=v_booking.event_id and epa.is_active)) then
   raise exception 'طريقة الدفع غير متاحة لهذه الفعالية';
 end if;
 if v_booking.status <> 'pending_payment' or v_booking.expires_at is null or v_booking.expires_at <= now() then raise exception 'انتهت مهلة الحجز أو تم إرسال إثبات دفع مسبقاً'; end if;
 if not exists(select 1 from storage.objects so where so.bucket_id='payment-receipts' and so.name=p_receipt_path) then raise exception 'لم يتم العثور على الإيصال المرفوع'; end if;
 insert into public.payment_submissions(booking_id,submitted_by,transfer_reference,receipt_path,amount,currency,status)
 values (p_booking_id,v_user,nullif(trim(p_transfer_reference),''),p_receipt_path,v_booking.subtotal,v_booking.currency,'submitted') returning id into v_submission;
 update public.bookings set status='under_review',updated_at=now() where id=p_booking_id;
 return v_submission;
end;
$function$;
revoke all on function public.submit_payment(uuid,text,text,text) from public;
grant execute on function public.submit_payment(uuid,text,text,text) to authenticated;