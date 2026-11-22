const CACHE_NAME = "haddir-static-v19";
const PRECACHE_URLS = [
  "/icons/icon-192-brand.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-brand.svg",
  "/icons/apple-touch-icon-brand.svg",
  "/light.svg",
  "/dark.svg",
  "/ticket.svg",
  "/offline.html",
];


const PUSH_DIAGNOSTICS_CACHE = "haddir-push-diagnostics-v1";
const PUSH_DIAGNOSTICS_KEY = new URL("/__haddir_push_diagnostics__", self.location.origin).href;

async function readPushDiagnostics() {
  const cache = await caches.open(PUSH_DIAGNOSTICS_CACHE);
  const response = await cache.match(PUSH_DIAGNOSTICS_KEY);
  if (!response) return [];
  try { return await response.json(); } catch { return []; }
}

async function recordPushDiagnostic(stage, details = {}) {
  const cache = await caches.open(PUSH_DIAGNOSTICS_CACHE);
  const entries = await readPushDiagnostics();
  entries.push({ stage, at: new Date().toISOString(), permission: self.Notification?.permission || "unknown", ...details });
  await cache.put(PUSH_DIAGNOSTICS_KEY, new Response(JSON.stringify(entries.slice(-20)), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      // Keep an update waiting until the user chooses "Update now".
      // The first installation activates normally because no older worker controls the page.
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "HADDIR_GET_PUSH_DIAGNOSTICS") {
    event.waitUntil(readPushDiagnostics().then((entries) => event.ports?.[0]?.postMessage({ entries })));
  }
  if (event.data?.type === "HADDIR_CLEAR_PUSH_DIAGNOSTICS") {
    event.waitUntil(caches.delete(PUSH_DIAGNOSTICS_CACHE).then(() => event.ports?.[0]?.postMessage({ cleared: true })));
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("haddir-static-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Keep the app shell available as a clear offline fallback without caching
  // authenticated page responses or user-specific account data.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offlinePage = await caches.match("/offline.html");
        return offlinePage || new Response(
          "<!doctype html><html lang='ar' dir='rtl'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>حاضر - بدون اتصال</title><body style='font-family:Arial,sans-serif;padding:32px;background:#1D135D;color:#F4F2FF;text-align:center'><h1>أنت غير متصل بالإنترنت</h1><p>اتصل بالشبكة ثم أعد المحاولة لعرض فعالياتك وتذاكرك.</p></body></html>",
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      })
    );
    return;
  }

  const isHashedNextAsset = url.pathname.startsWith("/_next/static/");
  const isPublicAppAsset = PRECACHE_URLS.includes(url.pathname);
  if (!isHashedNextAsset && !isPublicAppAsset) return;

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    await recordPushDiagnostic("push_event_received", { hasData: Boolean(event.data) });
    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch {
      payload = { body: event.data ? event.data.text() : "" };
    }

    const title = typeof payload.title === "string" && payload.title.trim()
      ? payload.title
      : "حاضر";
    const body = typeof payload.body === "string" && payload.body.trim()
      ? payload.body
      : "عندك تحديث جديد في حاضر.";
    const url = typeof payload.url === "string"
      && payload.url.startsWith("/")
      && !payload.url.startsWith("//")
      ? payload.url
      : "/?tab=notifications";
    const tag = typeof payload.tag === "string" && payload.tag
      ? payload.tag
      : "haddir-notification";

    await recordPushDiagnostic("payload_parsed", { title, body, url });

    const options = {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag,
      data: { url },
      timestamp: Date.now(),
      vibrate: [180, 80, 180],
      renotify: false,
      silent: false,
      dir: "rtl",
      lang: "ar",
    };

    try {
      await self.registration.showNotification(title, options);
      await recordPushDiagnostic("show_notification_succeeded", { title, tag });
      console.info("[Haddir SW] Push notification displayed", { tag });
    } catch (error) {
      await recordPushDiagnostic("show_notification_failed", { title, error: error instanceof Error ? error.message : String(error) });
      console.error("[Haddir SW] Notification display failed", error);
      await self.registration.showNotification(title, {
        body,
        tag,
        data: { url },
        dir: "rtl",
        lang: "ar",
      });
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/?tab=notifications", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
