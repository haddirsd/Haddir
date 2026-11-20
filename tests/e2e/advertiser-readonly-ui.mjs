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
const password = `Haddir-Advertiser-UI-${randomUUID()}-Aa1!`;
const ownEventId = randomUUID();
const otherEventId = randomUUID();
const ownTicketTypeId = randomUUID();
const otherTicketTypeId = randomUUID();
const users = [];
const pageErrors = [];
const consoleErrors = [];
let browser;
let ownEventCreated = false;
let otherEventCreated = false;

async function dataOrThrow(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

async function createIdentity(label) {
  const email = `advertiser-ui-${label}-${suffix}@example.test`;
  const created = await dataOrThrow(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Haddir Advertiser UI ${label}` },
    }),
    `Create ${label} identity`,
  );
  const user = created.user;
  assert.ok(user?.id, `${label} identity must be created`);
  users.push({ id: user.id });
  await dataOrThrow(
    await admin.from("profiles").upsert({
      id: user.id,
      full_name: `Haddir Advertiser UI ${label}`,
      phone: `09${String(Date.now()).slice(-7)}${users.length}`,
      role: "advertiser",
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
  assert.ok(signedIn.session?.access_token, `${label} must receive a real session`);
  return { id: user.id, email, client, session: signedIn.session };
}

async function createEvent(eventId, slug, title, createdBy) {
  await dataOrThrow(
    await admin.from("events").insert({
      id: eventId,
      title,
      slug: `${slug}-${suffix}`,
      category: "اختبار واجهة المعلن",
      city: "الخرطوم",
      venue: "موقع اختبار واجهة المعلن",
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 172_800_000).toISOString(),
      is_continuous: false,
      description: "فعالية مؤقتة لاختبار صلاحيات لوحة المعلن للقراءة فقط.",
      status: "published",
      is_trending: false,
      platform_fee_percent: 10,
      created_by: createdBy,
    }),
    `Create ${title}`,
  );
}

try {
  const advertiser = await createIdentity("assigned");
  const otherAdvertiser = await createIdentity("other");
  await dataOrThrow(
    await admin.from("legal_acceptances").insert([
      { user_id: advertiser.id, document_key: "organizer_terms_bundle", version: "2026-11-15-v1" },
      { user_id: otherAdvertiser.id, document_key: "organizer_terms_bundle", version: "2026-11-15-v1" },
    ]),
    "Create required organizer legal acceptance for isolated advertiser identities",
  );
  const ownTitle = `Haddir Advertiser Own ${suffix.slice(0, 8)}`;
  const otherTitle = `Haddir Advertiser Private ${suffix.slice(0, 8)}`;

  await createEvent(ownEventId, "haddir-advertiser-own", ownTitle, advertiser.id);
  ownEventCreated = true;
  await createEvent(otherEventId, "haddir-advertiser-other", otherTitle, otherAdvertiser.id);
  otherEventCreated = true;

  await dataOrThrow(
    await admin.from("ticket_types").insert([
      {
        id: ownTicketTypeId, event_id: ownEventId, name: "فئة المعلن المخصصة",
        price: 250, currency: "SDG", quantity_total: 20, quantity_sold: 0, is_active: true,
      },
      {
        id: otherTicketTypeId, event_id: otherEventId, name: "فئة فعالية أخرى",
        price: 500, currency: "SDG", quantity_total: 30, quantity_sold: 0, is_active: true,
      },
    ]),
    "Create isolated advertiser ticket categories",
  );

  await dataOrThrow(
    await admin.from("event_role_assignments").insert([
      { user_id: advertiser.id, event_id: ownEventId, assignment_role: "advertiser" },
      { user_id: otherAdvertiser.id, event_id: otherEventId, assignment_role: "advertiser" },
    ]),
    "Assign each advertiser to exactly one event",
  );

  const rpcResult = await dataOrThrow(
    await advertiser.client.rpc("get_advertiser_event_statistics"),
    "Load advertiser-scoped statistics",
  );
  assert.equal(rpcResult.event.id, ownEventId, "Advertiser RPC must return only its assigned event");
  assert.equal(rpcResult.event.title, ownTitle);
  assert.equal(rpcResult.ticket_types.length, 1);
  assert.equal(rpcResult.ticket_types[0].id, ownTicketTypeId);

  const unauthorizedUpdate = await advertiser.client
    .from("events").update({ title: "Unauthorized advertiser edit" })
    .eq("id", ownEventId).select("id");
  assert.equal(unauthorizedUpdate.error, null,
    "RLS may safely return zero updated rows without exposing an error");
  assert.equal(unauthorizedUpdate.data?.length || 0, 0,
    "Advertiser must not be able to update its assigned event");

  const unchangedEvent = await dataOrThrow(
    await admin.from("events").select("title").eq("id", ownEventId).single(),
    "Verify advertiser cannot change event data",
  );
  assert.equal(unchangedEvent.title, ownTitle);

  const unauthorizedTicketUpdate = await advertiser.client
    .from("ticket_types").update({ price: 1 }).eq("id", ownTicketTypeId).select("id");
  assert.equal(unauthorizedTicketUpdate.error, null);
  assert.equal(unauthorizedTicketUpdate.data?.length || 0, 0,
    "Advertiser must not be able to change ticket prices or inventory");

  const unchangedTicket = await dataOrThrow(
    await admin.from("ticket_types").select("price,quantity_total")
      .eq("id", ownTicketTypeId).single(),
    "Verify advertiser cannot change ticket data",
  );
  assert.equal(Number(unchangedTicket.price), 250);
  assert.equal(unchangedTicket.quantity_total, 20);

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
    { storageKey: `sb-${projectRef}-auth-token`, session: advertiser.session },
  );

  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const response = await page.goto(
    `${baseUrl}/?tab=profile`,
    { waitUntil: "domcontentloaded" },
  );
  assert.equal(response?.status(), 200, "Advertiser profile page must return HTTP 200");
  await page.getByRole("button", { name: /تفاصيل الفعالية/ }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /تفاصيل الفعالية/ }).click();
  await page.getByRole("heading", { name: "إحصائيات فعاليتك" }).waitFor({ timeout: 15000 });
  await page.getByText(ownTitle, { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText("فئة المعلن المخصصة", { exact: true }).waitFor();
  assert.equal(await page.getByText(otherTitle, { exact: true }).count(), 0,
    "Advertiser UI must not expose another advertiser's event");
  assert.equal(await page.getByText("فئة فعالية أخرى", { exact: true }).count(), 0,
    "Advertiser UI must not expose another event's ticket categories");
  const advertiserPanel = page.locator(".advertiser-statistics-panel");
  assert.equal(await advertiserPanel.getByRole("button", { name: /حفظ|تعديل|إضافة|حذف/ }).count(), 0,
    "Advertiser statistics workspace must not expose editing controls");

  assert.deepEqual(pageErrors, [],
    `Advertiser browser page must not throw runtime errors: ${pageErrors.join("; ")}`);
  assert.deepEqual(consoleErrors, [],
    `Advertiser browser page must not emit console errors: ${consoleErrors.join("; ")}`);

  console.log("PASS: assigned advertiser Chromium UI shows only its assigned event and ticket category; scoped statistics RPC excludes other events; event and ticket inventory updates are denied; dashboard remains read-only.");
} finally {
  if (browser) await browser.close();
  if (ownEventCreated) await admin.from("events").delete().eq("id", ownEventId);
  if (otherEventCreated) await admin.from("events").delete().eq("id", otherEventId);
  for (const user of users) await admin.auth.admin.deleteUser(user.id);
}
