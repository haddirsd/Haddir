begin;

select plan(21);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, phone
) values
(
  '41000000-0000-4000-8000-000000000001','authenticated','authenticated',
  'ticket-lifecycle-customer@example.test','',now(),
  '{"provider":"email","providers":["email"]}','{"full_name":"Ticket Customer"}',
  now(),now(),'0914100001'
),
(
  '41000000-0000-4000-8000-000000000002','authenticated','authenticated',
  'ticket-lifecycle-admin@example.test','',now(),
  '{"provider":"email","providers":["email"]}','{"full_name":"Ticket Admin"}',
  now(),now(),'0914100002'
),
(
  '41000000-0000-4000-8000-000000000003','authenticated','authenticated',
  'ticket-lifecycle-gatekeeper@example.test','',now(),
  '{"provider":"email","providers":["email"]}','{"full_name":"Ticket Gatekeeper"}',
  now(),now(),'0914100003'
),
(
  '41000000-0000-4000-8000-000000000004','authenticated','authenticated',
  'ticket-lifecycle-other-gatekeeper@example.test','',now(),
  '{"provider":"email","providers":["email"]}','{"full_name":"Other Gatekeeper"}',
  now(),now(),'0914100004'
);

insert into public.profiles(id,full_name,phone,role) values
('41000000-0000-4000-8000-000000000001','Ticket Customer','0914100001','customer'),
('41000000-0000-4000-8000-000000000002','Ticket Admin','0914100002','admin'),
('41000000-0000-4000-8000-000000000003','Ticket Gatekeeper','0914100003','gatekeeper'),
('41000000-0000-4000-8000-000000000004','Other Gatekeeper','0914100004','gatekeeper')
on conflict(id) do update set role=excluded.role,full_name=excluded.full_name,phone=excluded.phone;

insert into public.events(id,title,slug,starts_at,ends_at,status,created_by) values
('42000000-0000-4000-8000-000000000001','Ticket Lifecycle Event','ticket-lifecycle-event',
 now()+interval '2 days',now()+interval '3 days','published','41000000-0000-4000-8000-000000000001'),
('42000000-0000-4000-8000-000000000002','Other Ticket Event','other-ticket-event',
 now()+interval '2 days',now()+interval '3 days','published','41000000-0000-4000-8000-000000000001');

insert into public.ticket_types(id,event_id,name,price,currency,quantity_total,quantity_sold,is_active) values
('43000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','Lifecycle Ticket',100,'SDG',5,2,true),
('43000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000002','Other Event Ticket',100,'SDG',5,1,true);

insert into public.event_role_assignments(user_id,event_id,assignment_role) values
('41000000-0000-4000-8000-000000000003','42000000-0000-4000-8000-000000000001','gatekeeper'),
('41000000-0000-4000-8000-000000000004','42000000-0000-4000-8000-000000000002','gatekeeper');

insert into public.bookings(
 id,booking_number,user_id,customer_name,customer_email,customer_phone,event_id,subtotal,currency,status
) values
('44000000-0000-4000-8000-000000000001','TLC-BOOK-001','41000000-0000-4000-8000-000000000001',
 'Ticket Customer','ticket-lifecycle-customer@example.test','0914100001',
 '42000000-0000-4000-8000-000000000001',100,'SDG','under_review'),
('44000000-0000-4000-8000-000000000002','TLC-BOOK-002','41000000-0000-4000-8000-000000000001',
 'Ticket Customer','ticket-lifecycle-customer@example.test','0914100001',
 '42000000-0000-4000-8000-000000000001',100,'SDG','under_review');

insert into public.booking_items(id,booking_id,ticket_type_id,quantity,unit_price,line_total) values
('45000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001',
 '43000000-0000-4000-8000-000000000001',1,100,100),
('45000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000002',
 '43000000-0000-4000-8000-000000000001',1,100,100);

insert into public.payment_submissions(id,booking_id,submitted_by,amount,currency,status) values
('46000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001',
 '41000000-0000-4000-8000-000000000001',100,'SDG','submitted'),
('46000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000002',
 '41000000-0000-4000-8000-000000000001',100,'SDG','submitted');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000002',true);

select is(
  (public.review_payment_submission('46000000-0000-4000-8000-000000000001','approve',null)->>'tickets_created')::integer,
  1,'Approving a paid booking issues exactly one ticket for its one booking item'
);
select is(
  (select status from public.bookings where id='44000000-0000-4000-8000-000000000001'),
  'confirmed','Ticket issuance confirms the associated booking'
);
select is(
  (select status from public.payment_submissions where id='46000000-0000-4000-8000-000000000001'),
  'approved','Ticket issuance approves the associated payment'
);
select is(
  (select count(*)::integer from public.tickets where booking_id='44000000-0000-4000-8000-000000000001'),
  1,'Approval persists one ticket row'
);

select lives_ok(
  $$select public.review_payment_submission(
    '46000000-0000-4000-8000-000000000002','approve',null
  )$$,
  'A second independent booking can issue its own ticket'
);

select set_config(
  'test.first_ticket_code',
  (select ticket_code from public.tickets where booking_id='44000000-0000-4000-8000-000000000001'),
  true
);
select set_config(
  'test.second_ticket_code',
  (select ticket_code from public.tickets where booking_id='44000000-0000-4000-8000-000000000002'),
  true
);
select ok(
  nullif(current_setting('test.first_ticket_code',true),'') is not null
  and nullif(current_setting('test.second_ticket_code',true),'') is not null,
  'Issued ticket codes are captured before switching authentication identities'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);

select is(
  (select count(*)::integer from public.notifications
   where booking_id='44000000-0000-4000-8000-000000000001' and type='ticket_approved'),
  1,'Customer can read the ticket-issued notification for their booking'
);
select is(
  (select count(*)::integer from public.tickets t
   join public.bookings b on b.id=t.booking_id
   where b.user_id='41000000-0000-4000-8000-000000000001'),
  2,'Customer can read their own issued tickets'
);
select is(
  (select count(*)::integer from public.tickets t
   join public.bookings b on b.id=t.booking_id
   where b.user_id='41000000-0000-4000-8000-000000000004'),
  0,'Customer cannot read another customer tickets'
);
select throws_ok(
  format('select public.gatekeeper_ticket_action(%L,true)',
    current_setting('test.first_ticket_code',true)),
  'P0001','هذه الخدمة مخصصة للبواب فقط',
  'Customer role cannot validate or consume a ticket'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000003',true);

select is(
  (public.gatekeeper_ticket_action(
    current_setting('test.first_ticket_code',true),false
  )->>'status'),
  'valid','Assigned gatekeeper can validate a valid ticket without consuming it'
);
select is(
  (public.gatekeeper_ticket_action(
    current_setting('test.first_ticket_code',true),true
  )->>'status'),
  'checked_in','QR confirmation checks the ticket in'
);
select is(
  (select status from public.tickets where booking_id='44000000-0000-4000-8000-000000000001'),
  'used','Successful QR confirmation marks the ticket as used'
);
select is(
  (public.gatekeeper_ticket_action(
    current_setting('test.first_ticket_code',true),true
  )->>'status'),
  'used','A second QR confirmation is rejected as already used'
);
select is(
  (public.gatekeeper_manual_ticket_action(
    current_setting('test.second_ticket_code',true),true
  )->>'status'),
  'checked_in','Manual numeric entry can confirm a valid ticket'
);
select is(
  (select count(*)::integer from public.gatekeeper_scan_logs
   where gatekeeper_user_id='41000000-0000-4000-8000-000000000003'
     and event_id='42000000-0000-4000-8000-000000000001'
     and outcome='accepted'),
  2,'Successful QR and manual validations are recorded in scan history'
);
-- Notification reads are scoped to the notification owner, not the gatekeeper.
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);

select is(
  (select count(*)::integer from public.notifications
   where booking_id='44000000-0000-4000-8000-000000000001'
     and type='ticket_checked_in'),
  1,'Successful check-in notifies the customer exactly once');

-- Continue the scan-history assertions as the assigned gatekeeper.
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000003',true);

select is(
  (public.gatekeeper_ticket_action('0000000000',true)->>'status'),
  'not_found','Unknown QR/manual code is rejected as not issued by Haddir'
);
select is(
  (select count(*)::integer from public.gatekeeper_scan_logs
   where gatekeeper_user_id='41000000-0000-4000-8000-000000000003'
     and outcome='forged'),
  1,'Unknown ticket code is retained in the gatekeeper scan audit'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"41000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000004',true);

select throws_ok(
  format('select public.gatekeeper_ticket_action(%L,true)',
    current_setting('test.first_ticket_code',true)),
  'P0001','هذه التذكرة لا تخص الفعالية المصرح لك بها',
  'Gatekeeper assigned to another event cannot validate this ticket'
);
select throws_ok(
  format('select public.gatekeeper_manual_ticket_action(%L,true)',
    current_setting('test.first_ticket_code',true)),
  'P0001','هذه التذكرة لا تخص الفعالية المصرح لك بها',
  'Manual entry also enforces the event assignment boundary'
);

reset role;
select * from finish();
rollback;
