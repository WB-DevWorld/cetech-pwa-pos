const WORKER_URL = new URL(self.location.href);
const BUILD_ID = (WORKER_URL.searchParams.get("build") ?? "unversioned").replace(/[^A-Za-z0-9._-]/g, "_");
const SHELL_CACHE = `cetech-pos-shell-${BUILD_ID}`;
const APP_SHELL_URL = "/";
const OFFLINE_URL = "/offline.html";

function shellAssetPaths(html) {
  return [...new Set(html.match(/\/_next\/static\/[^"'<>\s]+/g) ?? [])];
}

async function cacheAppShell(cache) {
  try {
    const response = await fetch(APP_SHELL_URL, { cache: "no-store" });
    if (!response.ok) return;

    await cache.put(APP_SHELL_URL, response.clone());

    const html = await response.text();
    await Promise.all(
      shellAssetPaths(html).map(async (assetPath) => {
        try {
          const asset = await fetch(assetPath);
          if (asset.ok) {
            await cache.put(assetPath, asset.clone());
          }
        } catch {
          // One replaceable asset failing must not make worker installation fail.
        }
      }),
    );
  } catch {
    // The static offline page still installs. A later successful navigation can
    // populate the real app shell without deleting local drafts/journal data.
  }
}

self.addEventListener("install", (event) => {
  // Deliberately do not call skipWaiting(). CORE-07 activates a waiting worker
  // only after transaction/update-safety checks pass in the client coordinator.
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await cache.add(OFFLINE_URL);
      await cacheAppShell(cache);
    }),
  );
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

  // Never cache API/auth/business responses. Only replaceable application-shell
  // documents/assets belong here; drafts, journal and business truth remain in
  // IndexedDB/server-owned stores.
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
      caches.open(SHELL_CACHE).then(async (cache) => {
        try {
          const response = await fetch(request);
          const contentType = response.headers.get("content-type") ?? "";
          if (response.ok && contentType.includes("text/html")) {
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          return (
            (await cache.match(request, { ignoreSearch: true })) ??
            (await cache.match(APP_SHELL_URL)) ??
            (await cache.match(OFFLINE_URL)) ??
            Response.error()
          );
        }
      }),
    );
  }
});
