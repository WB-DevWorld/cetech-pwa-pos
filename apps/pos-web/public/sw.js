const WORKER_URL = new URL(self.location.href);
const BUILD_ID = (WORKER_URL.searchParams.get("build") ?? "unversioned").replace(/[^A-Za-z0-9._-]/g, "_");
const SHELL_CACHE = `cetech-pos-shell-${BUILD_ID}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  // Deliberately do not call skipWaiting(). CORE-07 activates a waiting worker
  // only after transaction/update-safety checks pass in the client coordinator.
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.add(OFFLINE_URL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("cetech-pos-shell-") && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CORE07_ACTIVATE_WAITING_UPDATE") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API/auth/business responses. Static build assets are immutable
  // and replaceable; business state remains in IndexedDB/server truth.
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      }),
    );
  }
});
