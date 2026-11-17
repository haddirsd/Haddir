create table if not exists public.payment_methods (
  id text primary key,
  name text not null,
  account_details text not null,
  beneficiary text not null,
  instructions text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_methods enable row level security;
create policy "Active payment methods are visible to customers" on public.payment_methods
for select to authenticated using (is_active or private.current_profile_role() in ('owner','admin','supervisor'));
create policy "Platform admins manage payment methods" on public.payment_methods
for all to authenticated using (private.current_profile_role() in ('owner','admin'))
with check (private.current_profile_role() in ('owner','admin'));
grant select on public.payment_methods to authenticated;
grant insert,update,delete on public.payment_methods to authenticated;
insert into public.payment_methods(id,name,account_details,beneficiary,instructions,is_active,sort_order) values
('bankak','بنكك','أدخل رقم الحساب من لوحة التحكم','حاضر للفعاليات','حوّل المبلغ الموضح ثم ارفع صورة الإيصال.',false,10),
('fawry','فوري','أدخل بيانات الدفع من لوحة التحكم','حاضر للفعاليات','حوّل المبلغ الموضح ثم ارفع صورة الإيصال.',false,20),
('sahel','ساهل','أدخل بيانات الدفع من لوحة التحكم','حاضر للفعاليات.',false,30),
('kash','كاشي','أدخل بيانات الدفع من لوحة التحكم','حاضر للفعاليات','حوّل المبلغ الموضح ثم ارفع صورة الإيصال.',false,40)
on conflict (id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-receipts','payment-receipts',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "Customers upload own payment receipts" on storage.objects for insert to authenticated
with check(bucket_id='payment-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(
 select 1 from public.bookings b where b.id::text=(storage.foldername(name))[2] and b.user_id=(select auth.uid()) and b.status='pending_payment' and b.expires_at>now()));
create policy "Owners and admins read payment receipts" on storage.objects for select to authenticated
using(bucket_id='payment-receipts' and ((storage.foldername(name))[1]=(select auth.uid())::text or private.current_profile_role() in ('owner','admin','supervisor')));
create or replace function public.submit_payment(p_booking_id uuid,p_payment_method_id text,p_receipt_path text,p_transfer_reference text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_booking public.bookings%rowtype; v_submission uuid;
begin
 if v_user is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
 if p_receipt_path is null or p_receipt_path !~ ('^'||v_user::text||'/'||p_booking_id::text||'/[A-Za-z0-9._-]+$') then raise exception 'مسار الإيصال غير صالح'; end if;
 if not exists(select 1 from public.payment_methods pm where pm.id=p_payment_method_id and pm.is_active) then raise exception 'طريقة الدفع غير متاحة حالياً'; end if;
 select * into v_booking from public.bookings where id=p_booking_id and user_id=v_user for update;
 if not found then raise exception 'الحجز غير موجود'; end if;
 if v_booking.status<>'pending_payment' or v_booking.expires_at is null or v_booking.expires_at<=now() then raise exception 'انتهت مهلة الحجز أو تم إرسال إثبات دفع مسبقاً'; end if;
 if not exists(select 1 from storage.objects so where so.bucket_id='payment-receipts' and so.name=p_receipt_path) then raise exception 'لم يتم العثور على الإيصال المرفوع'; end if;
 insert into public.payment_submissions(booking_id,submitted_by,transfer_reference,receipt_path,amount,currency,status)
 values(p_booking_id,v_user,nullif(trim(p_transfer_reference),''),p_receipt_path,v_booking.subtotal,v_booking.currency,'submitted') returning id into v_submission;
 update public.bookings set status='under_review',updated_at=now() where id=p_booking_id;
 return v_submission;
end; $$;
revoke all on function public.submit_payment(uuid,text,text,text) from public,anon;
grant execute on function public.submit_payment(uuid,text,text,text) to authenticated;
