import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3002";
for (const [name, value] of Object.entries({ supabaseUrl, anonKey, serviceRoleKey })) {
  assert.ok(value, `Missing required environment variable: ${name}`);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const publicClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const suffix = randomUUID();
const email = `haddir-auth-session-${suffix}@example.test`;
const password = `Haddir-Auth-Session-${randomUUID()}-Aa1!`;
const errors = [];
const consoleErrors = [];
const failedResponses = [];
let browser;
let userId;

async function data(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

try {
  const created = await data(await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Haddir Auth Session Test" },
  }), "Create isolated email-auth user");
  userId = created.user.id;

  await data(await admin.from("profiles").upsert({
    id: userId,
    full_name: "Haddir Auth Session Test",
    phone: "0912345678",
    role: "customer",
  }), "Create isolated customer profile");

  const rejected = await publicClient.auth.signInWithPassword({
    email,
    password: "Wrong-password-123!",
  });
  assert.ok(rejected.error, "Invalid password must be rejected");
  assert.equal(rejected.data.session, null, "Invalid password must not create a session");

  const signedIn = await data(await publicClient.auth.signInWithPassword({ email, password }),
    "Sign in with email and password");
  assert.equal(signedIn.user.id, userId);
  assert.ok(signedIn.session?.access_token);
  assert.ok(signedIn.session?.refresh_token);

  const refreshed = await data(await publicClient.auth.refreshSession({
    refresh_token: signedIn.session.refresh_token,
  }), "Refresh the email-auth session");
  assert.equal(refreshed.user.id, userId);
  assert.ok(refreshed.session?.access_token);
  assert.ok(refreshed.session?.refresh_token);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ar",
    timezoneId: "Africa/Khartoum",
    reducedMotion: "reduce",
  });
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session));
  }, { key: storageKey, session: refreshed.session });

  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.stack || error.message));
  page.on("response", response => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
  });
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("Failed to load resource:")) {
      consoleErrors.push(message.text());
    }
  });

  const homeResponse = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  assert.equal(homeResponse?.status(), 200);
  const navigation = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  await navigation.getByRole("button", { name: "الملف الشخصي" }).click();
  await page.getByRole("strong").filter({ hasText: email }).waitFor({ timeout: 15000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await navigation.getByRole("button", { name: "الملف الشخصي" }).click();
  await page.getByRole("strong").filter({ hasText: email }).waitFor({ timeout: 15000 });
  const persisted = await page.evaluate(key => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }, storageKey);
  assert.equal(persisted?.user?.id, userId, "Reload must preserve the authenticated Supabase user session");

  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  const logoutDialog = page.getByRole("dialog", { name: "تسجيل الخروج؟" });
  await logoutDialog.waitFor();
  await logoutDialog.getByRole("button", { name: "تسجيل الخروج" }).click();
  await page.getByText(/تم تسجيل الخروج بنجاح/).waitFor({ timeout: 15000 });
  await page.getByRole("heading", { name: "سجّل الدخول إلى حاضر" }).waitFor();
  const cleared = await page.evaluate(key => localStorage.getItem(key), storageKey);
  assert.equal(cleared, null, "Sign out must clear the persisted Supabase session");

  // Exercise the actual email/password form, including invalid credentials and recovery.
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill("Wrong-password-123!");
  await page.getByRole("button", { name: "تسجيل الدخول بالبريد الإلكتروني" }).click();
  await page.getByText("البريد الإلكتروني أو كلمة المرور غير صحيحة.").waitFor({ timeout: 15000 });
  assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), null,
    "Rejected email credentials must not persist a session");

  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "تسجيل الدخول بالبريد الإلكتروني" }).click();
  await page.getByRole("strong").filter({ hasText: email }).waitFor({ timeout: 15000 });
  const emailLoginSession = await page.evaluate(key => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }, storageKey);
  assert.equal(emailLoginSession?.user?.id, userId,
    "Successful UI email login must persist the authenticated user session");

  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  const secondLogoutDialog = page.getByRole("dialog", { name: "تسجيل الخروج؟" });
  await secondLogoutDialog.waitFor();
  await secondLogoutDialog.getByRole("button", { name: "تسجيل الخروج" }).click();
  await page.getByRole("heading", { name: "سجّل الدخول إلى حاضر" }).waitFor({ timeout: 15000 });

  // Verify the actual UI starts a Google OAuth authorization request.
  // The local test intercepts the provider endpoint; it does not claim to authenticate
  // against Google's external identity service or validate production OAuth credentials.
  let authorizationUrl;
  await page.route("**/auth/v1/authorize**", async route => {
    authorizationUrl = new URL(route.request().url());
    await route.fulfill({
      status: 302,
      headers: { location: `${baseUrl}/?oauth-test=redirect-intercepted` },
    });
  });
  await page.getByRole("button", { name: /المتابعة باستخدام Google/ }).click();
  await page.waitForURL(url => url.searchParams.get("oauth-test") === "redirect-intercepted", { timeout: 15000 });
  assert.ok(authorizationUrl, "Google button must request the Supabase OAuth authorize endpoint");
  assert.equal(authorizationUrl.searchParams.get("provider"), "google");
  assert.equal(authorizationUrl.searchParams.get("redirect_to"), new URL(baseUrl).origin,
    "Google OAuth must return to the current application origin");

  assert.deepEqual(errors, [], `Auth browser runtime errors: ${errors.join("; ")}`);
  assert.deepEqual(consoleErrors, [], `Auth browser console errors: ${consoleErrors.join("; ")}`);
  assert.equal(failedResponses.length, 1, "Only the deliberate invalid-password request may return an HTTP error");
  assert.equal(failedResponses[0].status, 400);
  assert.ok(failedResponses[0].url.includes("/auth/v1/token"),
    "The expected 400 response must come from Supabase password authentication");
  console.log("PASS: email/password authentication rejects invalid credentials, creates and refreshes a real Supabase session, browser session survives reload, logout clears the session, and Google OAuth UI sends the expected provider, redirect URI, ");
} finally {
  if (browser) await browser.close();
  if (userId) await admin.auth.admin.deleteUser(userId);
}
