begin;

select plan(19);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, phone
) values
(
  '51000000-0000-4000-8000-000000000001','authenticated','authenticated',
  'event-deletion-admin@example.test','',now(),
  '{"provider":"email","providers":["email"]}','{"full_name":"Deletion Admin"}',
  now(),now(),'0915100001'
),
(
  '51000000-0000-4000-8000-000000000002','authenticated','authenticated',
  'event-deletion-customer@example.test','',now(),
  '{"provider":"email","providers":["email"]}','{"full_name":"Deletion Customer"}',
  now(),now(),'0915100002'
);

insert into public.profiles(id,full_name,phone,role) values
('51000000-0000-4000-8000-000000000001','Deletion Admin','0915100001','admin'),
('51000000-0000-4000-8000-000000000002','Deletion Customer','0915100002','customer')
on conflict(id) do update
set role=excluded.role,full_name=excluded.full_name,phone=excluded.phone;

insert into public.events(id,title,slug,starts_at,ends_at,status,created_by) values
('52000000-0000-4000-8000-000000000001','Deletion Missing End','deletion-missing-end',now()-interval '10 days',null,'completed','51000000-0000-4000-8000-000000000001'),
('52000000-0000-4000-8000-000000000002','Deletion Recent End','deletion-recent-end',now()-interval '10 days',now()-interval '6 days','completed','51000000-0000-4000-8000-000000000001'),
('52000000-0000-4000-8000-000000000003','Deletion Exact Boundary','deletion-exact-boundary',now()-interval '10 days',now()-interval '7 days','completed','51000000-0000-4000-8000-000000000001'),
('52000000-0000-4000-8000-000000000004','Deletion Old No Activity','deletion-old-no-activity',now()-interval '10 days',now()-interval '8 days','completed','51000000-0000-4000-8000-000000000001'),
('52000000-0000-4000-8000-000000000005','Deletion Recent Booking','deletion-recent-booking',now()-interval '10 days',now()+interval '2 days','published','51000000-0000-4000-8000-000000000001'),
('52000000-0000-4000-8000-000000000006','Deletion Recent Payment Upload','deletion-recent-payment-upload',now()-interval '10 days',now()+interval '2 days','published','51000000-0000-4000-8000-000000000001'),
('52000000-0000-4000-8000-000000000007','Deletion Recent Payment Review','deletion-recent-payment-review',now()-interval '10 days',now()+interval '2 days','published','51000000-0000-4000-8000-000000000001'),
('52000000-0000-4000-8000-000000000008','Deletion Recent Checkin','deletion-recent-checkin',now()-interval '10 days',now()+interval '2 days','published','51000000-0000-4000-8000-000000000001');

insert into public.ticket_types(id,event_id,name,price,currency,quantity_total,quantity_sold,is_active) values
('53000000-0000-4000-8000-000000000008','52000000-0000-4000-8000-000000000008','Checkin Activity Ticket',100,'SDG',1,1,true);

insert into public.bookings(
  id,booking_number,user_id,customer_name,customer_email,customer_phone,
  event_id,subtotal,currency,status,created_at
) values
(
  '54000000-0000-4000-8000-000000000005','DEL-BOOK-005',
  '51000000-0000-4000-8000-000000000002','Deletion Customer','event-deletion-customer@example.test','0915100002',
  '52000000-0000-4000-8000-000000000005',100,'SDG','confirmed',now()
),
(
  '54000000-0000-4000-8000-000000000006','DEL-BOOK-006',
  '51000000-0000-4000-8000-000000000002','Deletion Customer','event-deletion-customer@example.test','0915100002',
  '52000000-0000-4000-8000-000000000006',100,'SDG','under_review',now()-interval '8 days'
),
(
  '54000000-0000-4000-8000-000000000007','DEL-BOOK-007',
  '51000000-0000-4000-8000-000000000002','Deletion Customer','event-deletion-customer@example.test','0915100002',
  '52000000-0000-4000-8000-000000000007',100,'SDG','confirmed',now()-interval '8 days'
),
(
  '54000000-0000-4000-8000-000000000008','DEL-BOOK-008',
  '51000000-0000-4000-8000-000000000002','Deletion Customer','event-deletion-customer@example.test','0915100002',
  '52000000-0000-4000-8000-000000000008',100,'SDG','confirmed',now()-interval '8 days'
);

insert into public.payment_submissions(
  id,booking_id,submitted_by,amount,currency,status,reviewed_by,reviewed_at,created_at
) values
(
  '55000000-0000-4000-8000-000000000006','54000000-0000-4000-8000-000000000006',
  '51000000-0000-4000-8000-000000000002',100,'SDG','submitted',
  null,null,now()
),
(
  '55000000-0000-4000-8000-000000000007','54000000-0000-4000-8000-000000000007',
  '51000000-0000-4000-8000-000000000002',100,'SDG','approved',
  '51000000-0000-4000-8000-000000000001',now(),now()-interval '8 days'
);

insert into public.booking_items(id,booking_id,ticket_type_id,quantity,unit_price,line_total) values
(
  '56000000-0000-4000-8000-000000000008','54000000-0000-4000-8000-000000000008',
  '53000000-0000-4000-8000-000000000008',1,100,100
);

insert into public.tickets(
  id,booking_item_id,booking_id,event_id,ticket_type_id,ticket_code,qr_token,
  attendee_name,status,issued_at
) values (
  '57000000-0000-4000-8000-000000000008',
  '56000000-0000-4000-8000-000000000008',
  '54000000-0000-4000-8000-000000000008',
  '52000000-0000-4000-8000-000000000008',
  '53000000-0000-4000-8000-000000000008',
  '5100000008','58000000-0000-4000-8000-000000000008',
  'Deletion Customer','valid',now()-interval '8 days'
);

insert into public.checkins(id,event_id,ticket_id,checked_in_by,checked_in_at,gate_name)
values (
  '59000000-0000-4000-8000-000000000008',
  '52000000-0000-4000-8000-000000000008',
  '57000000-0000-4000-8000-000000000008',
  '51000000-0000-4000-8000-000000000001',
  now(),'Test Gate'
);

-- Simulate an administrator moving ends_at into the past after recent activity.
update public.events
set ends_at=now()-interval '8 days', status='completed'
where id in (
  '52000000-0000-4000-8000-000000000005',
  '52000000-0000-4000-8000-000000000006',
  '52000000-0000-4000-8000-000000000007',
  '52000000-0000-4000-8000-000000000008'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000001',true);

select throws_ok(
  format('select public.prepare_settled_event_deletion(%L,true)','52000000-0000-4000-8000-000000000001'),
  'P0001','لا يمكن حذف الفعالية: تاريخ نهاية الفعالية غير محدد. حدّد تاريخ النهاية أولاً',
  'Deletion rejects an event without an end date'
);
select is(
  (select count(*)::integer from public.events where id='52000000-0000-4000-8000-000000000001'),
  1,'Missing-end event remains unchanged after rejection'
);
select is(
  (select count(*)::integer from public.event_lifetime_stats where event_id='52000000-0000-4000-8000-000000000001'),
  0,'Missing-end rejection does not archive statistics'
);

select throws_ok(
  format('select public.prepare_settled_event_deletion(%L,true)','52000000-0000-4000-8000-000000000002'),
  'P0001',
  'لا يمكن حذف الفعالية قبل ' ||
    (select to_char((ends_at + interval '7 days') at time zone 'Africa/Khartoum','DD/MM/YYYY HH24:MI')
     from public.events where id='52000000-0000-4000-8000-000000000002') ||
    ' بتوقيت السودان',
  'Deletion rejects an event whose end date is only six days old'
);
select is(
  (select count(*)::integer from public.events where id='52000000-0000-4000-8000-000000000002'),
  1,'Recent-end event remains unchanged after rejection'
);
select is(
  (select count(*)::integer from public.event_lifetime_stats where event_id='52000000-0000-4000-8000-000000000002'),
  0,'Recent-end rejection does not archive statistics'
);

select lives_ok(
  format('select public.prepare_settled_event_deletion(%L,true)','52000000-0000-4000-8000-000000000003'),
  'Deletion is allowed at the exact seven-day end-date boundary'
);
select is(
  (select count(*)::integer from public.event_lifetime_stats where event_id='52000000-0000-4000-8000-000000000003'),
  1,'Exact-boundary eligible event statistics are archived'
);

select lives_ok(
  format('select public.prepare_settled_event_deletion(%L,true)','52000000-0000-4000-8000-000000000004'),
  'Deletion is allowed after eight days when there is no recent activity'
);

select throws_ok(
  format('select public.prepare_settled_event_deletion(%L,true)','52000000-0000-4000-8000-000000000005'),
  'P0001',
  'لا يمكن حذف الفعالية: يوجد نشاط خلال آخر 7 أيام (حجز أو رفع/مراجعة إثبات دفع أو تسجيل دخول). انتظر مرور 7 أيام كاملة بعد آخر نشاط ثم أعد المحاولة',
  'Recent booking activity blocks deletion even after ends_at is moved into the past'
);
select is(
  (select count(*)::integer from public.event_lifetime_stats where event_id='52000000-0000-4000-8000-000000000005'),
  0,'Recent-booking rejection does not archive statistics'
);
select is(
  (select count(*)::integer from public.events where id='52000000-0000-4000-8000-000000000005'),
  1,'Recent-booking event remains after rejection'
);

select throws_ok(
  format('select public.prepare_settled_event_deletion(%L,true)','52000000-0000-4000-8000-000000000006'),
  'P0001',
  'لا يمكن حذف الفعالية: يوجد نشاط خلال آخر 7 أيام (حجز أو رفع/مراجعة إثبات دفع أو تسجيل دخول). انتظر مرور 7 أيام كاملة بعد آخر نشاط ثم أعد المحاولة',
  'Recent payment upload blocks deletion'
);
select is(
  (select count(*)::integer from public.event_lifetime_stats where event_id='52000000-0000-4000-8000-000000000006'),
  0,'Recent payment-upload rejection does not archive statistics'
);

select throws_ok(
  format('select public.prepare_settled_event_deletion(%L,true)','52000000-0000-4000-8000-000000000007'),
  'P0001',
  'لا يمكن حذف الفعالية: يوجد نشاط خلال آخر 7 أيام (حجز أو رفع/مراجعة إثبات دفع أو تسجيل دخول). انتظر مرور 7 أيام كاملة بعد آخر نشاط ثم أعد المحاولة',
  'Recent payment review blocks deletion'
);
select is(
  (select count(*)::integer from public.event_lifetime_stats where event_id='52000000-0000-4000-8000-000000000007'),
  0,'Recent payment-review rejection does not archive statistics'
);

select throws_ok(
  format('select public.prepare_settled_event_deletion(%L,true)','52000000-0000-4000-8000-000000000008'),
  'P0001',
  'لا يمكن حذف الفعالية: يوجد نشاط خلال آخر 7 أيام (حجز أو رفع/مراجعة إثبات دفع أو تسجيل دخول). انتظر مرور 7 أيام كاملة بعد آخر نشاط ثم أعد المحاولة',
  'Recent check-in blocks deletion'
);
select is(
  (select count(*)::integer from public.event_lifetime_stats where event_id='52000000-0000-4000-8000-000000000008'),
  0,'Recent-check-in rejection does not archive statistics'
);
select is(
  (select count(*)::integer from public.events where id='52000000-0000-4000-8000-000000000008'),
  1,'Recent-check-in event remains after rejection'
);

reset role;
select * from finish();
rollback;
