begin;

select plan(32);

-- Isolated identities for every platform role.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, phone
) values
('13000000-0000-4000-8000-000000000001','authenticated','authenticated','auth-customer@example.com','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Authorization Customer"}',now(),now(),'0913000001'),
('13000000-0000-4000-8000-000000000002','authenticated','authenticated','auth-other@example.com','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Authorization Other"}',now(),now(),'0913000002'),
('13000000-0000-4000-8000-000000000003','authenticated','authenticated','auth-supervisor@example.com','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Authorization Supervisor"}',now(),now(),'0913000003'),
('13000000-0000-4000-8000-000000000004','authenticated','authenticated','auth-gatekeeper@example.com','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Authorization Gatekeeper"}',now(),now(),'0913000004'),
('13000000-0000-4000-8000-000000000005','authenticated','authenticated','auth-advertiser@example.com','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Authorization Advertiser"}',now(),now(),'0913000005'),
('13000000-0000-4000-8000-000000000006','authenticated','authenticated','auth-admin@example.com','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Authorization Admin"}',now(),now(),'0913000006'),
('13000000-0000-4000-8000-000000000007','authenticated','authenticated','auth-owner@example.com','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Authorization Owner"}',now(),now(),'0913000007'),
('13000000-0000-4000-8000-000000000008','authenticated','authenticated','auth-target@example.com','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Authorization Target"}',now(),now(),'0913000008');

insert into public.profiles(id,full_name,phone,role) values
('13000000-0000-4000-8000-000000000001','Authorization Customer','0913000001','customer'),
('13000000-0000-4000-8000-000000000002','Authorization Other','0913000002','customer'),
('13000000-0000-4000-8000-000000000003','Authorization Supervisor','0913000003','supervisor'),
('13000000-0000-4000-8000-000000000004','Authorization Gatekeeper','0913000004','gatekeeper'),
('13000000-0000-4000-8000-000000000005','Authorization Advertiser','0913000005','advertiser'),
('13000000-0000-4000-8000-000000000006','Authorization Admin','0913000006','admin'),
('13000000-0000-4000-8000-000000000007','Authorization Owner','0913000007','owner'),
('13000000-0000-4000-8000-000000000008','Authorization Target','0913000008','customer')
on conflict (id) do update set role=excluded.role,full_name=excluded.full_name,phone=excluded.phone;

insert into public.events(id,title,slug,starts_at,ends_at,status,created_by,venue,city,platform_fee_percent) values
('23000000-0000-4000-8000-000000000001','Authorization Event One','authorization-event-one',now()+interval '5 days',now()+interval '6 days','published','13000000-0000-4000-8000-000000000001','Venue One','Khartoum',10),
('23000000-0000-4000-8000-000000000002','Authorization Event Two','authorization-event-two',now()+interval '7 days',now()+interval '8 days','published','13000000-0000-4000-8000-000000000002','Venue Two','Omdurman',15);

insert into public.event_role_assignments(user_id,event_id,assignment_role) values
('13000000-0000-4000-8000-000000000003','23000000-0000-4000-8000-000000000001','supervisor'),
('13000000-0000-4000-8000-000000000004','23000000-0000-4000-8000-000000000001','gatekeeper'),
('13000000-0000-4000-8000-000000000005','23000000-0000-4000-8000-000000000001','advertiser');

insert into public.ticket_types(id,event_id,name,price,currency,quantity_total,quantity_sold,is_active) values
('33000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','Event One Ticket',100,'SDG',20,2,true),
('33000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000002','Event Two Ticket',200,'SDG',20,2,true);

insert into public.bookings(id,booking_number,user_id,customer_name,customer_phone,event_id,subtotal,currency,status) values
('43000000-0000-4000-8000-000000000001','AUTH-BOOKING-ONE','13000000-0000-4000-8000-000000000001','Authorization Customer','0913000001','23000000-0000-4000-8000-000000000001',100,'SDG','under_review'),
('43000000-0000-4000-8000-000000000002','AUTH-BOOKING-TWO','13000000-0000-4000-8000-000000000002','Authorization Other','0913000002','23000000-0000-4000-8000-000000000002',200,'SDG','under_review'),
('43000000-0000-4000-8000-000000000003','AUTH-TICKET-ONE','13000000-0000-4000-8000-000000000001','Authorization Customer','0913000001','23000000-0000-4000-8000-000000000001',100,'SDG','confirmed'),
('43000000-0000-4000-8000-000000000004','AUTH-TICKET-TWO','13000000-0000-4000-8000-000000000002','Authorization Other','0913000002','23000000-0000-4000-8000-000000000002',200,'SDG','confirmed');

-- Keep the second event unpublished during authorization checks after creating valid historical fixtures.
update public.events set status='draft' where id='23000000-0000-4000-8000-000000000002';

insert into public.booking_items(id,booking_id,ticket_type_id,quantity,unit_price,line_total) values
('53000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001',1,100,100),
('53000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000002','33000000-0000-4000-8000-000000000002',1,200,200),
('53000000-0000-4000-8000-000000000003','43000000-0000-4000-8000-000000000003','33000000-0000-4000-8000-000000000001',1,100,100),
('53000000-0000-4000-8000-000000000004','43000000-0000-4000-8000-000000000004','33000000-0000-4000-8000-000000000002',1,200,200);

insert into public.payment_submissions(id,booking_id,submitted_by,amount,currency,status) values
('63000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000001',100,'SDG','submitted'),
('63000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000002','13000000-0000-4000-8000-000000000002',200,'SDG','submitted');

insert into public.tickets(id,booking_item_id,booking_id,event_id,ticket_type_id,ticket_code,attendee_name,status) values
('73000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000003','43000000-0000-4000-8000-000000000003','23000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','8130000001','Authorization Customer','valid'),
('73000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000004','43000000-0000-4000-8000-000000000004','23000000-0000-4000-8000-000000000002','33000000-0000-4000-8000-000000000002','8130000002','Authorization Other','valid');

-- Customer: ownership only; no privileged RPCs.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);

select is((select count(*)::integer from public.profiles),1,'Customer can read only their own profile');
select is((select count(*)::integer from public.bookings),2,'Customer can read only their own bookings');
select throws_ok(
  $$select public.review_payment_submission('63000000-0000-4000-8000-000000000001','reject','not authorized')$$,
  'P0001','غير مصرح لك بمراجعة المدفوعات','Customer cannot review payment submissions'
);
select throws_ok(
  $$select public.admin_update_profile_role('13000000-0000-4000-8000-000000000008','supervisor','23000000-0000-4000-8000-000000000001')$$,
  'P0001','ليست لديك صلاحية تعديل أدوار المستخدمين','Customer cannot change platform roles'
);
select throws_ok(
  $$update public.profiles set role='admin' where id='13000000-0000-4000-8000-000000000001'$$,
  '42501',null,'Customer cannot directly update their own role column'
);

-- Supervisor: assigned-event review scope, read-only operational access.
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000003',true);

select is((select count(*)::integer from public.events where id='23000000-0000-4000-8000-000000000001'),1,'Supervisor can read the assigned event');
select is((select count(*)::integer from public.events where id='23000000-0000-4000-8000-000000000002'),0,'Supervisor cannot read an unassigned draft event');
select is((select count(*)::integer from public.bookings),2,'Supervisor can read bookings for the assigned event only');
select is((select count(*)::integer from public.payment_submissions),1,'Supervisor can read payment submissions for the assigned event only');
select is((select count(*)::integer from public.profiles where id<>'13000000-0000-4000-8000-000000000003'),0,'Supervisor cannot read other users profiles');
select is((with changed as (update public.events set description='unauthorized supervisor edit' where id='23000000-0000-4000-8000-000000000001' returning 1) select count(*)::integer from changed),0,'Supervisor cannot edit event details');
select is((with changed as (update public.ticket_types set price=999 where id='33000000-0000-4000-8000-000000000001' returning 1) select count(*)::integer from changed),0,'Supervisor cannot edit ticket types');
select lives_ok(
  $$select public.review_payment_submission('63000000-0000-4000-8000-000000000001','reject','Assigned event test rejection')$$,
  'Supervisor can review a payment for their assigned event'
);
select throws_ok(
  $$select public.review_payment_submission('63000000-0000-4000-8000-000000000002','reject','Unassigned event test rejection')$$,
  'P0001','لا تملك تكليفاً لمراجعة حجوزات هذه الفعالية','Supervisor cannot review payment for an unassigned event'
);
select is((select count(*)::integer from public.tickets where event_id='23000000-0000-4000-8000-000000000002'),0,'Supervisor cannot read tickets from an unassigned event');

-- Gatekeeper: no booking/payment access and event-scoped ticket access/check-in.
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000004',true);

select is((select count(*)::integer from public.bookings),0,'Gatekeeper cannot read customer bookings');
select is((select count(*)::integer from public.payment_submissions),0,'Gatekeeper cannot read payment submissions');
select is((select count(*)::integer from public.tickets where event_id='23000000-0000-4000-8000-000000000001'),1,'Gatekeeper can read tickets for the assigned event');
select is((select count(*)::integer from public.tickets where event_id='23000000-0000-4000-8000-000000000002'),0,'Gatekeeper cannot read tickets from an unassigned event');
select throws_ok(
  $$insert into public.checkins(ticket_id,event_id,checked_in_by) values ('73000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000002','13000000-0000-4000-8000-000000000004')$$,
  '42501',null,'Gatekeeper cannot bypass event assignment with a direct check-in insert'
);
select throws_ok(
  $$select public.gatekeeper_ticket_action('8130000002',false)$$,
  'P0001','هذه التذكرة لا تخص الفعالية المصرح لك بها','Gatekeeper scanner rejects a ticket from another event'
);

-- Advertiser: only the assigned event's aggregate statistics, not raw customer data.
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000005',true);

select is((private.get_advertiser_event_statistics()->'event'->>'id')::uuid,'23000000-0000-4000-8000-000000000001'::uuid,'Advertiser statistics are restricted to the assigned event');
select is((select count(*)::integer from public.bookings),0,'Advertiser cannot read raw booking records');
select is((select count(*)::integer from public.payment_submissions),0,'Advertiser cannot read payment submissions');
select throws_ok(
  $$select public.admin_update_profile_role('13000000-0000-4000-8000-000000000008','customer',null)$$,
  'P0001','ليست لديك صلاحية تعديل أدوار المستخدمين','Advertiser cannot change user roles'
);

-- Admin: platform-wide operational access, but cannot promote another admin.
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000006',true);

select is((select count(*)::integer from public.bookings),4,'Admin can read platform-wide bookings');
select is((select count(*)::integer from public.profiles),8,'Admin can read platform user profiles');
select is((with changed as (update public.events set description='admin authorized edit' where id='23000000-0000-4000-8000-000000000001' returning 1) select count(*)::integer from changed),1,'Admin can edit event details');
select throws_ok(
  $$select public.admin_update_profile_role('13000000-0000-4000-8000-000000000008','admin',null)$$,
  'P0001','تعيين المشرف الإداري من صلاحيات مالك المنصة فقط','Admin cannot promote a user to admin'
);

-- Owner: may promote an admin, but cannot modify their own protected account.
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"13000000-0000-4000-8000-000000000007","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000007',true);

select lives_ok(
  $$select public.admin_update_profile_role('13000000-0000-4000-8000-000000000008','admin',null)$$,
  'Owner can promote a user to admin'
);
select is((select role from public.profiles where id='13000000-0000-4000-8000-000000000008'),'admin','Owner promotion updates the target role');
select throws_ok(
  $$select public.admin_update_profile_role('13000000-0000-4000-8000-000000000007','customer',null)$$,
  'P0001','لا يمكنك تغيير دور حسابك الحالي','Owner cannot change their own role'
);

select * from finish();
rollback;
