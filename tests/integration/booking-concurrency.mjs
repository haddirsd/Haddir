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
const password = `Haddir-Test-${crypto.randomUUID()}-Aa1!`;
const eventId = crypto.randomUUID();
const ticketTypeId = crypto.randomUUID();
const users = [];
let eventCreated = false;

async function requireNoError(result, action) {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message}`);
  }
  return result.data;
}

try {
  for (let index = 0; index < 2; index += 1) {
    const email = `booking-concurrency-${index}-${suffix}@example.test`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Concurrency Customer ${index}` },
    });
    const user = requireNoError(created, "Create isolated test user");
    users.push({ id: user.id, email });

    await requireNoError(
      await admin.from("profiles").upsert({
        id: user.id,
        full_name: `Concurrency Customer ${index}`,
        phone: `09123456${index}0`,
      }),
      "Prepare customer profile",
    );
  }

  await requireNoError(
    await admin.from("events").insert({
      id: eventId,
      title: "Booking Concurrency Integration Test",
      slug: `booking-concurrency-${suffix}`,
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 172_800_000).toISOString(),
      status: "published",
      created_by: users[0].id,
    }),
    "Create isolated test event",
  );
  eventCreated = true;

  await requireNoError(
    await admin.from("ticket_types").insert({
      id: ticketTypeId,
      event_id: eventId,
      name: "Single Inventory Ticket",
      price: 100,
      currency: "SDG",
      quantity_total: 1,
      quantity_sold: 0,
      is_active: true,
    }),
    "Create one-ticket inventory",
  );

  const customers = await Promise.all(
    users.map(async (user) => {
      const client = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await requireNoError(
        await client.auth.signInWithPassword({ email: user.email, password }),
        "Sign in isolated test customer",
      );
      return client;
    }),
  );

  // Both independent customer sessions attempt to reserve the final ticket together.
  const attempts = await Promise.all(
    customers.map((client) =>
      client.rpc("create_booking", {
        p_event_id: eventId,
        p_ticket_type_id: ticketTypeId,
        p_quantity: 1,
      }),
    ),
  );

  const successes = attempts.filter((attempt) => !attempt.error);
  const failures = attempts.filter((attempt) => attempt.error);
  assert.equal(successes.length, 1, "Exactly one concurrent booking must succeed");
  assert.equal(failures.length, 1, "The competing booking must be rejected");
  assert.match(
    failures[0].error.message,
    /الكمية المطلوبة غير متوفرة|not available|insufficient/i,
    "The losing booking must fail because inventory is exhausted",
  );

  const bookings = await requireNoError(
    await admin.from("bookings").select("id").eq("event_id", eventId),
    "Verify persisted bookings",
  );
  assert.equal(bookings.length, 1, "Only one booking may be persisted");

  const inventory = await requireNoError(
    await admin.from("ticket_types").select("quantity_total,quantity_sold").eq("id", ticketTypeId).single(),
    "Verify final inventory",
  );
  assert.equal(inventory.quantity_total, 1, "Test inventory must remain one");
  assert.equal(inventory.quantity_sold, 1, "Concurrent requests must not oversell inventory");

  const items = await requireNoError(
    await admin.from("booking_items").select("quantity").eq("booking_id", bookings[0].id),
    "Verify booking line items",
  );
  assert.equal(items.length, 1, "The successful booking must have one line item");
  assert.equal(items[0].quantity, 1, "The successful booking must reserve exactly one ticket");

  console.log("PASS: concurrent booking requests cannot oversell a one-ticket inventory.");
} finally {
  if (eventCreated) {
    await admin.from("events").delete().eq("id", eventId);
  }
  for (const user of users) {
    await admin.auth.admin.deleteUser(user.id);
  }
}
