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
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Push service is not configured" }, 503);
  }

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

  const { data: deliveries, error: claimError } = await admin.rpc(
    "claim_haddir_web_push_deliveries",
    { p_limit: 50 },
  );
  if (claimError) {
    console.error("Could not claim Web Push deliveries", claimError.message);
    return json({ error: "Could not claim Web Push deliveries" }, 500);
  }

  if (!deliveries?.length) {
    return json({ processed: 0, sent: 0, expired: 0, retried: 0, failed: 0 });
  }

  const vapid: VapidKeys = {
    subject: "https://haddir-ticket.vercel.app",
    publicKey: config.public_key,
    privateKey: config.private_key,
  };

  let sent = 0;
  let expired = 0;
  let retried = 0;
  let failed = 0;
  let persistenceErrors = 0;

  await Promise.all(deliveries.map(async (delivery: {
    delivery_id: number;
    endpoint: string;
    subscription: PushSubscription;
    payload: { notification_id?: string; title?: string; message?: string; type?: string; url?: string };
    attempt_number: number;
  }) => {
    let outcome: "sent" | "expired" | "retry" | "failed" = "failed";
    let errorMessage: string | null = null;

    if (!isTrustedPushEndpoint(delivery.endpoint)) {
      errorMessage = "Untrusted push endpoint";
    } else {
      try {
        const safeUrl = typeof delivery.payload.url === "string"
          && delivery.payload.url.startsWith("/")
          && !delivery.payload.url.startsWith("//")
          ? delivery.payload.url
          : "/?tab=notifications";

        const payload = await buildPushPayload({
          data: {
            title: delivery.payload.title || "حاضِر",
            body: delivery.payload.message || "",
            url: safeUrl,
            tag: delivery.payload.notification_id || delivery.payload.type || "haddir-notification",
            icon: "/icons/icon-192-brand.svg",
            badge: "/icons/icon-192-brand.svg",
          },
          options: { ttl: 60 * 60, urgency: "high" },
        }, delivery.subscription, vapid);

        const response = await fetch(delivery.endpoint, {
          ...payload,
          signal: AbortSignal.timeout(10_000),
        });

        if (response.status === 404 || response.status === 410) {
          outcome = "expired";
        } else if (response.ok) {
          outcome = "sent";
        } else if (response.status === 408 || response.status === 429 || response.status >= 500) {
          outcome = "retry";
          errorMessage = `Push service returned HTTP ${response.status}`;
        } else {
          outcome = "failed";
          errorMessage = `Push service returned permanent HTTP ${response.status}`;
        }
      } catch (error) {
        outcome = "retry";
        errorMessage = error instanceof Error ? error.message : "Unknown network or payload error";
      }
    }

    const { error: completeError } = await admin.rpc("complete_haddir_web_push_delivery", {
      p_delivery_id: delivery.delivery_id,
      p_outcome: outcome,
      p_error: errorMessage,
    });

    if (completeError) {
      persistenceErrors += 1;
      console.error("Could not persist Web Push delivery result", delivery.delivery_id, completeError.message);
      return;
    }

    if (outcome === "sent") sent += 1;
    else if (outcome === "expired") expired += 1;
    else if (outcome === "retry") retried += 1;
    else failed += 1;
  }));

  if (persistenceErrors > 0) {
    return json({
      processed: deliveries.length,
      sent,
      expired,
      retried,
      failed,
      persistence_errors: persistenceErrors,
    }, 500);
  }

  return json({
    processed: deliveries.length,
    sent,
    expired,
    retried,
    failed,
    persistence_errors: 0,
  });
});
