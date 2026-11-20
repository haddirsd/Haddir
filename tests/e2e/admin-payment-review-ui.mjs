import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3002";

for (const [name, value] of Object.entries({ url, anonKey, serviceRoleKey })) {
  assert.ok(value, `Missing required environment variable: ${name}`);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const suffix = randomUUID();
const password = `Haddir-Payment-Review-${randomUUID()}-Aa1!`;
const assignedEventId = randomUUID();
const unassignedEventId = randomUUID();
const assignedTicketTypeId = randomUUID();
const unassignedTicketTypeId = randomUUID();
const assignedPaymentAccountId = randomUUID();
const unassignedPaymentAccountId = randomUUID();
const users = [];
const receiptPaths = [];
const pageErrors = [];
const consoleErrors = [];
let browser;
let assignedEventCreated = false;
let unassignedEventCreated = false;

async function dataOrThrow(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

async function createIdentity(label, role) {
  const email = `payment-review-${label}-${suffix}@example.test`;
  const created = await dataOrThrow(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Haddir Payment Review ${label}` },
    }),
    `Create ${label} identity`,
  );
  const user = created.user;
  assert.ok(user?.id, `Supabase Auth must create the ${label} identity`);
  users.push({ id: user.id, email });

  await dataOrThrow(
    await admin.from("profiles").upsert({
      id: user.id,
      full_name: `Haddir Payment Review ${label}`,
      phone: `09${String(Date.now()).slice(-7)}${users.length}`,
      role,
    }),
    `Create ${label} profile`,
  );

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await dataOrThrow(
    await client.auth.signInWithPassword({ email, password }),
    `Authenticate ${label}`,
  );
  assert.ok(signedIn.session?.access_token, `${label} must receive a real Supabase Auth session`);
  return { id: user.id, email, client, session: signedIn.session };
}

async function createEvent(eventId, slug, title, createdBy) {
  await dataOrThrow(
    await admin.from("events").insert({
      id: eventId,
      title,
      slug: `${slug}-${suffix}`,
      category: "اختبار مراجعة المدفوعات",
      city: "الخرطوم",
      venue: "موقع اختبار مراجعة المدفوعات",
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 172_800_000).toISOString(),
      is_continuous: false,
      description: "فعالية مؤقتة لاختبار مراجعة إثباتات الدفع من واجهة المشرف.",
      status: "published",
      is_trending: false,
      created_by: createdBy,
    }),
    `Create ${title}`,
  );
}

async function createPayment({ customer, eventId, ticketTypeId, paymentAccountId, label }) {
  const createdBooking = await dataOrThrow(
    await customer.client.rpc("create_booking", {
      p_event_id: eventId,
      p_ticket_type_id: ticketTypeId,
      p_quantity: 1,
    }),
    `Create ${label} booking`,
  );
  const booking = Array.isArray(createdBooking) ? createdBooking[0] : createdBooking;
  assert.ok(booking?.booking_id, `${label} booking RPC must return an ID`);

  const receipt = new File(
    [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])],
    `${label}-receipt.png`,
    { type: "image/png" },
  );
  const form = new FormData();
  form.set("bookingId", booking.booking_id);
  form.set("receipt", receipt);
  const upload = await fetch(`${baseUrl}/api/booking/receipt`, {
    method: "POST",
    headers: { Authorization: `Bearer ${customer.session.access_token}` },
    body: form,
  });
  const uploadBody = await upload.json();
  assert.equal(upload.status, 200, `${label} receipt upload failed: ${JSON.stringify(uploadBody)}`);
  assert.match(uploadBody.path, new RegExp(`^${customer.id}/${booking.booking_id}/[^/]+\\.png$`));
  receiptPaths.push(uploadBody.path);

  const submissionId = await dataOrThrow(
    await customer.client.rpc("submit_payment", {
      p_booking_id: booking.booking_id,
      p_payment_method_id: paymentAccountId,
      p_receipt_path: receiptPath,
      p_transfer_reference: `TRANSFER-${label.toUpperCase()}-${suffix.slice(0, 8)}`,
    }),
    `Submit ${label} payment`,
  );
  assert.ok(submissionId, `${label} payment submission must be created`);

  const row = await dataOrThrow(
    await admin.from("payment_submissions")
      .select("id,status,receipt_path")
      .eq("id", submissionId)
      .single(),
    `Verify ${label} payment submission`,
  );
  assert.equal(row.status, "submitted");
  assert.equal(row.receipt_path, uploadBody.path);

  const bookingRow = await dataOrThrow(
    await admin.from("bookings").select("id,booking_number,status").eq("id", booking.booking_id).single(),
    `Verify ${label} booking`,
  );
  assert.equal(bookingRow.status, "under_review");
  return { ...bookingRow, paymentId: submissionId };
}

try {
  const supervisor = await createIdentity("supervisor", "supervisor");
  const customerOne = await createIdentity("customer-one", "customer");
  const customerTwo = await createIdentity("customer-two", "customer");

  const assignedTitle = `Haddir Assigned Review ${suffix.slice(0, 8)}`;
  const unassignedTitle = `Haddir Unassigned Review ${suffix.slice(0, 8)}`;
  await createEvent(assignedEventId, "haddir-assigned-review", assignedTitle, customerOne.id);
  assignedEventCreated = true;
  await createEvent(unassignedEventId, "haddir-unassigned-review", unassignedTitle, customerTwo.id);
  unassignedEventCreated = true;

  await dataOrThrow(
    await admin.from("ticket_types").insert([
      {
        id: assignedTicketTypeId,
        event_id: assignedEventId,
        name: "تذكرة مراجعة مخصصة",
        price: 300,
        currency: "SDG",
        quantity_total: 10,
        quantity_sold: 0,
        is_active: true,
      },
      {
        id: unassignedTicketTypeId,
        event_id: unassignedEventId,
        name: "تذكرة فعالية غير مسندة",
        price: 400,
        currency: "SDG",
        quantity_total: 10,
        quantity_sold: 0,
        is_active: true,
      },
    ]),
    "Create isolated ticket inventory",
  );

  await dataOrThrow(
    await admin.from("event_payment_accounts").insert([
      {
        id: assignedPaymentAccountId,
        event_id: assignedEventId,
        account_name: "حساب الفعالية المسندة",
        account_number: "300123456",
        beneficiary: "مستفيد الفعالية المسندة",
        sort_order: 1,
        is_active: true,
      },
      {
        id: unassignedPaymentAccountId,
        event_id: unassignedEventId,
        account_name: "حساب الفعالية غير المسندة",
        account_number: "400123456",
        beneficiary: "مستفيد الفعالية غير المسندة",
        sort_order: 1,
        is_active: true,
      },
    ]),
    "Create event-specific payment accounts",
  );

  await dataOrThrow(
    await admin.from("event_role_assignments").insert({
      user_id: supervisor.id,
      event_id: assignedEventId,
      assignment_role: "supervisor",
    }),
    "Assign supervisor to exactly one event",
  );

  const approval = await createPayment({
    customer: customerOne,
    eventId: assignedEventId,
    ticketTypeId: assignedTicketTypeId,
    paymentAccountId: assignedPaymentAccountId,
    label: "approval",
  });
  const rejection = await createPayment({
    customer: customerOne,
    eventId: assignedEventId,
    ticketTypeId: assignedTicketTypeId,
    paymentAccountId: assignedPaymentAccountId,
    label: "rejection",
  });
  const outOfScope = await createPayment({
    customer: customerTwo,
    eventId: unassignedEventId,
    ticketTypeId: unassignedTicketTypeId,
    paymentAccountId: unassignedPaymentAccountId,
    label: "out-of-scope",
  });

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "ar",
    timezoneId: "Africa/Khartoum",
    reducedMotion: "reduce",
  });
  const projectRef = new URL(url).hostname.split(".")[0];
  await context.addInitScript(
    ({ storageKey, session }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    },
    { storageKey: `sb-${projectRef}-auth-token`, session: supervisor.session },
  );

  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const response = await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "Admin workspace must return HTTP 200");
  const adminNavigation = page.getByRole("navigation", { name: "تبويبات لوحة الإدارة" });
  await adminNavigation.waitFor({ state: "visible", timeout: 15000 });
  await adminNavigation.getByRole("button", { name: "مراجعة المدفوعات" }).click();
  await page.getByRole("heading", { name: "مراجعة المدفوعات" }).waitFor({ timeout: 15000 });

  const cards = page.locator("article.admin-payment-card");
  await page.getByText(approval.booking_number, { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText(rejection.booking_number, { exact: true }).waitFor();
  await page.getByText("حساب الفعالية المسندة", { exact: true }).first().waitFor();
  assert.equal(await cards.count(), 2, "Supervisor must see only the two assigned-event payment submissions");
  assert.equal(await page.getByText(outOfScope.booking_number, { exact: true }).count(), 0,
    "Supervisor must not see a payment submission for an unassigned event");
  assert.equal(await page.getByText(unassignedTitle, { exact: true }).count(), 0,
    "Supervisor must not see the unassigned event");

  const approvalCard = cards.filter({ hasText: approval.booking_number });
  await approvalCard.getByRole("link", { name: "عرض إيصال التحويل" }).waitFor({ state: "visible" });
  await approvalCard.getByRole("button", { name: "قبول الدفع وإصدار التذاكر" }).click();
  const approvalDialog = page.getByRole("dialog", { name: "اعتماد الدفع وإصدار التذاكر؟" });
  await approvalDialog.getByRole("button", { name: "اعتماد الدفع" }).click();
  await page.getByRole("status").filter({ hasText: "تم اعتماد الدفع وإصدار 1 تذكرة" }).waitFor({ timeout: 20000 });
  await approvalCard.waitFor({ state: "detached", timeout: 15000 });

  const approvedPayment = await dataOrThrow(
    await admin.from("payment_submissions").select("status,reviewed_by")
      .eq("id", approval.paymentId).single(),
    "Verify approved payment",
  );
  assert.equal(approvedPayment.status, "approved");
  assert.equal(approvedPayment.reviewed_by, supervisor.id);
  const approvedBooking = await dataOrThrow(
    await admin.from("bookings").select("status").eq("id", approval.id).single(),
    "Verify approved booking",
  );
  assert.equal(approvedBooking.status, "confirmed");
  const issuedTickets = await dataOrThrow(
    await admin.from("tickets").select("id,ticket_code,status").eq("booking_id", approval.id),
    "Verify tickets issued after browser approval",
  );
  assert.equal(issuedTickets.length, 1);
  assert.equal(issuedTickets[0].status, "valid");
  assert.match(issuedTickets[0].ticket_code, /^[0-9]{10}$/);
  const approvalNotifications = await dataOrThrow(
    await admin.from("notifications").select("id,type")
      .eq("booking_id", approval.id).eq("type", "ticket_approved"),
    "Verify customer approval notification",
  );
  assert.equal(approvalNotifications.length, 1);

  const rejectionCard = cards.filter({ hasText: rejection.booking_number });
  const reason = `إيصال الاختبار غير مطابق ${suffix.slice(0, 8)}`;
  await rejectionCard.getByLabel("سبب الرفض (سيصل للعميل)").fill(reason);
  await rejectionCard.getByRole("button", { name: "رفض وإرسال السبب" }).click();
  const rejectionDialog = page.getByRole("dialog", { name: /تأكيد رفض إثبات الدفع/ });
  await rejectionDialog.getByRole("button", { name: "تأكيد الرفض" }).click();
  await page.getByRole("status").filter({ hasText: "تم رفض إثبات الدفع وإرسال السبب للعميل" }).waitFor({ timeout: 20000 });
  await rejectionCard.waitFor({ state: "detached", timeout: 15000 });

  const rejectedPayment = await dataOrThrow(
    await admin.from("payment_submissions").select("status,reviewed_by,review_note")
      .eq("id", rejection.paymentId).single(),
    "Verify rejected payment and reason",
  );
  assert.equal(rejectedPayment.status, "rejected");
  assert.equal(rejectedPayment.reviewed_by, supervisor.id);
  assert.equal(rejectedPayment.review_note, reason);
  const rejectedBooking = await dataOrThrow(
    await admin.from("bookings").select("status").eq("id", rejection.id).single(),
    "Verify rejected booking",
  );
  assert.equal(rejectedBooking.status, "rejected");
  const rejectionNotifications = await dataOrThrow(
    await admin.from("notifications").select("id,type,message")
      .eq("booking_id", rejection.id).eq("type", "payment_rejected"),
    "Verify rejection notification delivered to the customer",
  );
  assert.equal(rejectionNotifications.length, 1);
  assert.match(rejectionNotifications[0].message, new RegExp(reason.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.deepEqual(pageErrors, [], `Admin browser page must not throw runtime errors: ${pageErrors.join("; ")}`);
  assert.deepEqual(consoleErrors, [], `Admin browser page must not emit console errors: ${consoleErrors.join("; ")}`);

  console.log("PASS: assigned supervisor Chromium UI sees only assigned-event payment submissions, opens the real private receipt, approves and issues a ticket, rejects with a required reason, and persists customer notifications and review state.");
} finally {
  if (browser) await browser.close();
  if (receiptPaths.length) await admin.storage.from("payment-receipts").remove(receiptPaths);
  if (assignedEventCreated) await admin.from("events").delete().eq("id", assignedEventId);
  if (unassignedEventCreated) await admin.from("events").delete().eq("id", unassignedEventId);
  for (const user of users) await admin.auth.admin.deleteUser(user.id);
}
