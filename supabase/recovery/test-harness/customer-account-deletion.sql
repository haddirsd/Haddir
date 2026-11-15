\set ON_ERROR_STOP on
create extension if not exists pgcrypto;
create schema auth;
create schema private;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create function auth.role() returns text
language sql stable
as $$ select current_setting('request.jwt.claim.role', true) $$;

create table public.profiles(id uuid primary key, role text not null);
create table public.events(id uuid primary key, created_by uuid, starts_at timestamptz);
create table public.event_role_assignments(user_id uuid, event_id uuid);
create table public.gatekeeper_scan_logs(gatekeeper_user_id uuid);
create table public.bookings(
  id uuid primary key,
  user_id uuid,
  event_id uuid,
  status text,
  customer_name text not null,
  customer_email text,
  customer_phone text not null
);
create table public.payment_submissions(
  id uuid primary key default gen_random_uuid(),
  booking_id uuid,
  submitted_by uuid,
  receipt_path text
);
create table public.email_outbox(recipient_user_id uuid);
create table public.notifications(user_id uuid);
create table public.push_subscriptions(user_id uuid);

\i supabase/migrations/20261115120000_atomic_customer_account_deletion.sql

insert into public.profiles(id,role) values
 ('10000000-0000-4000-8000-000000000001','customer'),
 ('10000000-0000-4000-8000-000000000002','customer'),
 ('10000000-0000-4000-8000-000000000003','admin');
insert into public.events(id,created_by,starts_at) values
 ('20000000-0000-4000-8000-000000000001',null,now()+interval '2 days');
insert into public.bookings(id,user_id,event_id,status,customer_name,customer_email,customer_phone) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','pending_payment','Test Customer','test@example.invalid','0000000000'),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','confirmed','Upcoming Customer','upcoming@example.invalid','0000000001');
insert into public.payment_submissions(booking_id,submitted_by,receipt_path)
values ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000/30000000/receipt.png');
insert into public.notifications(user_id) values ('10000000-0000-4000-8000-000000000001');
insert into public.push_subscriptions(user_id) values ('10000000-0000-4000-8000-000000000001');
insert into public.email_outbox(recipient_user_id) values ('10000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.role','service_role',false);
do $$
declare v_paths text[];
begin
  v_paths := public.prepare_customer_account_deletion('10000000-0000-4000-8000-000000000001');
  if not ('10000000/30000000/receipt.png'=any(v_paths)) then raise exception 'FAIL: receipt path not queued'; end if;
  v_paths := public.prepare_customer_account_deletion('10000000-0000-4000-8000-000000000001');
  if not ('10000000/30000000/receipt.png'=any(v_paths)) then raise exception 'FAIL: retry lost receipt path'; end if;
end $$;

select set_config('request.jwt.claim.role','authenticated',false);
do $$
begin
  begin
    insert into public.bookings(id,user_id,event_id,status,customer_name,customer_phone)
    values ('30000000-0000-4000-8000-000000000019','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','pending_payment','Blocked','0000000002');
    raise exception 'FAIL: pending deletion allowed booking insert';
  exception when others then
    if sqlerrm = 'FAIL: pending deletion allowed booking insert' then raise; end if;
  end;
  begin
    insert into public.payment_submissions(booking_id,submitted_by,receipt_path)
    values ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000/30000000/late.png');
    raise exception 'FAIL: pending deletion allowed payment insert';
  exception when others then
    if sqlerrm = 'FAIL: pending deletion allowed payment insert' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.role','service_role',false);
do $$
declare v_queue int; v_booking int; v_payment int; v_notifications int; v_push int; v_outbox int;
begin
  select count(*) into v_queue from private.customer_account_deletion_cleanup where user_id='10000000-0000-4000-8000-000000000001';
  select count(*) into v_booking from public.bookings where id='30000000-0000-4000-8000-000000000001' and user_id is null and customer_name='مستخدم محذوف' and customer_email is null and customer_phone='محذوف';
  select count(*) into v_payment from public.payment_submissions where booking_id='30000000-0000-4000-8000-000000000001' and submitted_by is null and receipt_path is null;
  select count(*) into v_notifications from public.notifications where user_id='10000000-0000-4000-8000-000000000001';
  select count(*) into v_push from public.push_subscriptions where user_id='10000000-0000-4000-8000-000000000001';
  select count(*) into v_outbox from public.email_outbox where recipient_user_id='10000000-0000-4000-8000-000000000001';
  if v_queue<>1 or v_booking<>1 or v_payment<>1 or v_notifications<>0 or v_push<>0 or v_outbox<>0 then
    raise exception 'FAIL: cleanup assertions queue %, booking %, payment %, notifications %, push %, outbox %',v_queue,v_booking,v_payment,v_notifications,v_push,v_outbox;
  end if;
end $$;

do $$
begin
  begin
    perform public.prepare_customer_account_deletion('10000000-0000-4000-8000-000000000002');
    raise exception 'FAIL: upcoming confirmed booking was not rejected';
  exception when others then
    if sqlerrm = 'FAIL: upcoming confirmed booking was not rejected' then raise; end if;
  end;
  begin
    perform public.prepare_customer_account_deletion('10000000-0000-4000-8000-000000000003');
    raise exception 'FAIL: non-customer role was not rejected';
  exception when others then
    if sqlerrm = 'FAIL: non-customer role was not rejected' then raise; end if;
  end;
end $$;

-- Simulates the post-Auth-delete bookkeeping call; no real Auth/Storage API is exercised here.
select public.complete_customer_account_deletion('10000000-0000-4000-8000-000000000001');
do $$
begin
  if exists(select 1 from private.customer_account_deletion_cleanup where user_id='10000000-0000-4000-8000-000000000001') then
    raise exception 'FAIL: final cleanup queue row remains';
  end if;
end $$;
