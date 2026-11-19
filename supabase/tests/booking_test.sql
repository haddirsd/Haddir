begin;

select plan(17);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, phone
) values
(
  '10000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'booking-test@example.com', '',
  now(), '{"provider":"email","providers":["email"]}',
  '{"full_name":"Booking Test Customer"}', now(), now(), '0912345678'
),
(
  '10000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'booking-incomplete@example.com', '',
  now(), '{"provider":"email","providers":["email"]}',
  '{"full_name":""}', now(), now(), null
);

-- Keep the booking fixture explicit and independent of auth trigger defaults.
insert into public.profiles (id, full_name, phone)
values
  ('10000000-0000-4000-8000-000000000001', 'Booking Test Customer', '0912345678'),
  ('10000000-0000-4000-8000-000000000002', '', null)
on conflict (id) do update
set full_name = excluded.full_name,
    phone = excluded.phone;

insert into public.events (
  id, title, slug, starts_at, ends_at, status, created_by
) values
(
  '20000000-0000-4000-8000-000000000001',
  'Booking Integration Test', 'booking-integration-test',
  now() + interval '1 day', now() + interval '2 days',
  'published', '10000000-0000-4000-8000-000000000001'
),
(
  '20000000-0000-4000-8000-000000000002',
  'Draft Booking Integration Test', 'draft-booking-integration-test',
  now() + interval '3 days', now() + interval '4 days',
  'draft', '10000000-0000-4000-8000-000000000001'
);

insert into public.ticket_types (
  id, event_id, name, price, currency, quantity_total, quantity_sold, is_active
) values
(
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Standard', 125, 'SDG', 5, 0, true
),
(
  '30000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001',
  'Inactive', 100, 'SDG', 5, 0, false
),
(
  '30000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000002',
  'Draft Event Ticket', 100, 'SDG', 5, 0, true
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$select * from public.create_booking(
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    2
  )$$,
  'Authenticated customer can create a booking within available inventory'
);

select is(
  (select count(*)::integer from public.bookings
   where user_id = '10000000-0000-4000-8000-000000000001'),
  1,
  'Exactly one booking is created'
);

select is(
  (select subtotal from public.bookings
   where user_id = '10000000-0000-4000-8000-000000000001'),
  250::numeric,
  'Booking subtotal is price multiplied by quantity'
);

select is(
  (select status from public.bookings
   where user_id = '10000000-0000-4000-8000-000000000001'),
  'pending_payment',
  'New booking starts in pending_payment state'
);

select ok(
  (select expires_at > now() from public.bookings
   where user_id = '10000000-0000-4000-8000-000000000001'),
  'New booking receives a future payment expiry'
);

select is(
  (select quantity_sold from public.ticket_types
   where id = '30000000-0000-4000-8000-000000000001'),
  2,
  'Ticket inventory increases by the reserved quantity'
);

select is(
  (select quantity from public.booking_items bi
   join public.bookings b on b.id = bi.booking_id
   where b.user_id = '10000000-0000-4000-8000-000000000001'),
  2,
  'Booking item stores the requested quantity'
);

select is(
  (select line_total from public.booking_items bi
   join public.bookings b on b.id = bi.booking_id
   where b.user_id = '10000000-0000-4000-8000-000000000001'),
  250::numeric,
  'Booking item line total matches the booking subtotal'
);

select matches(
  (select booking_number from public.bookings
   where user_id = '10000000-0000-4000-8000-000000000001'),
  '^HDR-[0-9]{6}-[A-F0-9]{6}$',
  'Booking receives a correctly structured Haddir booking number'
);

select throws_ok(
  $$select * from public.create_booking(
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    4
  )$$,
  'P0001',
  'الكمية المطلوبة غير متوفرة. المتاح حالياً: 3',
  'Booking cannot exceed the remaining ticket inventory'
);

select is(
  (select quantity_sold from public.ticket_types
   where id = '30000000-0000-4000-8000-000000000001'),
  2,
  'Rejected over-capacity booking does not change inventory'
);

select throws_ok(
  $$select * from public.create_booking(
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    0
  )$$,
  'P0001',
  'عدد التذاكر يجب أن يكون بين 1 و5',
  'Booking rejects a zero ticket quantity'
);

select throws_ok(
  $$select * from public.create_booking(
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    6
  )$$,
  'P0001',
  'عدد التذاكر يجب أن يكون بين 1 و5',
  'Booking rejects a quantity above the per-booking limit'
);

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select * from public.create_booking(
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    1
  )$$,
  'P0001',
  'يجب تسجيل الدخول لإتمام الحجز',
  'Unauthenticated requests cannot create bookings'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select throws_ok(
  $$select * from public.create_booking(
    '20000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    1
  )$$,
  'P0001',
  'الفعالية غير متاحة للحجز',
  'Bookings cannot be created for unpublished events'
);

select throws_ok(
  $$select * from public.create_booking(
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    1
  )$$,
  'P0001',
  'فئة التذكرة غير متاحة',
  'Bookings cannot use inactive ticket types'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

select throws_ok(
  $$select * from public.create_booking(
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    1
  )$$,
  'P0001',
  'أكمل اسمك ورقم هاتفك في الملف الشخصي قبل الحجز',
  'Booking requires a complete customer profile'
);

select * from finish();
rollback;
