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
const password = `Haddir-Gatekeeper-UI-${randomUUID()}-Aa1!`;
const assignedEventId = randomUUID();
const otherEventId = randomUUID();
const assignedTicketTypeId = randomUUID();
const otherTicketTypeId = randomUUID();
const customerBookingId = randomUUID();
const otherBookingId = randomUUID();
const users = [];
const pageErrors = [];
const consoleErrors = [];
let browser;
let assignedEventCreated = false;
let otherEventCreated = false;

async function dataOrThrow(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

async function createIdentity(label, role) {
  const email = `gatekeeper-ui-${label}-${suffix}@example.test`;
  const created = await dataOrThrow(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Haddir Gatekeeper UI ${label}` },
    }),
    `Create ${label} identity`,
  );
  const user = created.user;
  assert.ok(user?.id, `Supabase Auth must create the ${label} identity`);
  users.push({ id: user.id, email });

  await dataOrThrow(
    await admin.from("profiles").upsert({
      id: user.id,
      full_name: `Haddir Gatekeeper UI ${label}`,
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
      category: "اختبار واجهة البواب",
      city: "الخرطوم",
      venue: "موقع اختبار واجهة البواب",
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 172_800_000).toISOString(),
      is_continuous: false,
      description: "فعالية مؤقتة لاختبار واجهة البواب والتحقق من التذاكر.",
      status: "published",
      is_trending: false,
      created_by: createdBy,
    }),
    `Create ${title}`,
  );
}

async function createBookingAndTicket({ customer, reviewer, eventId, ticketTypeId, bookingId, label }) {
  await dataOrThrow(
    await admin.from("bookings").insert({
      id: bookingId,
      booking_number: `GK-${suffix.slice(0, 8)}-${label.toUpperCase()}`,
      user_id: customer.id,
      customer_name: `Gatekeeper UI ${label} Customer`,
      customer_email: customer.email,
      customer_phone: "0915555501",
      event_id: eventId,
      subtotal: 100,
      currency: "SDG",
      status: "under_review",
    }),
    `Create ${label} booking`,
  );

  await dataOrThrow(
    await admin.from("booking_items").insert({
      id: randomUUID(),
      booking_id: bookingId,
      ticket_type_id: ticketTypeId,
      quantity: 1,
      unit_price: 100,
      line_total: 100,
    }),
    `Create ${label} booking item`,
  );

  const paymentId = randomUUID();
  await dataOrThrow(
    await admin.from("payment_submissions").insert({
      id: paymentId,
      booking_id: bookingId,
      submitted_by: customer.id,
      amount: 100,
      currency: "SDG",
      status: "submitted",
    }),
    `Create ${label} payment submission`,
  );

  const approval = await dataOrThrow(
    await reviewer.client.rpc("review_payment_submission", {
      p_submission_id: paymentId,
      p_decision: "approve",
      p_rejection_reason: null,
    }),
    `Issue ${label} ticket through payment approval`,
  );
  assert.equal(approval.tickets_created, 1, `${label} payment approval must issue one ticket`);

  const ticket = await dataOrThrow(
    await admin.from("tickets").select("id,ticket_code,status")
      .eq("booking_id", bookingId).single(),
    `Load ${label} issued ticket`,
  );
  assert.equal(ticket.status, "valid");
  assert.match(ticket.ticket_code, /^[0-9]{10}$/);
  return ticket;
}

async function acknowledgeResult(page) {
  await page.getByRole("button", { name: "موافق — فحص التذكرة التالية" }).click();
  await page.getByLabel("كود التذكرة — 10 أرقام فقط").waitFor({ state: "visible" });
}

try {
  const customer = await createIdentity("customer", "customer");
  const reviewer = await createIdentity("reviewer", "admin");
  const gatekeeper = await createIdentity("gatekeeper", "gatekeeper");

  const assignedTitle = `Haddir Gatekeeper Assigned ${suffix.slice(0, 8)}`;
  const otherTitle = `Haddir Gatekeeper Other ${suffix.slice(0, 8)}`;
  await createEvent(assignedEventId, "haddir-gatekeeper-assigned", assignedTitle, reviewer.id);
  assignedEventCreated = true;
  await createEvent(otherEventId, "haddir-gatekeeper-other", otherTitle, reviewer.id);
  otherEventCreated = true;

  await dataOrThrow(
    await admin.from("ticket_types").insert([
      {
        id: assignedTicketTypeId,
        event_id: assignedEventId,
        name: "تذكرة فعالية البواب",
        price: 100,
        currency: "SDG",
        quantity_total: 10,
        quantity_sold: 1,
        is_active: true,
      },
      {
        id: otherTicketTypeId,
        event_id: otherEventId,
        name: "تذكرة الفعالية الأخرى",
        price: 100,
        currency: "SDG",
        quantity_total: 10,
        quantity_sold: 1,
        is_active: true,
      },
    ]),
    "Create isolated ticket types",
  );

  await dataOrThrow(
    await admin.from("event_role_assignments").insert({
      user_id: gatekeeper.id,
      event_id: assignedEventId,
      assignment_role: "gatekeeper",
    }),
    "Assign gatekeeper to exactly one event",
  );

  const assignedTicket = await createBookingAndTicket({
    customer, reviewer, eventId: assignedEventId, ticketTypeId: assignedTicketTypeId,
    bookingId: customerBookingId, label: "assigned",
  });
  const otherTicket = await createBookingAndTicket({
    customer, reviewer, eventId: otherEventId, ticketTypeId: otherTicketTypeId,
    bookingId: otherBookingId, label: "other",
  });

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ar",
    timezoneId: "Africa/Khartoum",
    reducedMotion: "reduce",
  });
  const projectRef = new URL(url).hostname.split(".")[0];
  await context.addInitScript(
    ({ storageKey, session }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    },
    { storageKey: `sb-${projectRef}-auth-token`, session: gatekeeper.session },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const response = await page.goto(
    `${baseUrl}/?tab=profile&workspace=gatekeeper`,
    { waitUntil: "domcontentloaded" },
  );
  assert.equal(response?.status(), 200, "Gatekeeper workspace must return HTTP 200");
  await page.getByRole("heading", { name: "فحص تذاكر الدخول" }).waitFor({ timeout: 20000 });
  await page.getByText(assignedTitle, { exact: true }).first().waitFor({ timeout: 15000 });
  assert.equal(await page.getByText(otherTitle, { exact: true }).count(), 0,
    "Gatekeeper workspace must not expose another event's title");
  await page.getByText("الفعالية المصرح لك بها", { exact: true }).waitFor();
  await page.getByText("متصل بالشبكة", { exact: true }).waitFor();

  // Verify the QR camera surface can be opened and closed in the browser UI.
  const cameraButton = page.getByRole("button", { name: "مسح بالكاميرا" });
  await cameraButton.click();
  await page.locator(".gatekeeper-camera video").waitFor({ state: "visible", timeout: 10000 });
  await page.getByRole("button", { name: "إغلاق الكاميرا" }).click();
  await page.locator(".gatekeeper-camera").waitFor({ state: "detached" });

  await page.getByRole("button", { name: "إدخال يدوي" }).click();
  const codeInput = page.getByLabel("كود التذكرة — 10 أرقام فقط");
  await codeInput.fill("12345");
  assert.equal(await page.getByRole("button", { name: "تحقق ودخول" }).isDisabled(), true,
    "Manual validation must reject codes shorter than 10 digits");
  await codeInput.fill(assignedTicket.ticket_code);
  await page.getByRole("button", { name: "تحقق ودخول" }).click();

  await page.getByRole("dialog").getByText("مقبولة — تم تسجيل الدخول").waitFor({ timeout: 15000 });
  await page.getByRole("dialog").getByText(assignedTitle).waitFor();
  await page.getByRole("dialog").getByText(assignedTicket.ticket_code).waitFor();
  await acknowledgeResult(page);

  await codeInput.fill(assignedTicket.ticket_code);
  await page.getByRole("button", { name: "تحقق ودخول" }).click();
  await page.getByRole("dialog").getByText("مستعملة — سبق تسجيل الدخول بها").waitFor({ timeout: 15000 });
  await acknowledgeResult(page);

  await codeInput.fill(otherTicket.ticket_code);
  await page.getByRole("button", { name: "تحقق ودخول" }).click();
  await page.getByRole("dialog").getByText("تعذر إكمال الفحص").waitFor({ timeout: 15000 });
  await page.getByRole("dialog").getByText("هذه التذكرة لا تخص الفعالية المصرح لك بها").waitFor();
  await page.getByRole("button", { name: "موافق — فحص التذكرة التالية" }).click();

  await codeInput.fill("0000000000");
  await page.getByRole("button", { name: "تحقق ودخول" }).click();
  await page.getByRole("dialog").getByText("من خارج نظام حاضر").waitFor({ timeout: 15000 });
  await page.getByRole("dialog").getByText("0000000000").waitFor();

  const persistedAssignedTicket = await dataOrThrow(
    await admin.from("tickets").select("status,used_at").eq("id", assignedTicket.id).single(),
    "Verify assigned ticket check-in state",
  );
  assert.equal(persistedAssignedTicket.status, "used");
  assert.ok(persistedAssignedTicket.used_at);

  const persistedOtherTicket = await dataOrThrow(
    await admin.from("tickets").select("status,used_at").eq("id", otherTicket.id).single(),
    "Verify out-of-scope ticket was not consumed",
  );
  assert.equal(persistedOtherTicket.status, "valid");
  assert.equal(persistedOtherTicket.used_at, null);

  const scanLogs = await dataOrThrow(
    await admin.from("gatekeeper_scan_logs")
      .select("ticket_id,outcome,entry_method,entered_code")
      .eq("gatekeeper_user_id", gatekeeper.id)
      .eq("event_id", assignedEventId),
    "Verify gatekeeper audit log",
  );
  assert.equal(scanLogs.filter((log) => log.outcome === "accepted" && log.entry_method === "manual" && log.ticket_id === assignedTicket.id).length, 1);
  assert.equal(scanLogs.filter((log) => log.outcome === "used" && log.entry_method === "manual" && log.ticket_id === assignedTicket.id).length, 1);
  assert.equal(scanLogs.filter((log) => log.outcome === "forged" && log.entry_method === "manual" && log.entered_code === "0000000000").length, 1);
  assert.equal(scanLogs.some((log) => log.ticket_id === otherTicket.id), false,
    "Out-of-scope ticket attempts must not create a scan record under this gatekeeper");

  await page.getByRole("heading", { name: "سجل عمليات الدخول" }).waitFor();
  await page.getByText("محاولة دخول مكررة", { exact: true }).waitFor();
  await page.getByText("كود غير موجود", { exact: true }).waitFor();

  assert.deepEqual(pageErrors, [], `Gatekeeper browser page must not throw runtime errors: ${pageErrors.join("; ")}`);
  assert.deepEqual(consoleErrors, [], `Gatekeeper browser page must not emit console errors: ${consoleErrors.join("; ")}`);

  console.log("PASS: assigned gatekeeper Chromium UI loads only its assigned event, opens the QR camera surface, validates numeric ticket codes, checks in a valid ticket once, rejects repeat and forged codes, blocks another event's ticket, and persists scan history.");
} finally {
  if (browser) await browser.close();
  if (assignedEventCreated) await admin.from("events").delete().eq("id", assignedEventId);
  if (otherEventCreated) await admin.from("events").delete().eq("id", otherEventId);
  for (const user of users) await admin.auth.admin.deleteUser(user.id);
}
