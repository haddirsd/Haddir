import assert from "node:assert/strict";
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
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = `Haddir-Ticket-Concurrency-${crypto.randomUUID()}-Aa1!`;
const eventId = crypto.randomUUID();
const ticketTypeId = crypto.randomUUID();
const bookingId = crypto.randomUUID();
const bookingItemId = crypto.randomUUID();
const paymentId = crypto.randomUUID();
const users = [];
let eventCreated = false;

async function requireNoError(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

async function createTestUser(label, role, phone) {
  const email = `ticket-concurrency-${label}-${suffix}@example.test`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Ticket Concurrency ${label}` },
  });
  const data = await requireNoError(created, `Create ${label} user`);
  const user = data?.user ?? data;
  assert.ok(user?.id, `Auth must return the ${label} user`);
  users.push({ id: user.id, email });

  await requireNoError(
    await admin.from("profiles").upsert({
      id: user.id,
      full_name: `Ticket Concurrency ${label}`,
      phone,
      role,
    }),
    `Prepare ${label} profile`,
  );
  return { id: user.id, email };
}

try {
  const customer = await createTestUser("customer", "customer", "0915555501");
  const reviewer = await createTestUser("reviewer", "admin", "0915555502");
  const gatekeeper = await createTestUser("gatekeeper", "gatekeeper", "0915555503");

  await requireNoError(
    await admin.from("events").insert({
      id: eventId,
      title: "Ticket Check-in Concurrency Test",
      slug: `ticket-checkin-concurrency-${suffix}`,
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 172_800_000).toISOString(),
      status: "published",
      created_by: reviewer.id,
    }),
    "Create isolated event",
  );
  eventCreated = true;

  await requireNoError(
    await admin.from("ticket_types").insert({
      id: ticketTypeId,
      event_id: eventId,
      name: "Concurrency Ticket",
      price: 100,
      currency: "SDG",
      quantity_total: 1,
      quantity_sold: 1,
      is_active: true,
    }),
    "Create ticket type",
  );

  await requireNoError(
    await admin.from("event_role_assignments").insert({
      user_id: gatekeeper.id,
      event_id: eventId,
      assignment_role: "gatekeeper",
    }),
    "Assign gatekeeper to test event",
  );

  await requireNoError(
    await admin.from("bookings").insert({
      id: bookingId,
      booking_number: `TC-${suffix}`,
      user_id: customer.id,
      customer_name: "Ticket Concurrency Customer",
      customer_email: customer.email,
      customer_phone: "0915555501",
      event_id: eventId,
      subtotal: 100,
      currency: "SDG",
      status: "under_review",
    }),
    "Create payment-review booking",
  );

  await requireNoError(
    await admin.from("booking_items").insert({
      id: bookingItemId,
      booking_id: bookingId,
      ticket_type_id: ticketTypeId,
      quantity: 1,
      unit_price: 100,
      line_total: 100,
    }),
    "Create booking item",
  );

  await requireNoError(
    await admin.from("payment_submissions").insert({
      id: paymentId,
      booking_id: bookingId,
      submitted_by: customer.id,
      amount: 100,
      currency: "SDG",
      status: "submitted",
    }),
    "Create submitted payment",
  );

  const reviewerClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await requireNoError(
    await reviewerClient.auth.signInWithPassword({ email: reviewer.email, password }),
    "Sign in payment reviewer",
  );
  const approval = await requireNoError(
    await reviewerClient.rpc("review_payment_submission", {
      p_submission_id: paymentId,
      p_decision: "approve",
      p_rejection_reason: null,
    }),
    "Approve isolated payment and issue ticket",
  );
  assert.equal(approval.tickets_created, 1, "Approval must issue exactly one ticket");

  const ticket = await requireNoError(
    await admin.from("tickets").select("id,ticket_code,status").eq("booking_id", bookingId).single(),
    "Load issued ticket",
  );
  assert.equal(ticket.status, "valid", "Issued ticket must begin in valid state");
  assert.match(ticket.ticket_code, /^[0-9]{10}$/, "Issued manual-entry code must contain 10 digits");

  await requireNoError(
    await admin.from("profiles").update({ role: "gatekeeper" }).eq("id", gatekeeper.id),
    "Confirm gatekeeper role",
  );

  const scanners = await Promise.all([0, 1].map(async () => {
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await requireNoError(
      await client.auth.signInWithPassword({ email: gatekeeper.email, password }),
      "Sign in independent gatekeeper session",
    );
    return client;
  }));

  const results = await Promise.all(
    scanners.map((client) =>
      client.rpc("gatekeeper_ticket_action", {
        p_ticket_code: ticket.ticket_code,
        p_confirm: true,
      }),
    ),
  );
  for (const result of results) {
    if (result.error) throw new Error(`Concurrent ticket validation RPC: ${result.error.message}`);
  }

  const statuses = results.map((result) => result.data?.status).sort();
  assert.deepEqual(
    statuses,
    ["checked_in", "used"],
    "Exactly one concurrent scan must check in the ticket; the other must be rejected as already used",
  );

  const persisted = await requireNoError(
    await admin.from("tickets").select("status,used_at").eq("id", ticket.id).single(),
    "Verify final ticket state",
  );
  assert.equal(persisted.status, "used", "Ticket must finish in used state");
  assert.ok(persisted.used_at, "Successful check-in must persist used_at");

  const logs = await requireNoError(
    await admin.from("gatekeeper_scan_logs").select("outcome").eq("ticket_id", ticket.id),
    "Verify concurrent scan audit",
  );
  assert.equal(logs.filter((log) => log.outcome === "accepted").length, 1, "Only one accepted scan may be logged");
  assert.equal(logs.filter((log) => log.outcome === "used").length, 1, "The competing scan must be logged as already used");

  const notifications = await requireNoError(
    await admin.from("notifications").select("id").eq("booking_id", bookingId).eq("type", "ticket_checked_in"),
    "Verify check-in notification",
  );
  assert.equal(notifications.length, 1, "Concurrent scans must emit exactly one check-in notification");

  console.log("PASS: concurrent gatekeeper scans cannot check in the same ticket more than once.");
} finally {
  if (eventCreated) await admin.from("events").delete().eq("id", eventId);
  for (const user of users) await admin.auth.admin.deleteUser(user.id);
}
