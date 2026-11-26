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
const service = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = randomUUID();
const password = `Haddir-Admin-UI-${randomUUID()}-Aa1!`;
const users = [];
const events = [];
const bookings = [];
const errors = [];
const consoleErrors = [];
const networkFailures = [];
const networkFailureTasks = [];
let currentScenario = "test setup";
let browser;

async function data(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}
async function identity(label, role) {
  const email = `admin-ui-${label}-${suffix}@example.test`;
  const created = await data(await service.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: `Haddir Admin UI ${label}` },
  }), `Create ${label} Auth user`);
  const id = created.user.id;
  users.push(id);
  await data(await service.from("profiles").upsert({
    id, full_name: `Haddir Admin UI ${label}`,
    phone: `09${String(Date.now()).slice(-7)}${users.length}`, role,
  }), `Create ${label} profile`);
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signed = await data(await client.auth.signInWithPassword({ email, password }), `Sign in ${label}`);
  assert.ok(signed.session?.access_token);
  return { id, email, role, session: signed.session, client };
}
async function browserPage(user, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, locale: "ar", timezoneId: "Africa/Khartoum", reducedMotion: "reduce" });
  const projectRef = new URL(url).hostname.split(".")[0];
  await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
    key: `sb-${projectRef}-auth-token`, session: user.session,
  });
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.stack || e.message));
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("response", response => {
    if (response.status() < 400) return;
    const task = (async () => {
      let responseText = "<response body unavailable>";
      try {
        responseText = await response.text();
      } catch (error) {
        responseText = "<failed to read response body: " + error.message + ">";
      }
      const request = response.request();
      const requestUrl = new URL(request.url());
      networkFailures.push({
        scenario: currentScenario,
        status: response.status(),
        method: request.method(),
        url: requestUrl.origin + requestUrl.pathname,
        response: responseText,
      });
    })();
    networkFailureTasks.push(task);
  });
  return { context, page };
}
async function openAdmin(user) {
  const { page } = await browserPage(user);
  const response = await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200);
  return page;
}
async function createEventThroughUi(user, label) {
  currentScenario = "event UI flow: " + label;
  const page = await openAdmin(user);
  const nav = page.getByRole("navigation", { name: "تبويبات لوحة الإدارة" });
  await nav.getByRole("button", { name: "الفعاليات" }).click();
  await page.getByRole("heading", { name: "الفعاليات" }).waitFor();
  await page.getByRole("button", { name: "إضافة فعالية" }).click();
  const title = `Haddir Admin UI ${label} ${suffix.slice(0, 8)}`;
  const form = page.locator("form.admin-event-form");
  await form.getByLabel("اسم الفعالية *").fill(title);
  await form.getByLabel("فئة الفعالية").fill("اختبار صلاحيات الإدارة");
  await form.getByLabel("المدينة *").fill("الخرطوم");
  await form.getByLabel("المكان *").fill("موقع اختبار الإدارة");
  await form.getByLabel("الزمان / تاريخ ووقت البداية *").fill(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16));
  await form.getByLabel("اسم التذكرة *").fill("تذكرة اختبار الإدارة");
  await form.getByLabel("السعر *").fill("125");
  await form.getByLabel("الكمية المتاحة (اختياري)").fill("12");
  await form.getByRole("button", { name: "حفظ الفعالية" }).click();
  await page.getByText("تم إنشاء الفعالية والتذاكر وحسابات الدفع كمسودة في عملية واحدة.", { exact: true }).waitFor({ timeout: 20000 });
  const row = await data(await service.from("events").select("id,title,status,created_by").eq("title", title).single(), `Verify ${label} event persisted`);
  assert.equal(row.created_by, user.id);
  assert.equal(row.status, "draft");
  events.push(row.id);

  const card = page.locator("article.admin-event-card").filter({ hasText: title });
  await card.getByRole("button", { name: "تعديل" }).click();
  await form.getByLabel("اسم الفعالية *").fill(`${title} Edited`);
  await form.getByRole("button", { name: "حفظ التعديلات" }).click();
  await page.getByText("تم تحديث الفعالية والتذاكر وحسابات الدفع معاً بنجاح.", { exact: true }).waitFor({ timeout: 20000 });
  const edited = await data(await service.from("events").select("title,status").eq("id", row.id).single(), `Verify ${label} event edit persisted`);
  assert.equal(edited.title, `${title} Edited`);
  assert.equal(edited.status, "draft");

  const editedCard = page.locator("article.admin-event-card").filter({ hasText: `${title} Edited` });
  await editedCard.getByRole("button", { name: "نشر الفعالية" }).click();
  const publishDialog = page.getByRole("dialog", { name: "نشر الفعالية؟" });
  await publishDialog.getByRole("button", { name: "نشر الفعالية" }).click();
  await page.getByText("تم إرسال طلب النشر بنجاح.", { exact: true }).waitFor({ timeout: 20000 });
  const published = await data(await service.from("events").select("status").eq("id", row.id).single(), `Verify ${label} event publication persisted`);
  assert.equal(published.status, "published");
  await page.close();
  return { id: row.id, title: edited.title };
}

async function verifyEventDeletionGuards(owner) {
  currentScenario = "deletion guard: prepare eligible event";
  const deletionReady = await createEventThroughUi(owner, "DeletionReady");
  const eightDaysAgoDate = new Date(Date.now() - 8 * 86400000);
  const eightDaysAgo = eightDaysAgoDate.toISOString();
  const startsBeforeEightDaysAgo = new Date(eightDaysAgoDate.getTime() - 2 * 60 * 60 * 1000).toISOString();
  await data(await service.from("events").update({
    starts_at: startsBeforeEightDaysAgo,
    ends_at: eightDaysAgo,
  }).eq("id", deletionReady.id).select("id").single(),
    "Set eligible event end date");

  const eligiblePage = await openAdmin(owner);
  await eligiblePage.getByRole("navigation", { name: "تبويبات لوحة الإدارة" })
    .getByRole("button", { name: "الفعاليات" }).click();
  const eligibleCard = eligiblePage.locator("article.admin-event-card").filter({ hasText: deletionReady.title });
  const deleteButton = eligibleCard.getByRole("button", { name: "حذف" });
  await deleteButton.waitFor({ state: "visible" });
  assert.equal(await deleteButton.isDisabled(), false, "Event ended eight days ago should pass the UI date gate");
  await deleteButton.click();

  const dialog = eligiblePage.getByRole("dialog", { name: "تأكيد المحاسبة قبل حذف الفعالية" });
  const confirm = dialog.getByRole("button", { name: "نعم، تمت المحاسبة وأؤكد الحذف" });
  const eventName = dialog.getByRole("textbox", { name: "اكتب اسم الفعالية كما هو للتأكيد" });
  assert.equal(await confirm.isDisabled(), true, "Delete confirmation starts disabled");
  await eventName.fill(deletionReady.title + " wrong");
  assert.equal(await confirm.isDisabled(), true, "A non-matching event name cannot confirm deletion");
  await eventName.fill("  " + deletionReady.title + "  ");
  assert.equal(await confirm.isDisabled(), false, "A full name match after trimming outer whitespace enables confirmation");
  currentScenario = "deletion guard: eligible event, expected successful deletion";
  await confirm.click();
  await eligiblePage.getByRole("status").filter({ hasText: "تم حذف الفعالية وبياناتها التشغيلية" }).waitFor({ timeout: 20000 });
  const deletedRows = await data(await service.from("events").select("id").eq("id", deletionReady.id),
    "Verify eligible event deletion");
  assert.equal(deletedRows.length, 0, "Eligible event is deleted through the real admin flow");
  await eligiblePage.close();

  currentScenario = "deletion guard: prepare event with recent booking activity";
  const recentActivity = await createEventThroughUi(owner, "RecentActivity");
  const recentEnd = new Date(Date.now() + 2 * 86400000);
  const recentStart = new Date(recentEnd.getTime() - 2 * 60 * 60 * 1000).toISOString();
  await data(await service.from("events").update({
    starts_at: recentStart,
    ends_at: recentEnd.toISOString(),
  }).eq("id", recentActivity.id).select("id").single(), "Set event end date before creating recent booking");
  const booking = await data(await service.from("bookings").insert({
    booking_number: "HDR-E2E-" + suffix.slice(0, 12),
    user_id: owner.id,
    customer_name: "Haddir Admin UI owner",
    customer_email: owner.email,
    customer_phone: "0915000001",
    event_id: recentActivity.id,
    subtotal: 125,
    currency: "SDG",
    status: "confirmed",
    created_at: new Date().toISOString(),
  }).select("id").single(), "Create recent booking activity");
  bookings.push(booking.id);
  await data(await service.from("events").update({
    starts_at: startsBeforeEightDaysAgo,
    ends_at: eightDaysAgo,
    status: "completed",
  }).eq("id", recentActivity.id).select("id").single(), "Simulate editing ends_at into the past after booking");

  const recentPage = await openAdmin(owner);
  await recentPage.getByRole("navigation", { name: "تبويبات لوحة الإدارة" })
    .getByRole("button", { name: "الفعاليات" }).click();
  const recentCard = recentPage.locator("article.admin-event-card").filter({ hasText: recentActivity.title });
  const recentDeleteButton = recentCard.getByRole("button", { name: "حذف" });
  await recentDeleteButton.waitFor({ state: "visible" });
  assert.equal(await recentDeleteButton.isDisabled(), false, "Past end date enables the UI date gate before server activity validation");
  await recentDeleteButton.click();
  const recentDialog = recentPage.getByRole("dialog", { name: "تأكيد المحاسبة قبل حذف الفعالية" });
  await recentDialog.getByRole("textbox", { name: "اكتب اسم الفعالية كما هو للتأكيد" }).fill(recentActivity.title);
  currentScenario = "deletion guard: recent activity, expected server-side rejection";
  await recentDialog.getByRole("button", { name: "نعم، تمت المحاسبة وأؤكد الحذف" }).click();
  await recentPage.getByRole("status").filter({ hasText: "يوجد نشاط خلال آخر 7 أيام" }).waitFor({ timeout: 20000 });
  const retained = await data(await service.from("events").select("id").eq("id", recentActivity.id).single(),
    "Verify recent activity prevents deletion");
  assert.equal(retained.id, recentActivity.id, "Recent booking activity keeps the event intact");
  await recentPage.close();
}

async function verifyRoleManagement(owner, adminUser, customer, ordinaryCustomer, secondAdmin) {
  currentScenario = "role management UI";
  const ownerPage = await openAdmin(owner);
  const ownerNav = ownerPage.getByRole("navigation", { name: "تبويبات لوحة الإدارة" });
  await ownerNav.getByRole("button", { name: "المستخدمون" }).click();
  await ownerPage.getByRole("heading", { name: "المستخدمون" }).waitFor();
  const search = ownerPage.getByPlaceholder("رقم الهاتف أو البريد الإلكتروني");
  await search.fill(customer.email);
  const customerRow = ownerPage.locator("tr").filter({ hasText: customer.email });
  await customerRow.waitFor();
  const customerRole = customerRow.getByRole("button", { name: /تعديل دور/ });
  await customerRole.click();
  await ownerPage.getByRole("option", { name: "مشرف إداري" }).click();
  await customerRow.getByRole("button", { name: "حفظ الدور" }).click();
  await ownerPage.getByRole("dialog", { name: "تأكيد تغيير الصلاحية؟" }).getByRole("button", { name: "حفظ الصلاحية" }).click();
  await ownerPage.getByRole("status").filter({ hasText: "تم تحديث دور المستخدم بنجاح." }).waitFor({ timeout: 15000 });
  const changed = await data(await service.from("profiles").select("role").eq("id", customer.id).single(), "Verify owner role grant persisted");
  assert.equal(changed.role, "admin");

  await search.fill(owner.email);
  const ownerRow = ownerPage.locator("tr").filter({ hasText: owner.email });
  await ownerRow.waitFor();
  assert.equal(await ownerRow.getByRole("button", { name: /تعديل دور/ }).isDisabled(), true,
    "Owner account role selector must be disabled");
  await search.fill(adminUser.email);
  const adminRow = ownerPage.locator("tr").filter({ hasText: adminUser.email });
  await adminRow.waitFor();
  assert.equal(await adminRow.getByRole("button", { name: /تعديل دور/ }).isDisabled(), false,
    "Owner may manage another administrator");

  const adminPage = await openAdmin(adminUser);
  const adminNav = adminPage.getByRole("navigation", { name: "تبويبات لوحة الإدارة" });
  await adminNav.getByRole("button", { name: "المستخدمون" }).click();
  await adminPage.getByRole("heading", { name: "المستخدمون" }).waitFor();
  const adminSearch = adminPage.getByPlaceholder("رقم الهاتف أو البريد الإلكتروني");
  await adminSearch.fill(secondAdmin.email);
  const secondAdminRow = adminPage.locator("tr").filter({ hasText: secondAdmin.email });
  await secondAdminRow.waitFor();
  assert.equal(await secondAdminRow.getByRole("button", { name: /تعديل دور/ }).isDisabled(), true,
    "Administrator must not be able to edit another administrator");
  await adminSearch.fill(owner.email);
  const protectedOwnerRow = adminPage.locator("tr").filter({ hasText: owner.email });
  await protectedOwnerRow.waitFor();
  assert.equal(await protectedOwnerRow.getByRole("button", { name: /تعديل دور/ }).isDisabled(), true,
    "Administrator must not be able to edit the platform owner");
  await adminSearch.fill(ordinaryCustomer.email);
  const targetRow = adminPage.locator("tr").filter({ hasText: ordinaryCustomer.email });
  await targetRow.waitFor();
  await targetRow.getByRole("button", { name: /تعديل دور/ }).click();
  assert.equal(await adminPage.getByRole("option", { name: "مشرف إداري" }).count(), 0,
    "Administrator must not be offered the administrator role");
  await adminPage.getByRole("button", { name: "إغلاق القائمة" }).click();
  assert.equal(await targetRow.getByRole("button", { name: "حفظ الدور" }).isDisabled(), true,
    "Administrator role grant must remain unavailable");
  await ownerPage.close();
  await adminPage.close();
}

try {
  const owner = await identity("owner", "owner");
  const adminUser = await identity("administrator", "admin");
  const customer = await identity("customer", "customer");
  const secondAdmin = await identity("second-administrator", "admin");
  const ordinaryCustomer = await identity("ordinary-customer", "customer");
  const advertiser = await identity("advertiser", "advertiser");
  const gatekeeper = await identity("gatekeeper", "gatekeeper");
  browser = await chromium.launch({ headless: true });

  for (const restricted of [customer, advertiser, gatekeeper]) {
    const deniedPage = await openAdmin(restricted);
    await deniedPage.getByRole("heading", { name: "الوصول غير متاح" }).waitFor({ timeout: 15000 });
    await deniedPage.close();
  }

  for (const privileged of [owner, adminUser]) {
    const page = await openAdmin(privileged);
    const nav = page.getByRole("navigation", { name: "تبويبات لوحة الإدارة" });
    for (const section of ["نظرة عامة", "الفعاليات", "الحجوزات", "مراجعة المدفوعات", "المستخدمون", "الإحصائيات", "سجل الإجراءات", "إشعارات"]) {
      await nav.getByRole("button", { name: section }).waitFor({ state: "visible" });
    }
    await page.close();
  }

  await createEventThroughUi(owner, "Owner");
  await createEventThroughUi(adminUser, "Admin");
  await verifyEventDeletionGuards(owner);
  await verifyRoleManagement(owner, adminUser, customer, ordinaryCustomer, secondAdmin);

  assert.deepEqual(errors, [], `Admin UI runtime errors: ${errors.join("; ")}`);
  assert.deepEqual(consoleErrors, [], `Admin UI console errors: ${consoleErrors.join("; ")}`);
  console.log("PASS: owner/admin access and navigation, event create/edit/publish, deletion date gate, exact trimmed-name confirmation, recent-activity deletion rejection, and role-management protections.");
} finally {
  await Promise.allSettled(networkFailureTasks);
  if (networkFailures.length) {
    console.error("HTTP responses with status 400 or higher:", JSON.stringify(networkFailures, null, 2));
  } else {
    console.log("HTTP diagnostics: no responses with status 400 or higher were captured.");
  }
  if (browser) await browser.close();
  for (const bookingId of bookings) await service.from("bookings").delete().eq("id", bookingId);
  for (const eventId of events) await service.from("events").delete().eq("id", eventId);
  for (const userId of users) await service.auth.admin.deleteUser(userId);
}
