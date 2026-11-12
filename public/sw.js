const CACHE_NAME = "haddir-static-v8";
const PRECACHE_URLS = [
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/light.svg",
  "/dark.svg",
  "/ticket.svg",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
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
