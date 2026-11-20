import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  return { id: user.id, client };
}

function pngFile(name = "receipt.png", size = 8) {
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

async function uploadAs(customer, path, file) {
  return customer.client.storage.from("payment-receipts").upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600",
  });
}

try {
  const customer = await createCustomer(1);
  const otherCustomer = await createCustomer(2);

  await requireNoError(
    await admin.from("events").insert({
      id: eventId,
      title: "Receipt Upload Storage Integration Test",
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

  const createBooking = async (identity) => {
    const result = await requireNoError(
      await identity.client.rpc("create_booking", {
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
  };

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

  const validPath = `${customer.id}/${validBookingId}/${randomUUID()}.png`;
  const validUpload = await uploadAs(customer, validPath, pngFile());
  assert.equal(validUpload.error, null, `Customer must upload a receipt directly to private Storage: ${validUpload.error?.message}`);
  uploadedPaths.push(validPath);

  const storedFile = await requireNoError(
    await admin.storage.from("payment-receipts").download(validPath),
    "Verify uploaded receipt exists in private Storage",
  );
  assert.equal(storedFile.size, 8, "Stored receipt must contain the uploaded file bytes");

  const wrongOwnerPath = `${customer.id}/${validBookingId}/${randomUUID()}.png`;
  const wrongOwnerUpload = await uploadAs(otherCustomer, wrongOwnerPath, pngFile("wrong-owner.png"));
  assert.ok(wrongOwnerUpload.error, "Another customer cannot upload into a different customer's folder");

  const otherBookingPath = `${customer.id}/${otherBookingId}/${randomUUID()}.png`;
  const otherBookingUpload = await uploadAs(customer, otherBookingPath, pngFile("other-booking.png"));
  assert.ok(otherBookingUpload.error, "Customer cannot upload against another customer's booking");

  const expiredPath = `${customer.id}/${expiredBookingId}/${randomUUID()}.png`;
  const expiredUpload = await uploadAs(customer, expiredPath, pngFile("expired.png"));
  assert.ok(expiredUpload.error, "Expired booking cannot accept a receipt");

  const reviewedPath = `${customer.id}/${reviewedBookingId}/${randomUUID()}.png`;
  const reviewedUpload = await uploadAs(customer, reviewedPath, pngFile("already-reviewed.png"));
  assert.ok(reviewedUpload.error, "Non-pending booking cannot accept a receipt");

  const unsupportedPath = `${customer.id}/${validBookingId}/${randomUUID()}.pdf`;
  const unsupportedUpload = await uploadAs(
    customer,
    unsupportedPath,
    new File(["not an image"], "receipt.pdf", { type: "application/pdf" }),
  );
  assert.ok(unsupportedUpload.error, "Storage must reject unsupported receipt MIME types");

  const oversizedPath = `${customer.id}/${validBookingId}/${randomUUID()}.png`;
  const oversizedUpload = await uploadAs(
    customer,
    oversizedPath,
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
  );
  assert.ok(oversizedUpload.error, "Storage must reject receipts larger than 5 MiB");

  console.log("PASS: direct receipt upload, 5 MiB bucket limit, MIME restrictions, customer ownership, booking state, and private Storage persistence.");
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
