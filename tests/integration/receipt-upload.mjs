import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testBaseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

for (const [name, value] of Object.entries({ url, anonKey, serviceRoleKey })) {
  assert.ok(value, `Missing required environment variable: ${name}`);
}


const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const suffix = randomUUID();
const password = `Haddir-Receipt-Test-${randomUUID()}-Aa1!`;
const eventId = randomUUID();
const ticketTypeId = randomUUID();
const users = [];
const uploadedPaths = [];
let eventCreated = false;

async function requireNoError(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

async function createCustomer(index) {
  const email = `receipt-upload-${index}-${suffix}@example.test`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Receipt Upload Customer ${index}` },
  });
  const data = await requireNoError(created, "Create isolated receipt test user");
  const user = data?.user ?? data;
  assert.ok(user?.id, "Auth must return the created test user");
  users.push({ id: user.id, email });

  await requireNoError(
    await admin.from("profiles").upsert({
      id: user.id,
      full_name: `Receipt Upload Customer ${index}`,
      phone: `09${String(Date.now()).slice(-7)}${index}`,
    }),
    "Prepare receipt test customer profile",
  );

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await requireNoError(
    await client.auth.signInWithPassword({ email, password }),
    "Sign in receipt test customer",
  );
  assert.ok(signedIn.session?.access_token, "Customer session must include an access token");
  return { id: user.id, client, token: signedIn.session.access_token };
}

async function createBooking(customer) {
  const result = await requireNoError(
    await customer.client.rpc("create_booking", {
      p_event_id: eventId,
      p_ticket_type_id: ticketTypeId,
      p_quantity: 1,
    }),
    "Create receipt test booking",
  );
  const bookingId = Array.isArray(result)
    ? result[0]?.booking_id ?? result[0]?.id
    : result?.booking_id ?? result?.id ?? result;
  assert.match(String(bookingId), /^[0-9a-f-]{36}$/i, "Booking RPC must return a booking UUID");
  return String(bookingId);
}

async function callUpload(token, bookingId, file) {
  const form = new FormData();
  if (bookingId !== undefined) form.set("bookingId", bookingId);
  if (file !== undefined) form.set("receipt", file);

  const headers = {};
  if (token !== null) headers.authorization = token ? `Bearer ${token}` : "";

  const response = await fetch(`${testBaseUrl}/api/booking/receipt`, {
    method: "POST",
    headers,
    body: form,
  });
  return { response, body: await response.json() };
}

function pngFile(name = "receipt.png") {
  // A minimal PNG signature is sufficient for exercising the upload route and Storage transport.
  return new File(
    [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])],
    name,
    { type: "image/png" },
  );
}

try {
  const customer = await createCustomer(1);
  const otherCustomer = await createCustomer(2);

  await requireNoError(
    await admin.from("events").insert({
      id: eventId,
      title: "Receipt Upload HTTP Integration Test",
      slug: `receipt-upload-${suffix}`,
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 172_800_000).toISOString(),
      status: "published",
      created_by: customer.id,
    }),
    "Create isolated receipt test event",
  );
  eventCreated = true;

  await requireNoError(
    await admin.from("ticket_types").insert({
      id: ticketTypeId,
      event_id: eventId,
      name: "Receipt Test Ticket",
      price: 100,
      currency: "SDG",
      quantity_total: 10,
      quantity_sold: 0,
      is_active: true,
    }),
    "Create receipt test ticket inventory",
  );

  const validBookingId = await createBooking(customer);
  const expiredBookingId = await createBooking(customer);
  const reviewedBookingId = await createBooking(customer);
  const otherBookingId = await createBooking(otherCustomer);

  await requireNoError(
    await admin.from("bookings").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", expiredBookingId),
    "Expire receipt test booking",
  );
  await requireNoError(
    await admin.from("bookings").update({ status: "under_review" }).eq("id", reviewedBookingId),
    "Move receipt test booking out of pending_payment",
  );

  // Authentication and request validation.
  let result = await callUpload(null, validBookingId, pngFile());
  assert.equal(result.response.status, 401, "Missing authorization must return 401");

  result = await callUpload("invalid-access-token", validBookingId, pngFile());
  assert.equal(result.response.status, 401, "Invalid access token must return 401");

  result = await callUpload(customer.token, "not-a-uuid", pngFile());
  assert.equal(result.response.status, 400, "Malformed booking ID must return 400");

  result = await callUpload(customer.token, validBookingId);
  assert.equal(result.response.status, 400, "Missing receipt must return 400");

  result = await callUpload(
    customer.token,
    validBookingId,
    new File(["not an image"], "receipt.pdf", { type: "application/pdf" }),
  );
  assert.equal(result.response.status, 400, "Unsupported MIME type must return 400");

  result = await callUpload(
    customer.token,
    validBookingId,
    new File([], "empty.png", { type: "image/png" }),
  );
  assert.equal(result.response.status, 400, "Empty receipt must return 400");

  result = await callUpload(
    customer.token,
    validBookingId,
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
  );
  assert.equal(result.response.status, 400, "Receipt larger than 5 MiB must return 400");

  // Storage RLS must reject ownership, expiry, and booking-state violations through the API.
  result = await callUpload(customer.token, otherBookingId, pngFile("wrong-owner.png"));
  assert.equal(result.response.status, 403, "Customer cannot upload against another customer's booking");

  result = await callUpload(customer.token, expiredBookingId, pngFile("expired.png"));
  assert.equal(result.response.status, 403, "Expired booking cannot accept a receipt");

  result = await callUpload(customer.token, reviewedBookingId, pngFile("already-reviewed.png"));
  assert.equal(result.response.status, 403, "Non-pending booking cannot accept a receipt");

  // A valid upload must pass through the real route and persist in the private bucket.
  result = await callUpload(customer.token, validBookingId, pngFile());
  assert.equal(result.response.status, 200, `Valid receipt upload must succeed: ${JSON.stringify(result.body)}`);
  assert.ok(typeof result.body.path === "string", "Successful response must return the storage path");
  assert.match(
    result.body.path,
    new RegExp(`^${customer.id}/${validBookingId}/[^/]+\\.png$`),
    "Stored path must be scoped to the authenticated customer and booking",
  );
  uploadedPaths.push(result.body.path);

  const storedFile = await requireNoError(
    await admin.storage.from("payment-receipts").download(result.body.path),
    "Verify uploaded receipt exists in private Storage",
  );
  assert.equal(storedFile.size, 8, "Stored receipt must contain the uploaded file bytes");

  console.log("PASS: receipt upload API authentication, validation, Storage authorization, and real file persistence.");
} finally {
  if (uploadedPaths.length) {
    await admin.storage.from("payment-receipts").remove(uploadedPaths);
  }
  if (eventCreated) {
    await admin.from("events").delete().eq("id", eventId);
  }
  for (const user of users) {
    await admin.auth.admin.deleteUser(user.id);
  }
}
