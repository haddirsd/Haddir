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
const eventId = randomUUID();
const ticketTypeId = randomUUID();
let browser;
let eventCreated = false;
const pageErrors = [];
const consoleErrors = [];

async function dataOrThrow(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

async function interactionDiagnostics(page, label, error) {
  const overlay = await page.locator("nextjs-portal").innerText().catch(() => "");
  const splash = await page.locator("#haddir-splash").count().catch(() => 0);
  return new Error([
    `${label}: ${error.message}`,
    `Page errors: ${pageErrors.join(" | ") || "none"}`,
    `Console errors: ${consoleErrors.join(" | ") || "none"}`,
    `Next.js overlay: ${overlay || "not available"}`,
    `Welcome splash still mounted: ${splash > 0}`,
  ].join("\\n"));
}

try {
  await dataOrThrow(
    await admin.from("events").insert({
      id: eventId,
      title: `Haddir Browser UI ${suffix.slice(0, 8)}`,
      slug: `haddir-browser-${suffix}`,
      category: "اختبار الواجهة",
      city: "الخرطوم",
      venue: "موقع اختبار الواجهة",
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 172_800_000).toISOString(),
      is_continuous: false,
      description: "فعالية مؤقتة لاختبار عرض الواجهة والتنقل واختيار التذاكر.",
      status: "published",
      is_trending: false,
    }),
    "Create isolated browser UI event",
  );
  eventCreated = true;

  await dataOrThrow(
    await admin.from("ticket_types").insert({
      id: ticketTypeId,
      event_id: eventId,
      name: "تذكرة اختبار الواجهة",
      description: "فئة مؤقتة لاختبار المتصفح",
      price: 250,
      currency: "SDG",
      quantity_total: 5,
      quantity_sold: 0,
      is_active: true,
    }),
    "Create isolated browser UI ticket type",
  );

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ar",
    timezoneId: "Africa/Khartoum",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, "Home page must return HTTP 200");
  await page.getByRole("heading", { name: "رائج الآن" }).waitFor();
  const eventCard = page.getByRole("button", { name: `عرض تفاصيل Haddir Browser UI ${suffix.slice(0, 8)}` });
  await eventCard.waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#haddir-splash").waitFor({ state: "detached", timeout: 10000 });
  await eventCard.click();

  await page.getByRole("heading", { name: `Haddir Browser UI ${suffix.slice(0, 8)}`, level: 1 }).waitFor();
  await page.getByRole("heading", { name: "فئات التذاكر" }).waitFor();
  const continueButton = page.getByRole("button", { name: /ادفع الآن/ });
  assert.equal(await continueButton.isDisabled(), true, "Payment must remain disabled until a ticket tier is selected");

  await page.getByRole("button", { name: /تذكرة اختبار الواجهة/ }).click();
  assert.equal(await continueButton.isDisabled(), false, "Selecting an available ticket tier must enable continuation");
  await page.getByRole("button", { name: "زيادة عدد التذاكر" }).click();
  await page.getByText("2 تذاكر", { exact: true }).waitFor();

  try {
    await continueButton.click({ timeout: 7000 });
  } catch (error) {
    throw await interactionDiagnostics(page, "Payment button interaction failed", error);
  }
  await page.getByRole("dialog", { name: "سجّل الدخول لإكمال الحجز" }).waitFor();
  await page.getByRole("button", { name: "لاحقاً" }).click();

  // Event details intentionally hide the mobile bottom navigation.
  // Reload the home screen before testing the independent profile entry point.
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const mainNavigation = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  await mainNavigation.waitFor({ state: "visible" });
  await page.locator("#haddir-splash").waitFor({ state: "detached", timeout: 10000 });

  try {
    await mainNavigation.getByRole("button", { name: "الملف الشخصي" }).click({ timeout: 7000 });
  } catch (error) {
    throw await interactionDiagnostics(page, "Profile navigation interaction failed", error);
  }
  await page.getByRole("heading", { name: "سجّل الدخول إلى حاضر" }).waitFor();
  await page.getByRole("button", { name: /المتابعة باستخدام Google/ }).waitFor();

  assert.deepEqual(pageErrors, [], `Browser page must not throw runtime errors: ${pageErrors.join("; ")}`);
  console.log("PASS: real Chromium mobile UI renders published events, opens event details, selects ticket tiers, updates quantity, enforces login before booking, and displays the profile sign-in entry point.");
} finally {
  if (browser) await browser.close();
  if (eventCreated) await admin.from("events").delete().eq("id", eventId);
}
