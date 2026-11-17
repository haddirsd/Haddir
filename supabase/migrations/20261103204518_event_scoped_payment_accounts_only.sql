-- Payment submissions must reference an active account belonging to their booking's event.
-- Keep the beneficiary alongside the other account details as an immutable payment snapshot.
alter table public.payment_submissions
  add column if not exists payment_account_beneficiary text;

update public.payment_submissions ps
set payment_account_beneficiary = epa.beneficiary
from public.event_payment_accounts epa
where ps.payment_account_id = epa.id
  and ps.payment_account_beneficiary is null;

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
as $$
declare
  v_user uuid := auth.uid();
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
     or p_receipt_path !~ ('^'||v_user::text||'/'||p_booking_id::text||'/[A-Za-z0-9._-]+$') then
    raise exception 'مسار الإيصال غير صالح';
  end if;

  select *
    into v_booking
  from public.bookings
  where id = p_booking_id
    and user_id = v_user
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
  set status = 'under_review', updated_at = now()
  where id = p_booking_id;

  return v_submission;
end;
$$;

revoke all on function public.submit_payment(uuid,text,text,text) from public, anon;
grant execute on function public.submit_payment(uuid,text,text,text) to authenticated;
