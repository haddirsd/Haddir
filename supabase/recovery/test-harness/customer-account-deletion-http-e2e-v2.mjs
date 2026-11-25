import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const base = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DB_URL;
if (!base || !anon || !service || !dbUrl) throw new Error('Missing local Supabase test connection or API secrets');

async function call(path, { method = 'GET', token, body, headers = {} } = {}) {
  const h = { apikey: anon, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers };
  let payload = body;
  if (body !== undefined && !Buffer.isBuffer(body)) {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const r = await fetch(base + path, { method, headers: h, body: payload });
  const raw = await r.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { status: r.status, data, raw };
}
function ok(test, message) {
  if (!test) throw new Error('FAIL: ' + message);
  console.log('PASS:', message);
}
function seedOk(response, acceptedStatuses, message) {
  if (acceptedStatuses.includes(response.status)) {
    console.log('PASS:', message);
    return;
  }
  console.error('FAIL:', message);
  console.error('HTTP status:', response.status);
  console.error('Response body:', response.raw);
  if (response.data && typeof response.data === 'object') {
    console.error('code:', response.data.code ?? null);
    console.error('message:', response.data.message ?? null);
    console.error('details:', response.data.details ?? null);
    console.error('hint:', response.data.hint ?? null);
  }
  throw new Error(message + ' failed');
}
(async () => {
  const email = 'deletion-e2e-' + crypto.randomUUID() + '@example.com';
  const password = crypto.randomBytes(24).toString('base64url') + 'Aa1!';
  const eventId = crypto.randomUUID();
  const bookingId = crypto.randomUUID();
  let uid;
  let jwt;
  let receiptPath;
  const created = await call('/auth/v1/admin/users', {
    method: 'POST', token: service,
    body: { email, password, email_confirm: true, user_metadata: { full_name: 'Deletion E2E', phone: '0000000000' } }
  });
  seedOk(created, [200, 201], 'create disposable Auth user');
  if (!created.data?.id) throw new Error('Auth user creation response did not contain an id');
  uid = created.data.id;

  const profile = await call('/rest/v1/profiles?id=eq.' + uid + '&select=id,role', {
    token: service
  });
  const profileRow = Array.isArray(profile.data) ? profile.data[0] : null;
  if (profile.status !== 200 || !profileRow || profileRow.id !== uid || profileRow.role !== 'customer') {
    console.error('FAIL: verify automatically created customer profile');
    console.error('HTTP status:', profile.status);
    console.error('Response body:', profile.raw);
    if (profile.data && typeof profile.data === 'object' && !Array.isArray(profile.data)) {
      console.error('code:', profile.data.code ?? null);
      console.error('message:', profile.data.message ?? null);
      console.error('details:', profile.data.details ?? null);
      console.error('hint:', profile.data.hint ?? null);
    }
    throw new Error('automatically created customer profile verification failed');
  }
  console.log('PASS: verify automatically created customer profile and role=customer');

  const event = await call('/rest/v1/events', {
    method: 'POST', token: service, headers: { Prefer: 'return=minimal' },
    body: {
      id: eventId,
      title: 'CI deletion test event',
      slug: 'ci-deletion-test-' + eventId,
      created_by: null,
      starts_at: new Date(Date.now() - 86400000).toISOString(),
      ends_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'published'
    }
  });
  seedOk(event, [201, 204], 'seed past event');

  const booking = await call('/rest/v1/bookings', {
    method: 'POST', token: service, headers: { Prefer: 'return=minimal' },
    body: {
      id: bookingId,
      booking_number: 'CI-' + bookingId,
      user_id: uid,
      event_id: eventId,
      status: 'pending_payment',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      customer_name: 'Deletion E2E',
      customer_email: email,
      customer_phone: '0000000000',
      subtotal: 0
    }
  });
  seedOk(booking, [201, 204], 'seed pending booking');

  receiptPath = uid + '/' + bookingId + '/receipt.png';
  const payment = await call('/rest/v1/payment_submissions', {
    method: 'POST', token: service, headers: { Prefer: 'return=minimal' },
    body: {
      booking_id: bookingId,
      submitted_by: uid,
      receipt_path: receiptPath,
      amount: 0
    }
  });
  seedOk(payment, [201, 204], 'seed payment submission');

  const login = await call('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password }
  });
  ok(login.status === 200 && login.data?.access_token, 'obtain real Auth JWT');
  jwt = login.data.access_token;

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1sAAAAASUVORK5CYII=', 'base64');
  const uploaded = await call('/storage/v1/object/payment-receipts/' + receiptPath, {
    method: 'POST', token: jwt, body: png, headers: { 'Content-Type': 'image/png', 'x-upsert': 'false' }
  });
  ok([200, 201].includes(uploaded.status), 'upload real private Storage receipt');

  const deleted = await call('/functions/v1/delete-customer-account', {
    method: 'POST', token: jwt, body: { confirm_email: email }
  });
  if (!(deleted.status === 200 && deleted.data?.success === true)) throw new Error('FAIL: invoke customer deletion Edge Function HTTP ' + deleted.status + ': ' + JSON.stringify(deleted.data));
  console.log('PASS: invoke customer deletion Edge Function');

  const authCheck = await call('/auth/v1/admin/users/' + uid, { token: service });
  ok(authCheck.status >= 400, 'Auth user no longer exists');

  const bookingCheck = await call('/rest/v1/bookings?id=eq.' + bookingId + '&select=user_id,customer_name,customer_email,customer_phone', { token: service });
  const b = Array.isArray(bookingCheck.data) ? bookingCheck.data[0] : null;
  ok(bookingCheck.status === 200 && b && b.user_id === null && b.customer_name === 'مستخدم محذوف' && b.customer_email === null && b.customer_phone === 'محذوف',
    'booking retained and anonymized');

  const paymentCheck = await call('/rest/v1/payment_submissions?booking_id=eq.' + bookingId + '&select=submitted_by,receipt_path', { token: service });
  const p = Array.isArray(paymentCheck.data) ? paymentCheck.data[0] : null;
  ok(paymentCheck.status === 200 && p && p.submitted_by === null && p.receipt_path === null,
    'payment row anonymized');

  const storageCheck = await call('/storage/v1/object/list/payment-receipts', {
    method: 'POST', token: service,
    body: { prefix: uid + '/' + bookingId, limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } }
  });
  ok(storageCheck.status === 200 && Array.isArray(storageCheck.data) && storageCheck.data.length === 0,
    'physical receipt object removed');

  const cleanupRecordCheck = execFileSync('psql', [
    dbUrl,
    '-X',
    '-v', 'ON_ERROR_STOP=1',
    '-v', `user_id=${uid}`,
    '-Atc',
    "select exists (select 1 from private.customer_account_deletion_cleanup where user_id = :'user_id'::uuid and cardinality(receipt_paths) = 0)"
  ], { encoding: 'utf8' }).trim();
  ok(cleanupRecordCheck === 't', 'local cleanup tombstone retained with no receipt paths');

  const stale = await call('/rest/v1/bookings', {
    method: 'POST', token: jwt, headers: { Prefer: 'return=minimal' },
    body: { id: crypto.randomUUID(), user_id: uid, event_id: eventId, status: 'pending_payment',
      customer_name: 'Stale JWT', customer_phone: '0000000000' }
  });
  ok(stale.status >= 400, 'stale JWT cannot create new booking');
  console.log('RESULT: Auth + Edge Function + Storage deletion end-to-end passed');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
