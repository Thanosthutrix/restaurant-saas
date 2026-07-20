/* Service worker ubion — cache statique, pages visitées et navigation RSC (PWA offline). */
const STATIC_CACHE = "ubion-static-v3";
const PAGES_CACHE = "ubion-pages-v3";
const RSC_CACHE = "ubion-rsc-v3";
const ACTIVE_CACHES = [STATIC_CACHE, PAGES_CACHE, RSC_CACHE];
const OFFLINE_URL = "/offline.html";
const PRECACHE = ["/icon.svg", "/logo.svg", OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !ACTIVE_CACHES.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".ico")
  );
}

function isRscRequest(request) {
  const accept = request.headers.get("Accept") ?? "";
  return (
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1" ||
    accept.includes("text/x-component") ||
    new URL(request.url).searchParams.has("_rsc")
  );
}

function isDocumentRequest(request) {
  return request.mode === "navigate";
}

async function matchPathnameInCache(cacheName, pathname) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const req of keys) {
    if (new URL(req.url).pathname === pathname) {
      const match = await cache.match(req);
      if (match) return match;
    }
  }
  return null;
}

async function networkFirst(request, cacheName, options = {}) {
  const { pathnameFallback = false, offlineFallback = false } = options;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const exact = await caches.match(request);
    if (exact) return exact;

    if (pathnameFallback) {
      const pathname = new URL(request.url).pathname;
      const byPath = await matchPathnameInCache(cacheName, pathname);
      if (byPath) return byPath;
    }

    if (offlineFallback) {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }

    return new Response("Hors ligne", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, response.clone()));
            }
            return response;
          })
      )
    );
    return;
  }

  if (isDocumentRequest(event.request)) {
    event.respondWith(
      networkFirst(event.request, PAGES_CACHE, { pathnameFallback: true, offlineFallback: true })
    );
    return;
  }

  if (isRscRequest(event.request)) {
    event.respondWith(networkFirst(event.request, RSC_CACHE, { pathnameFallback: true }));
  }
});
