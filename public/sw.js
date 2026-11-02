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

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const decoded = self.atob(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = typeof data.title === "string" && data.title ? data.title : "SIBUMA";
  const body =
    typeof data.body === "string" && data.body
      ? data.body
      : "Ada pemberitahuan baru.";
  const href =
    typeof data.href === "string" && data.href.startsWith("/")
      ? data.href
      : "/notifikasi";
  const notificationId =
    typeof data.notificationId === "string" ? data.notificationId : null;
  const tag = typeof data.tag === "string" ? data.tag : "sibuma";

  event.waitUntil(
    self.registration
      .showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag,
        renotify: false,
        data: { href, notificationId },
      })
      .then(async () => {
        // Lencana dan kotak masuk yang sedang terbuka ikut diperbarui.
        const windows = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of windows) {
          client.postMessage({ type: "NOTIFICATIONS_CHANGED" });
        }
      }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const href =
    typeof data.href === "string" && data.href.startsWith("/")
      ? data.href
      : "/notifikasi";
  const notificationId =
    typeof data.notificationId === "string" ? data.notificationId : null;

  event.waitUntil(
    (async () => {
      // Tandai dibaca tanpa menunggu aplikasi terbuka. Jika sesi sudah berakhir,
      // permintaan ini gagal dengan aman dan notifikasi tetap tersimpan.
      if (notificationId) {
        try {
          await fetch("/api/notifikasi/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [notificationId] }),
          });
        } catch {
          // Offline atau sesi berakhir; buka aplikasi tetap dilanjutkan.
        }
      }

      const target = new URL(href, self.location.origin).href;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        try {
          await existing.focus();
        } catch {
          // Fokus dapat ditolak; navigasi tetap dicoba.
        }
        if ("navigate" in existing) {
          try {
            await existing.navigate(target);
            return;
          } catch {
            // Jatuh ke tab baru bila navigasi tidak diizinkan.
          }
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const response = await fetch("/api/notifikasi/push", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!data.configured || typeof data.publicKey !== "string") return;

        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });
        await fetch("/api/notifikasi/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
      } catch {
        // Pengguna dapat mengaktifkan ulang dari halaman Notifikasi.
      }
    })(),
  );
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
