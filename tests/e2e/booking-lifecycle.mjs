import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";

for (const [name, value] of Object.entries({ url, anonKey, serviceRoleKey })) {
  assert.ok(value, `Missing required environment variable: ${name}`);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const suffix = randomUUID();
const password = `Haddir-E2E-${randomUUID()}-Aa1!`;
const eventId = randomUUID();
const ticketTypeId = randomUUID();
const paymentAccountId = randomUUID();
const users = [];
const uploadedPaths = [];
let eventCreated = false;

async function dataOrThrow(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

async function createIdentity(label, role) {
  const email = `e2e-${label}-${suffix}@example.test`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Haddir E2E ${label}` },
  });
  const user = (await dataOrThrow(created, `Create ${label} identity`)).user;
  assert.ok(user?.id, `Supabase Auth must create the ${label} identity`);
  users.push({ id: user.id, email });

  const phone = `09${String(Date.now()).slice(-7)}${users.length}`;
  await dataOrThrow(
    await admin.from("profiles").upsert({
      id: user.id,
      full_name: `Haddir E2E ${label}`,
      phone,
      role,
    }),
    `Create ${label} profile`,
  );

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const session = await dataOrThrow(
    await client.auth.signInWithPassword({ email, password }),
    `Authenticate ${label} through Supabase Auth`,
  );
  assert.ok(session.session?.access_token, `${label} must receive an authenticated session`);
  return { id: user.id, email, client, accessToken: session.session.access_token };
}

function receiptFile() {
  return new File(
    [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])],
    "e2e-transfer-receipt.png",
    { type: "image/png" },
  );
}

try {
  const customer = await createIdentity("customer", "customer");
  const reviewer = await createIdentity("reviewer", "admin");
  const gatekeeper = await createIdentity("gatekeeper", "gatekeeper");

  await dataOrThrow(
    await admin.from("events").insert({
      id: eventId,
      title: "Haddir Complete Booking E2E",
      slug: `haddir-e2e-${suffix}`,
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 172_800_000).toISOString(),
      status: "published",
      created_by: reviewer.id,
      venue: "E2E Test Venue",
      city: "Khartoum",
    }),
    "Create isolated published event",
  );
  eventCreated = true;

  await dataOrThrow(
    await admin.from("ticket_types").insert({
      id: ticketTypeId,
      event_id: eventId,
      name: "E2E Standard Ticket",
      price: 250,
      currency: "SDG",
      quantity_total: 5,
      quantity_sold: 0,
      is_active: true,
    }),
    "Create event ticket inventory",
  );

  await dataOrThrow(
    await admin.from("event_payment_accounts").insert({
      id: paymentAccountId,
      event_id: eventId,
      account_name: "E2E Bank Transfer",
      account_number: "123456789",
      beneficiary: "Haddir E2E Beneficiary",
      sort_order: 1,
      is_active: true,
    }),
    "Create event-specific payment account",
  );

  await dataOrThrow(
    await admin.from("event_role_assignments").insert({
      user_id: gatekeeper.id,
      event_id: eventId,
      assignment_role: "gatekeeper",
    }),
    "Assign gatekeeper to the test event",
  );

  // Public discovery: the published event and its active event-specific payment account are visible.
  const publicClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const visibleEvents = await dataOrThrow(
    await publicClient.from("events").select("id,title,status").eq("id", eventId).eq("status", "published"),
    "Read published event through public client",
  );
  assert.equal(visibleEvents.length, 1, "Published event must be discoverable without privileged credentials");
  const visibleAccounts = await dataOrThrow(
    await customer.client.from("event_payment_accounts")
      .select("id,account_name,account_number,beneficiary")
      .eq("event_id", eventId).eq("is_active", true),
    "Load event-specific payment methods as customer",
  );
  assert.equal(visibleAccounts.length, 1, "Customer must see the payment account configured for this event");
  assert.equal(visibleAccounts[0].id, paymentAccountId);

  // Customer creates a real booking through the production RPC contract.
  const createdBooking = await dataOrThrow(
    await customer.client.rpc("create_booking", {
      p_event_id: eventId,
      p_ticket_type_id: ticketTypeId,
      p_quantity: 1,
    }),
    "Create customer booking",
  );
  const booking = Array.isArray(createdBooking) ? createdBooking[0] : createdBooking;
  assert.ok(booking?.booking_id, "Booking RPC must return a booking ID");
  assert.equal(Number(booking.subtotal), 250, "Booking subtotal must match the selected ticket price");
  const bookingId = booking.booking_id;

  const bookingItems = await dataOrThrow(
    await customer.client.from("booking_items")
      .select("id,quantity,unit_price,line_total")
      .eq("booking_id", bookingId),
    "Read customer's booking items",
  );
  assert.equal(bookingItems.length, 1);
  assert.equal(bookingItems[0].quantity, 1);
  assert.equal(Number(bookingItems[0].line_total), 250);

  // Upload the transfer receipt through the actual Next.js HTTP endpoint.
  const form = new FormData();
  form.set("bookingId", bookingId);
  form.set("receipt", receiptFile());
  const uploadResponse = await fetch(`${baseUrl}/api/booking/receipt`, {
    method: "POST",
    headers: { Authorization: `Bearer ${customer.accessToken}` },
    body: form,
  });
  const uploadBody = await uploadResponse.json();
  assert.equal(uploadResponse.status, 200, `Receipt upload must succeed: ${JSON.stringify(uploadBody)}`);
  assert.match(
    uploadBody.path,
    new RegExp(`^${customer.id}/${bookingId}/[^/]+\\.png$`),
    "Receipt storage path must be scoped to the customer and booking",
  );
  uploadedPaths.push(uploadBody.path);
  const storedReceipt = await dataOrThrow(
    await admin.storage.from("payment-receipts").download(uploadBody.path),
    "Verify receipt persisted in private Storage",
  );
  assert.equal(storedReceipt.size, 8, "Stored receipt must preserve uploaded bytes");

  // Customer submits payment against the selected event account.
  const submissionId = await dataOrThrow(
    await customer.client.rpc("submit_payment", {
      p_booking_id: bookingId,
      p_payment_method_id: paymentAccountId,
      p_receipt_path: uploadBody.path,
      p_transfer_reference: "E2E-TRANSFER-001",
    }),
    "Submit payment for review",
  );
  assert.ok(submissionId, "Payment submission must return its identifier");

  const pendingBooking = await dataOrThrow(
    await admin.from("bookings").select("status").eq("id", bookingId).single(),
    "Verify booking enters review state",
  );
  assert.equal(pendingBooking.status, "under_review");
  const pendingPayment = await dataOrThrow(
    await admin.from("payment_submissions").select("status,receipt_path,payment_account_name")
      .eq("id", submissionId).single(),
    "Verify submitted payment and account snapshot",
  );
  assert.equal(pendingPayment.status, "submitted");
  assert.equal(pendingPayment.receipt_path, uploadBody.path);
  assert.equal(pendingPayment.payment_account_name, "E2E Bank Transfer");

  // Authorized reviewer approves payment; the database issues the ticket.
  const reviewResult = await dataOrThrow(
    await reviewer.client.rpc("review_payment_submission", {
      p_submission_id: submissionId,
      p_decision: "approve",
      p_rejection_reason: null,
    }),
    "Approve payment and issue ticket",
  );
  assert.equal(reviewResult.success, true);
  assert.equal(reviewResult.tickets_created, 1);

  const customerTickets = await dataOrThrow(
    await customer.client.from("tickets")
      .select("id,ticket_code,status,events(title),ticket_types(name),bookings!inner(booking_number,user_id)")
      .eq("booking_id", bookingId)
      .eq("bookings.user_id", customer.id),
    "Load issued ticket through customer account access",
  );
  assert.equal(customerTickets.length, 1, "Customer must see the issued ticket");
  assert.equal(customerTickets[0].status, "valid");
  assert.match(customerTickets[0].ticket_code, /^[0-9]{10}$/, "Issued ticket must contain a 10-digit entry code");
  assert.equal(customerTickets[0].events.title, "Haddir Complete Booking E2E");
  assert.equal(customerTickets[0].ticket_types.name, "E2E Standard Ticket");

  const approvedNotifications = await dataOrThrow(
    await customer.client.from("notifications")
      .select("id,type,booking_id")
      .eq("user_id", customer.id)
      .eq("booking_id", bookingId)
      .eq("type", "ticket_approved"),
    "Verify customer receives ticket approval notification",
  );
  assert.equal(approvedNotifications.length, 1, "Ticket approval must notify the customer");

  // Assigned gatekeeper validates and confirms entry through the real scanner RPC.
  const checkin = await dataOrThrow(
    await gatekeeper.client.rpc("gatekeeper_ticket_action", {
      p_ticket_code: customerTickets[0].ticket_code,
      p_confirm: true,
    }),
    "Gatekeeper validates and checks in the issued ticket",
  );
  assert.equal(checkin.status, "checked_in", "First authorized scan must confirm entry");

  const finalTicket = await dataOrThrow(
    await customer.client.from("tickets").select("status,used_at")
      .eq("id", customerTickets[0].id).single(),
    "Verify final ticket status from customer account",
  );
  assert.equal(finalTicket.status, "used", "Checked-in ticket must no longer be valid");
  assert.ok(finalTicket.used_at, "Ticket check-in timestamp must be persisted");

  const checkinNotifications = await dataOrThrow(
    await customer.client.from("notifications")
      .select("id,type,booking_id")
      .eq("user_id", customer.id)
      .eq("booking_id", bookingId)
      .eq("type", "ticket_checked_in"),
    "Verify customer receives check-in notification",
  );
  assert.equal(checkinNotifications.length, 1, "Successful check-in must notify the customer exactly once");

  console.log("PASS: complete isolated customer journey from authentication and event discovery through booking, receipt upload, payment approval, ticket issuance, and gatekeeper check-in.");
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
