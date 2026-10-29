/*
 * SIBUMA service worker.
 *
 * Policy: online-first. Private/personalized HTML is never stored in the Cache
 * API, because a cached document can outlive logout or an account switch on a
 * shared phone. Only public, versionless shell assets are precached.
 */
const CACHE_NAME = "sibuma-static-v3";
const LEGACY_CACHE_PREFIXES = ["lembur-shell-", "sibuma-static-"];
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined),
  );
  // Never take over an open form without the user choosing to update.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== CACHE_NAME &&
                LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (data.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) =>
                LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)),
              )
              .map((key) => caches.delete(key)),
          ),
        ),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API responses are always network-only; they must never be reused offline.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/_vercel/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    // Do not cache navigation responses. On failure show a neutral offline page
    // that contains no account, checklist, or location data.
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return (
          offline ||
          new Response("Tidak ada koneksi internet.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              event.waitUntil(
                caches
                  .open(CACHE_NAME)
                  .then((cache) => cache.put(request, copy))
                  .catch(() => undefined),
              );
            }
            return response;
          }),
      ),
    );
  }
});
