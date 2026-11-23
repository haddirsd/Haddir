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
const publicClient = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const suffix = randomUUID();
const password = `Haddir-Authenticated-UI-${randomUUID()}-Aa1!`;
const email = `haddir-auth-ui-${suffix}@example.test`;
const eventId = randomUUID();
const ticketTypeId = randomUUID();
const paymentAccountId = randomUUID();
const receiptBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1sAAAAASUVORK5CYII=", "base64");
const pageErrors = [];
const consoleErrors = [];
let browser;
let userId = null;
let eventCreated = false;
let receiptPath = null;

async function dataOrThrow(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

try {
  const createdUser = await dataOrThrow(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Haddir Authenticated UI Customer" },
    }),
    "Create isolated authenticated browser customer",
  );
  userId = createdUser.user?.id;
  assert.ok(userId, "Supabase Auth must create the test customer");

  await dataOrThrow(
    await admin.from("profiles").upsert({
      id: userId,
      full_name: "Haddir Authenticated UI Customer",
      phone: "0912345678",
      role: "customer",
    }),
    "Create authenticated customer profile",
  );

  const signedIn = await dataOrThrow(
    await publicClient.auth.signInWithPassword({ email, password }),
    "Create a real Supabase Auth customer session",
  );
  assert.ok(signedIn.session?.access_token, "Test customer must receive an access token");
  assert.equal(signedIn.user?.id, userId, "Auth session must belong to the isolated customer");

  await dataOrThrow(
    await admin.from("events").insert({
      id: eventId,
      title: `Haddir Authenticated UI ${suffix.slice(0, 8)}`,
      slug: `haddir-auth-ui-${suffix}`,
      category: "اختبار الواجهة",
      city: "الخرطوم",
      venue: "موقع اختبار الدفع",
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 172_800_000).toISOString(),
      is_continuous: false,
      description: "فعالية مؤقتة لاختبار جلسة العميل والدفع ورفع الإيصال من المتصفح.",
      status: "published",
      is_trending: false,
      created_by: userId,
    }),
    "Create isolated published event",
  );
  eventCreated = true;

  await dataOrThrow(
    await admin.from("ticket_types").insert({
      id: ticketTypeId,
      event_id: eventId,
      name: "تذكرة اختبار الدفع",
      description: "فئة مؤقتة لاختبار الحجز من المتصفح",
      price: 250,
      currency: "SDG",
      quantity_total: 5,
      quantity_sold: 0,
      is_active: true,
    }),
    "Create isolated ticket inventory",
  );

  await dataOrThrow(
    await admin.from("event_payment_accounts").insert({
      id: paymentAccountId,
      event_id: eventId,
      account_name: "حساب اختبار حاضر",
      account_number: "123456789",
      beneficiary: "مستفيد اختبار حاضر",
      sort_order: 1,
      is_active: true,
    }),
    "Create event-specific payment account",
  );

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ar",
    timezoneId: "Africa/Khartoum",
    reducedMotion: "reduce",
  });

  // Seed the real Supabase Auth session before the app initializes its browser client.
  // This exercises authenticated UI behavior without depending on an external Google OAuth callback.
  const projectRef = new URL(url).hostname.split(".")[0];
  await context.addInitScript(
    ({ storageKey, session }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    },
    { storageKey: `sb-${projectRef}-auth-token`, session: signedIn.session },
  );

  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "Authenticated home page must return HTTP 200");
  await page.getByRole("heading", { name: "رائج الآن" }).waitFor();
  await page.locator("#haddir-splash").waitFor({ state: "detached", timeout: 10000 });

  const mainNavigation = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  await mainNavigation.getByRole("button", { name: "الملف الشخصي" }).click();
  await page.getByRole("strong").filter({ hasText: email }).waitFor();
  await page.getByText("0912345678", { exact: true }).waitFor();

  await mainNavigation.getByRole("button", { name: "الرئيسية" }).click();
  const eventTitle = `Haddir Authenticated UI ${suffix.slice(0, 8)}`;
  const eventCard = page.getByRole("button", { name: `عرض تفاصيل ${eventTitle}` });
  await eventCard.waitFor({ state: "visible", timeout: 15000 });
  await eventCard.click();

  await page.getByRole("heading", { name: eventTitle, level: 1 }).waitFor();
  await page.getByRole("button", { name: /تذكرة اختبار الدفع/ }).click();
  await page.getByRole("button", { name: /ادفع الآن/ }).click();

  await page.getByRole("heading", { name: "إتمام الحجز" }).waitFor();
  await page.getByRole("heading", { name: "طريقة الدفع" }).waitFor();

  const accountSelector = page.getByRole("button", { name: "اختيار حساب التحويل" });
  await accountSelector.waitFor({ state: "visible" });
  await accountSelector.click();
  await page.getByRole("option", { name: "حساب اختبار حاضر" }).click();
  await page.getByText("123456789", { exact: true }).waitFor();
  await page.getByText("مستفيد اختبار حاضر", { exact: true }).waitFor();

  const receiptInput = page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]');
  await receiptInput.setInputFiles({
    name: "haddir-authenticated-ui-receipt.png",
    mimeType: "image/png",
    buffer: receiptBytes,
  });
  await page.getByText("haddir-authenticated-ui-receipt.png", { exact: true }).waitFor();

  const submitButton = page.getByRole("button", { name: /إرسال طلب الدفع للمراجعة/ });
  await submitButton.waitFor({ state: "visible" });
  await submitButton.click();
  await page.getByRole("alertdialog", { name: "استلمنا طلب حجزك!" }).waitFor({ timeout: 20000 });

  const booking = await dataOrThrow(
    await admin.from("bookings")
      .select("id,booking_number,status,user_id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .single(),
    "Verify browser-created customer booking",
  );
  assert.equal(booking.status, "under_review", "Submitted browser booking must enter payment review");

  const bookingItems = await dataOrThrow(
    await admin.from("booking_items")
      .select("quantity,unit_price,line_total")
      .eq("booking_id", booking.id),
    "Verify selected ticket quantity and total",
  );
  assert.equal(bookingItems.length, 1);
  assert.equal(bookingItems[0].quantity, 1);
  assert.equal(Number(bookingItems[0].unit_price), 250);
  assert.equal(Number(bookingItems[0].line_total), 250);

  const payment = await dataOrThrow(
    await admin.from("payment_submissions")
      .select("status,receipt_path,payment_account_id,payment_account_name,payment_account_number,payment_account_beneficiary")
      .eq("booking_id", booking.id)
      .single(),
    "Verify browser payment submission and event account snapshot",
  );
  assert.equal(payment.status, "submitted");
  assert.equal(payment.payment_account_id, paymentAccountId);
  assert.equal(payment.payment_account_name, "حساب اختبار حاضر");
  assert.equal(payment.payment_account_number, "123456789");
  assert.equal(payment.payment_account_beneficiary, "مستفيد اختبار حاضر");
  assert.match(payment.receipt_path, new RegExp(`^${userId}/${booking.id}/[^/]+\\.webpimport assert from "node:assert/strict";
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
const publicClient = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const suffix = randomUUID();
const password = `Haddir-Authenticated-UI-${randomUUID()}-Aa1!`;
const email = `haddir-auth-ui-${suffix}@example.test`;
const eventId = randomUUID();
const ticketTypeId = randomUUID();
const paymentAccountId = randomUUID();
const receiptBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1sAAAAASUVORK5CYII=", "base64");
const pageErrors = [];
const consoleErrors = [];
let browser;
let userId = null;
let eventCreated = false;
let receiptPath = null;

async function dataOrThrow(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

try {
  const createdUser = await dataOrThrow(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Haddir Authenticated UI Customer" },
    }),
    "Create isolated authenticated browser customer",
  );
  userId = createdUser.user?.id;
  assert.ok(userId, "Supabase Auth must create the test customer");

  await dataOrThrow(
    await admin.from("profiles").upsert({
      id: userId,
      full_name: "Haddir Authenticated UI Customer",
      phone: "0912345678",
      role: "customer",
    }),
    "Create authenticated customer profile",
  );

  const signedIn = await dataOrThrow(
    await publicClient.auth.signInWithPassword({ email, password }),
    "Create a real Supabase Auth customer session",
  );
  assert.ok(signedIn.session?.access_token, "Test customer must receive an access token");
  assert.equal(signedIn.user?.id, userId, "Auth session must belong to the isolated customer");

  await dataOrThrow(
    await admin.from("events").insert({
      id: eventId,
      title: `Haddir Authenticated UI ${suffix.slice(0, 8)}`,
      slug: `haddir-auth-ui-${suffix}`,
      category: "اختبار الواجهة",
      city: "الخرطوم",
      venue: "موقع اختبار الدفع",
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 172_800_000).toISOString(),
      is_continuous: false,
      description: "فعالية مؤقتة لاختبار جلسة العميل والدفع ورفع الإيصال من المتصفح.",
      status: "published",
      is_trending: false,
      created_by: userId,
    }),
    "Create isolated published event",
  );
  eventCreated = true;

  await dataOrThrow(
    await admin.from("ticket_types").insert({
      id: ticketTypeId,
      event_id: eventId,
      name: "تذكرة اختبار الدفع",
      description: "فئة مؤقتة لاختبار الحجز من المتصفح",
      price: 250,
      currency: "SDG",
      quantity_total: 5,
      quantity_sold: 0,
      is_active: true,
    }),
    "Create isolated ticket inventory",
  );

  await dataOrThrow(
    await admin.from("event_payment_accounts").insert({
      id: paymentAccountId,
      event_id: eventId,
      account_name: "حساب اختبار حاضر",
      account_number: "123456789",
      beneficiary: "مستفيد اختبار حاضر",
      sort_order: 1,
      is_active: true,
    }),
    "Create event-specific payment account",
  );

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ar",
    timezoneId: "Africa/Khartoum",
    reducedMotion: "reduce",
  });

  // Seed the real Supabase Auth session before the app initializes its browser client.
  // This exercises authenticated UI behavior without depending on an external Google OAuth callback.
  const projectRef = new URL(url).hostname.split(".")[0];
  await context.addInitScript(
    ({ storageKey, session }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    },
    { storageKey: `sb-${projectRef}-auth-token`, session: signedIn.session },
  );

  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "Authenticated home page must return HTTP 200");
  await page.getByRole("heading", { name: "رائج الآن" }).waitFor();
  await page.locator("#haddir-splash").waitFor({ state: "detached", timeout: 10000 });

  const mainNavigation = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  await mainNavigation.getByRole("button", { name: "الملف الشخصي" }).click();
  await page.getByRole("strong").filter({ hasText: email }).waitFor();
  await page.getByText("0912345678", { exact: true }).waitFor();

  await mainNavigation.getByRole("button", { name: "الرئيسية" }).click();
  const eventTitle = `Haddir Authenticated UI ${suffix.slice(0, 8)}`;
  const eventCard = page.getByRole("button", { name: `عرض تفاصيل ${eventTitle}` });
  await eventCard.waitFor({ state: "visible", timeout: 15000 });
  await eventCard.click();

  await page.getByRole("heading", { name: eventTitle, level: 1 }).waitFor();
  await page.getByRole("button", { name: /تذكرة اختبار الدفع/ }).click();
  await page.getByRole("button", { name: /ادفع الآن/ }).click();

  await page.getByRole("heading", { name: "إتمام الحجز" }).waitFor();
  await page.getByRole("heading", { name: "طريقة الدفع" }).waitFor();

  const accountSelector = page.getByRole("button", { name: "اختيار حساب التحويل" });
  await accountSelector.waitFor({ state: "visible" });
  await accountSelector.click();
  await page.getByRole("option", { name: "حساب اختبار حاضر" }).click();
  await page.getByText("123456789", { exact: true }).waitFor();
  await page.getByText("مستفيد اختبار حاضر", { exact: true }).waitFor();

  const receiptInput = page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]');
  await receiptInput.setInputFiles({
    name: "haddir-authenticated-ui-receipt.png",
    mimeType: "image/png",
    buffer: receiptBytes,
  });
  await page.getByText("haddir-authenticated-ui-receipt.png", { exact: true }).waitFor();

  const submitButton = page.getByRole("button", { name: /إرسال طلب الدفع للمراجعة/ });
  await submitButton.waitFor({ state: "visible" });
  await submitButton.click();
  await page.getByRole("alertdialog", { name: "استلمنا طلب حجزك!" }).waitFor({ timeout: 20000 });

  const booking = await dataOrThrow(
    await admin.from("bookings")
      .select("id,booking_number,status,user_id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .single(),
    "Verify browser-created customer booking",
  );
  assert.equal(booking.status, "under_review", "Submitted browser booking must enter payment review");

  const bookingItems = await dataOrThrow(
    await admin.from("booking_items")
      .select("quantity,unit_price,line_total")
      .eq("booking_id", booking.id),
    "Verify selected ticket quantity and total",
  );
  assert.equal(bookingItems.length, 1);
  assert.equal(bookingItems[0].quantity, 1);
  assert.equal(Number(bookingItems[0].unit_price), 250);
  assert.equal(Number(bookingItems[0].line_total), 250);

  const payment = await dataOrThrow(
    await admin.from("payment_submissions")
      .select("status,receipt_path,payment_account_id,payment_account_name,payment_account_number,payment_account_beneficiary")
      .eq("booking_id", booking.id)
      .single(),
    "Verify browser payment submission and event account snapshot",
  );
  assert.equal(payment.status, "submitted");
  assert.equal(payment.payment_account_id, paymentAccountId);
  assert.equal(payment.payment_account_name, "حساب اختبار حاضر");
  assert.equal(payment.payment_account_number, "123456789");
  assert.equal(payment.payment_account_beneficiary, "مستفيد اختبار حاضر");
  ));
  receiptPath = payment.receipt_path;

  const storedReceipt = await dataOrThrow(
    await admin.storage.from("payment-receipts").download(receiptPath),
    "Verify the receipt uploaded by the browser exists in private Storage",
  );
  assert.equal(storedReceipt.type, "image/webp", "The browser upload flow must store optimized WebP receipts.");
  const storedReceiptBytes = Buffer.from(await storedReceipt.arrayBuffer());
  assert.equal(storedReceiptBytes.subarray(0, 4).toString("ascii"), "RIFF", "Stored WebP must have a RIFF container header.");
  assert.equal(storedReceiptBytes.subarray(8, 12).toString("ascii"), "WEBP", "Stored receipt must contain actual WebP image data.");

  assert.deepEqual(pageErrors, [], `Authenticated browser page must not throw runtime errors: ${pageErrors.join("; ")}`);
  assert.deepEqual(consoleErrors, [], `Authenticated browser page must not emit console errors: ${consoleErrors.join("; ")}`);

  console.log("PASS: authenticated Chromium customer session, profile identity, event checkout, event-specific payment instructions, browser receipt upload, payment submission, and persisted booking/payment state.");
} finally {
  if (browser) await browser.close();
  if (receiptPath) await admin.storage.from("payment-receipts").remove([receiptPath]);
  if (eventCreated) await admin.from("events").delete().eq("id", eventId);
  if (userId) await admin.auth.admin.deleteUser(userId);
}
