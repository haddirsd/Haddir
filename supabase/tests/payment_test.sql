begin;

select plan(20);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, phone
) values
(
  '11000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'payment-customer@example.com', '',
  now(), '{"provider":"email","providers":["email"]}',
  '{"full_name":"Payment Test Customer"}', now(), now(), '0911111111'
),
(
  '11000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'payment-other@example.com', '',
  now(), '{"provider":"email","providers":["email"]}',
  '{"full_name":"Other Payment Customer"}', now(), now(), '0922222222'
),
(
  '11000000-0000-4000-8000-000000000003',
  'authenticated', 'authenticated', 'payment-admin@example.com', '',
  now(), '{"provider":"email","providers":["email"]}',
  '{"full_name":"Payment Test Admin"}', now(), now(), '0933333333'
);

insert into public.profiles (id, full_name, phone, role)
values
  ('11000000-0000-4000-8000-000000000001', 'Payment Test Customer', '0911111111', 'customer'),
  ('11000000-0000-4000-8000-000000000002', 'Other Payment Customer', '0922222222', 'customer'),
  ('11000000-0000-4000-8000-000000000003', 'Payment Test Admin', '0933333333', 'admin')
on conflict (id) do update
set full_name = excluded.full_name,
    phone = excluded.phone,
    role = excluded.role;

insert into public.events (
  id, title, slug, starts_at, ends_at, status, created_by
) values (
  '21000000-0000-4000-8000-000000000001',
  'Payment Integration Test', 'payment-integration-test',
  now() + interval '2 days', now() + interval '3 days',
  'published', '11000000-0000-4000-8000-000000000001'
);

insert into public.ticket_types (
  id, event_id, name, price, currency, quantity_total, quantity_sold, is_active
) values (
  '31000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001',
  'Payment Test Ticket', 100, 'SDG', 10, 0, true
);

insert into public.event_payment_accounts (
  id, event_id, account_name, account_number, beneficiary, sort_order, is_active
) values (
  'payment-test-account',
  '21000000-0000-4000-8000-000000000001',
  'Payment Test Bank', '123456789', 'Payment Test Beneficiary', 1, true
);

create temporary table payment_test_ids (
  approval_booking_id uuid,
  rejection_booking_id uuid,
  expired_booking_id uuid,
  approval_submission_id uuid,
  rejection_submission_id uuid,
  approval_result jsonb
);
grant all on payment_test_ids to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);

insert into payment_test_ids (approval_booking_id)
select booking_id
from public.create_booking(
  '21000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  2
);

insert into payment_test_ids (rejection_booking_id)
select booking_id
from public.create_booking(
  '21000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  1
);

insert into payment_test_ids (expired_booking_id)
select booking_id
from public.create_booking(
  '21000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  1
);

reset role;

update public.bookings
set expires_at = now() - interval '1 minute'
where id = (select expired_booking_id from payment_test_ids);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);

select lives_ok(
  format(
    'insert into storage.objects (bucket_id, name) values (%L, %L)',
    'payment-receipts',
    '11000000-0000-4000-8000-000000000001/' ||
      (select approval_booking_id::text from payment_test_ids) ||
      '/receipt-approval.png'
  ),
  'Customer can upload a receipt into their own active booking folder'
);

select throws_ok(
  format(
    'insert into storage.objects (bucket_id, name) values (%L, %L)',
    'payment-receipts',
    '11000000-0000-4000-8000-000000000002/' ||
      (select approval_booking_id::text from payment_test_ids) ||
      '/receipt-forged.png'
  ),
  '42501',
  null,
  'Customer cannot upload a receipt under another customer folder'
);

select lives_ok(
  format(
    'insert into storage.objects (bucket_id, name) values (%L, %L)',
    'payment-receipts',
    '11000000-0000-4000-8000-000000000001/' ||
      (select rejection_booking_id::text from payment_test_ids) ||
      '/receipt-rejection.png'
  ),
  'Customer can upload a receipt for a second active booking'
);

select throws_ok(
  format(
    'select public.submit_payment(%L, %L, %L, %L)',
    (select approval_booking_id from payment_test_ids),
    'payment-test-account',
    'invalid/path/receipt.png',
    'TEST-INVALID-PATH'
  ),
  'P0001',
  'مسار الإيصال غير صالح',
  'Payment submission rejects a receipt path outside the authenticated customer and booking folders'
);

select throws_ok(
  format(
    'select public.submit_payment(%L, %L, %L, %L)',
    (select approval_booking_id from payment_test_ids),
    'missing-payment-account',
    '11000000-0000-4000-8000-000000000001/' ||
      (select approval_booking_id::text from payment_test_ids) ||
      '/receipt-approval.png',
    'TEST-WRONG-ACCOUNT'
  ),
  'P0001',
  'حساب الدفع غير متاح لهذه الفعالية',
  'Payment submission rejects an account that is not configured for the booking event'
);

select throws_ok(
  format(
    'select public.submit_payment(%L, %L, %L, %L)',
    (select approval_booking_id from payment_test_ids),
    'payment-test-account',
    '11000000-0000-4000-8000-000000000001/' ||
      (select approval_booking_id::text from payment_test_ids) ||
      '/receipt-missing.png',
    'TEST-MISSING-RECEIPT'
  ),
  'P0001',
  'لم يتم العثور على الإيصال المرفوع',
  'Payment submission rejects a receipt that does not exist in private storage'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000002', true);

select throws_ok(
  format(
    'select public.submit_payment(%L, %L, %L, %L)',
    (select approval_booking_id from payment_test_ids),
    'payment-test-account',
    '11000000-0000-4000-8000-000000000002/' ||
      (select approval_booking_id::text from payment_test_ids) ||
      '/receipt-owner-mismatch.png',
    'TEST-OTHER-USER'
  ),
  'P0001',
  'الحجز غير موجود',
  'A different customer cannot submit payment for another customer booking'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);

select lives_ok(
  format(
    'update payment_test_ids set approval_submission_id = public.submit_payment(%L, %L, %L, %L)',
    (select approval_booking_id from payment_test_ids),
    'payment-test-account',
    '11000000-0000-4000-8000-000000000001/' ||
      (select approval_booking_id::text from payment_test_ids) ||
      '/receipt-approval.png',
    'TEST-APPROVAL'
  ),
  'Customer can submit a valid payment receipt for their own booking'
);

reset role;

select is(
  (select status from public.bookings where id = (select approval_booking_id from payment_test_ids)),
  'under_review',
  'A successful payment submission moves the booking to under_review'
);

select is(
  (select payment_account_beneficiary from public.payment_submissions where id = (select approval_submission_id from payment_test_ids)),
  'Payment Test Beneficiary',
  'Payment submission stores an immutable snapshot of the event payment beneficiary'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);

select throws_ok(
  format(
    'select public.submit_payment(%L, %L, %L, %L)',
    (select approval_booking_id from payment_test_ids),
    'payment-test-account',
    '11000000-0000-4000-8000-000000000001/' ||
      (select approval_booking_id::text from payment_test_ids) ||
      '/receipt-approval.png',
    'TEST-DUPLICATE'
  ),
  'P0001',
  'انتهت مهلة الحجز أو تم إرسال إثبات دفع مسبقاً',
  'Customer cannot submit a second payment receipt for the same booking'
);

select throws_ok(
  format(
    'select public.submit_payment(%L, %L, %L, %L)',
    (select expired_booking_id from payment_test_ids),
    'payment-test-account',
    '11000000-0000-4000-8000-000000000001/' ||
      (select expired_booking_id::text from payment_test_ids) ||
      '/receipt-expired.png',
    'TEST-EXPIRED'
  ),
  'P0001',
  'انتهت مهلة الحجز أو تم إرسال إثبات دفع مسبقاً',
  'Customer cannot submit payment after the booking payment deadline'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000003', true);

select lives_ok(
  format(
    'update payment_test_ids set rejection_submission_id = public.submit_payment(%L, %L, %L, %L)',
    (select rejection_booking_id from payment_test_ids),
    'payment-test-account',
    '11000000-0000-4000-8000-000000000001/' ||
      (select rejection_booking_id::text from payment_test_ids) ||
      '/receipt-rejection.png',
    'TEST-ADMIN-CREATE'
  ),
  'Admin-context setup can submit the rejection fixture through the payment RPC'
);

select throws_ok(
  format(
    'select public.review_payment_submission(%L, %L, %L)',
    (select approval_submission_id from payment_test_ids),
    'approve',
    null
  ),
  'P0001',
  'غير مصرح لك بمراجعة المدفوعات',
  'A customer-role account cannot review payment submissions'
);

reset role;

select throws_ok(
  format(
    'select public.review_payment_submission(%L, %L, %L)',
    (select approval_submission_id from payment_test_ids),
    'reject',
    ''
  ),
  'P0001',
  'اكتب سبب رفض إثبات الدفع',
  'Payment rejection requires a non-empty reason'
);

select lives_ok(
  format(
    'update payment_test_ids set approval_result = public.review_payment_submission(%L, %L, %L)',
    (select approval_submission_id from payment_test_ids),
    'approve',
    null
  ),
  'Authorized admin can approve a submitted payment'
);

select is(
  (select status from public.bookings where id = (select approval_booking_id from payment_test_ids)),
  'confirmed',
  'Approving payment confirms the booking'
);

select is(
  (select status from public.payment_submissions where id = (select approval_submission_id from payment_test_ids)),
  'approved',
  'Approving payment marks the payment submission as approved'
);

select is(
  (select count(*)::integer from public.tickets where booking_id = (select approval_booking_id from payment_test_ids)),
  2,
  'Approving payment issues exactly one ticket per attendee'
);

select throws_ok(
  format(
    'select public.review_payment_submission(%L, %L, %L)',
    (select approval_submission_id from payment_test_ids),
    'approve',
    null
  ),
  'P0001',
  'تمت مراجعة إثبات الدفع مسبقاً',
  'An already reviewed payment cannot be reviewed a second time'
);

select lives_ok(
  format(
    'select public.review_payment_submission(%L, %L, %L)',
    (select rejection_submission_id from payment_test_ids),
    'reject',
    'إيصال غير واضح'
  ),
  'Authorized admin can reject a submitted payment with a reason'
);

select is(
  (select status from public.bookings where id = (select rejection_booking_id from payment_test_ids)),
  'rejected',
  'Rejecting payment marks the booking as rejected'
);

select is(
  (select quantity_sold from public.ticket_types where id = '31000000-0000-4000-8000-000000000001'),
  2,
  'Rejecting payment releases the reserved ticket inventory'
);

select * from finish();
rollback;
