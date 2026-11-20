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
const password = `Haddir-Deletion-${randomUUID()}-Aa1!`;
const users = [];
const bookingIds = [];
const eventIds = [];
const receiptPaths = [];
const pageErrors = [];
const consoleErrors = [];
const failedResponses = [];
const deletionFunctionResponses = [];
let browser;

async function data(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

async function identity(label) {
  const email = `haddir-delete-${label}-${suffix}@example.test`;
  const created = await data(await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Haddir Deletion ${label}` },
  }), `Create ${label} Auth user`);
  const id = created.user.id;
  users.push({ id, email });
  await data(await admin.from("profiles").upsert({
    id,
    full_name: `Haddir Deletion ${label}`,
    phone: `09${String(Date.now()).slice(-7)}${users.length}`,
    role: "customer",
  }), `Create ${label} customer profile`);
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signed = await data(await client.auth.signInWithPassword({ email, password }), `Sign in ${label}`);
  assert.ok(signed.session?.access_token);
  return { id, email, client, session: signed.session };
}

async function createEvent(label, startsAt) {
  const id = randomUUID();
  eventIds.push(id);
  await data(await admin.from("events").insert({
    id,
    title: `Haddir Deletion ${label} ${suffix.slice(0, 8)}`,
    slug: `haddir-deletion-${label}-${suffix}`,
    category: "اختبار حذف الحساب",
    city: "الخرطوم",
    venue: "موقع اختبار حذف الحساب",
    starts_at: startsAt,
    ends_at: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString(),
    is_continuous: false,
    description: "بيانات مؤقتة لاختبار حذف الحساب.",
    status: "published",
    is_trending: false,
    created_by: null,
  }), `Create ${label} event`);
  const ticketTypeId = randomUUID();
  await data(await admin.from("ticket_types").insert({
    id: ticketTypeId,
    event_id: id,
    name: "تذكرة اختبار الحذف",
    price: 100,
    currency: "SDG",
    quantity_total: 20,
    quantity_sold: 0,
    is_active: true,
  }), `Create ${label} ticket type`);
  return { id, ticketTypeId };
}

async function createPendingBooking(user, event, label) {
  const result = await data(await user.client.rpc("create_booking", {
    p_event_id: event.id,
    p_ticket_type_id: event.ticketTypeId,
    p_quantity: 1,
  }), `Create ${label} booking`);
  const booking = Array.isArray(result) ? result[0] : result;
  assert.ok(booking?.booking_id, `${label} booking RPC must return a booking ID`);
  bookingIds.push(booking.booking_id);
  return booking.booking_id;
}

async function openDeletionPage(user) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ar",
    timezoneId: "Africa/Khartoum",
    reducedMotion: "reduce",
  });
  const projectRef = new URL(url).hostname.split(".")[0];
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session));
  }, { key: `sb-${projectRef}-auth-token`, session: user.session });
  const page = await context.newPage();
  page.on("pageerror", error => pageErrors.push(error.stack || error.message));
  page.on("response", async response => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
    if (response.url().includes("/functions/v1/delete-customer-account")) {
      deletionFunctionResponses.push({
        status: response.status(),
        body: await response.text().catch(() => ""),
      });
    }
  });
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("Failed to load resource:")) {
      consoleErrors.push(message.text());
    }
  });
  const response = await page.goto(`${baseUrl}/?tab=profile`, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200);
  await page.getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("button", { name: "الملف الشخصي" }).click();
  await page.getByRole("strong").filter({ hasText: user.email }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "سياسة الخصوصية" }).click();
  await page.getByRole("heading", { name: "حذف الحساب والبيانات" }).waitFor();
  return { context, page };
}

async function requestDelete(page, email) {
  await page.getByRole("button", { name: "حذف حسابي نهائياً" }).click();
  const identityDialog = page.getByRole("dialog", { name: "تأكيد هوية الحساب" });
  await identityDialog.getByPlaceholder("البريد الإلكتروني").fill(email);
  await identityDialog.getByRole("button", { name: "متابعة" }).click();
  return page.getByRole("dialog", { name: "حذف الحساب نهائياً؟" });
}

try {
  const customer = await identity("primary");
  const otherCustomer = await identity("other");
  const protectedCustomer = await identity("upcoming-ticket");

  const pastPendingEvent = await createEvent("pending-booking", new Date(Date.now() + 86_400_000).toISOString());
  const otherBookingEvent = pastPendingEvent;
  const protectedEvent = await createEvent("upcoming-confirmed", new Date(Date.now() + 3 * 86_400_000).toISOString());

  const customerBookingId = await createPendingBooking(customer, pastPendingEvent, "primary customer");
  const otherBookingId = await createPendingBooking(otherCustomer, otherBookingEvent, "unrelated customer");
  const protectedBookingId = await createPendingBooking(protectedCustomer, protectedEvent, "protected customer");
  await data(await admin.from("bookings").update({ status: "confirmed", expires_at: null })
    .eq("id", protectedBookingId), "Mark protected booking as confirmed");

  const receiptPath = `${customer.id}/${customerBookingId}/deletion-receipt.png`;
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  await data(await customer.client.storage.from("payment-receipts").upload(receiptPath, png, {
    contentType: "image/png",
    upsert: false,
  }), "Upload customer's real private receipt");
  receiptPaths.push(receiptPath);
  await data(await admin.from("payment_submissions").insert({
    booking_id: customerBookingId,
    submitted_by: customer.id,
    receipt_path: receiptPath,
    amount: 100,
    currency: "SDG",
    status: "submitted",
  }), "Create payment submission linked to receipt");

  browser = await chromium.launch({ headless: true });

  // A confirmed upcoming ticket must prevent deletion and preserve the account.
  const { page: protectedPage } = await openDeletionPage(protectedCustomer);
  const protectedDialog = await requestDelete(protectedPage, protectedCustomer.email);
  await protectedDialog.getByRole("button", { name: "حذف الحساب نهائياً" }).click();
  await protectedPage.getByRole("alert")
    .filter({ hasText: "لديك تذكرة مؤكدة لفعالية لم تبدأ بعد" }).waitFor({ timeout: 15000 });
  const protectedAuth = await admin.auth.admin.getUserById(protectedCustomer.id);
  assert.equal(protectedAuth.data.user?.id, protectedCustomer.id,
    "Upcoming confirmed ticket must keep the Auth account intact");
  const protectedBooking = await data(await admin.from("bookings").select("user_id,status")
    .eq("id", protectedBookingId).single(), "Verify protected booking remains linked");
  assert.equal(protectedBooking.user_id, protectedCustomer.id);
  assert.equal(protectedBooking.status, "confirmed");
  await protectedPage.close();

  // A mismatched email must be rejected in the actual UI without calling deletion.
  const { page: customerPage } = await openDeletionPage(customer);
  await customerPage.getByRole("button", { name: "حذف حسابي نهائياً" }).click();
  const identityDialog = customerPage.getByRole("dialog", { name: "تأكيد هوية الحساب" });
  await identityDialog.getByPlaceholder("البريد الإلكتروني").fill(`wrong-${customer.email}`);
  await identityDialog.getByRole("button", { name: "متابعة" }).click();
  await customerPage.getByRole("alert").filter({ hasText: "البريد الإلكتروني غير مطابق" }).waitFor();
  const stillExists = await admin.auth.admin.getUserById(customer.id);
  assert.equal(stillExists.data.user?.id, customer.id,
    "Mismatched email must not delete the account");

  // Confirm deletion through the real browser UI and local Edge Function.
  const finalDialog = await requestDelete(customerPage, customer.email);
  const loginHeading = customerPage.getByRole("heading", { name: "سجّل الدخول إلى حاضر" });
  const deletionError = customerPage.locator(".privacy-delete-error");
  const profileRedirect = customerPage.waitForEvent("framenavigated", {
    predicate: frame => frame === customerPage.mainFrame(),
    timeout: 30000,
  });
  await finalDialog.getByRole("button", { name: "حذف الحساب نهائياً" }).click();
  try {
    await profileRedirect;
  } catch {
    const message = await deletionError.last().textContent().catch(() => "No deletion error message rendered");
    throw new Error(`Account deletion did not redirect: ${message}; Edge Function responses: ${JSON.stringify(deletionFunctionResponses)}`);
  }
  await customerPage.getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("button", { name: "الملف الشخصي" }).click();
  const projectRef = new URL(url).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const storedSessionAfterDelete = await customerPage.evaluate(key => localStorage.getItem(key), storageKey);
  if (!(await loginHeading.isVisible().catch(() => false))) {
    const profileText = await customerPage.locator(".profile-screen").innerText().catch(() => "Profile workspace not rendered");
    const alerts = await customerPage.getByRole("alert").allTextContents().catch(() => []);
    throw new Error(`Deleted account did not return to signed-out profile. Session persisted: ${Boolean(storedSessionAfterDelete)}; profile: ${profileText}; alerts: ${JSON.stringify(alerts)}; Edge Function responses: ${JSON.stringify(deletionFunctionResponses)}`);
  }
  assert.equal(storedSessionAfterDelete, null, "Successful account deletion must clear the browser session");

  const deletedAuth = await admin.auth.admin.getUserById(customer.id);
  assert.ok(deletedAuth.error, "Deleted customer must no longer exist in Supabase Auth");

  const anonymizedBooking = await data(await admin.from("bookings")
    .select("user_id,customer_name,customer_email,customer_phone")
    .eq("id", customerBookingId).single(), "Read anonymized customer booking");
  assert.equal(anonymizedBooking.user_id, null);
  assert.equal(anonymizedBooking.customer_name, "مستخدم محذوف");
  assert.equal(anonymizedBooking.customer_email, null);
  assert.equal(anonymizedBooking.customer_phone, "محذوف");

  const anonymizedPayment = await data(await admin.from("payment_submissions")
    .select("submitted_by,receipt_path").eq("booking_id", customerBookingId).single(),
  "Read anonymized payment submission");
  assert.equal(anonymizedPayment.submitted_by, null);
  assert.equal(anonymizedPayment.receipt_path, null);

  const missingReceipt = await admin.storage.from("payment-receipts").download(receiptPath);
  assert.ok(missingReceipt.error, "Physical private receipt object must be removed");

  const unaffectedBooking = await data(await admin.from("bookings")
    .select("user_id,status,customer_name,customer_email,customer_phone")
    .eq("id", otherBookingId).single(), "Read unrelated customer's booking");
  assert.equal(unaffectedBooking.user_id, otherCustomer.id);
  assert.equal(unaffectedBooking.status, "pending_payment");
  assert.equal(unaffectedBooking.customer_name, "Haddir Deletion other");
  assert.equal(unaffectedBooking.customer_email, otherCustomer.email);

  const staleWrite = await customer.client.rpc("create_booking", {
    p_event_id: pastPendingEvent.id,
    p_ticket_type_id: pastPendingEvent.ticketTypeId,
    p_quantity: 1,
  });
  assert.ok(staleWrite.error, "A deleted customer's stale JWT must not create another booking");

  assert.ok(failedResponses.some(response => response.status === 409),
    "Upcoming-ticket protection must return HTTP 409 from the Edge Function");
  assert.deepEqual(pageErrors, [], `Account deletion UI runtime errors: ${pageErrors.join("; ")}`);
  assert.deepEqual(consoleErrors, [], `Account deletion UI console errors: ${consoleErrors.join("; ")}`);
  console.log("PASS: browser account deletion, email confirmation, upcoming-ticket protection, Auth removal, booking/payment anonymization, receipt removal, stale-session write blocking, and unrelated-customer data isolation.");
} finally {
  if (browser) await browser.close();
  if (receiptPaths.length) await admin.storage.from("payment-receipts").remove(receiptPaths);
  for (const bookingId of bookingIds) {
    await admin.from("payment_submissions").delete().eq("booking_id", bookingId);
    await admin.from("bookings").delete().eq("id", bookingId);
  }
  for (const eventId of eventIds) await admin.from("events").delete().eq("id", eventId);
  for (const user of users) await admin.auth.admin.deleteUser(user.id);
}
