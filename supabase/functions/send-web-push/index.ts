import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildPushPayload,
  type PushSubscription,
  type VapidKeys,
} from "npm:@block65/webcrypto-web-push@2.0.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const isTrustedPushEndpoint = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com"
      || host.endsWith(".push.apple.com")
      || host === "push.apple.com"
      || host.endsWith(".push.services.mozilla.com")
      || host.endsWith(".notify.windows.com")
      || host.endsWith(".push.samsung.com");
  } catch {
    return false;
  }
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Push service is not configured" }, 503);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: config, error: configError } = await admin.rpc("get_haddir_push_config");
  if (configError || !config?.private_key || !config?.public_key || !config?.hook_secret) {
    return json({ error: "Push credentials are unavailable" }, 503);
  }

  const suppliedSecret = req.headers.get("x-haddir-push-hook") || "";
  if (suppliedSecret.length !== config.hook_secret.length || suppliedSecret !== config.hook_secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: {
    user_id?: string;
    notification_id?: string;
    title?: string;
    message?: string;
    type?: string;
    url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!body.user_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.user_id)
    || !body.title || !body.message) {
    return json({ error: "A valid user_id, title and message are required" }, 400);
  }

  const { data: rows, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,subscription")
    .eq("user_id", body.user_id);

  if (subscriptionsError) return json({ error: "Could not load push subscriptions" }, 500);
  if (!rows?.length) return json({ sent: 0, expired: 0, failed: 0, status: "no_subscriptions" });

  const vapid: VapidKeys = {
    subject: "https://haddir-ticket.vercel.app",
    publicKey: config.public_key,
    privateKey: config.private_key,
  };
  const safeUrl = typeof body.url === "string" && body.url.startsWith("/") && !body.url.startsWith("//")
    ? body.url
    : "/?tab=notifications";

  let sent = 0;
  let expired = 0;
  let failed = 0;

  await Promise.all(rows.map(async (row) => {
    if (!isTrustedPushEndpoint(row.endpoint)) {
      failed += 1;
      return;
    }

    try {
      const subscription = row.subscription as PushSubscription;
      const payload = await buildPushPayload({
        data: {
          title: body.title,
          body: body.message,
          url: safeUrl,
          tag: body.notification_id || body.type || "haddir-notification",
          icon: "/icons/icon-192-brand.svg",
          badge: "/icons/icon-192-brand.svg",
        },
        options: { ttl: 60 * 60, urgency: "high" },
      }, subscription, vapid);

      const response = await fetch(row.endpoint, payload);
      if (response.status === 404 || response.status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", row.id);
        expired += 1;
      } else if (response.ok) {
        sent += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }));

  return json({ sent, expired, failed, status: "processed" });
});
