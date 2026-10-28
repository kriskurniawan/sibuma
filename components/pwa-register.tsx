"use client";

import { useEffect } from "react";
import { toast } from "sonner";

// Only caches that may contain pre-v2 authenticated HTML. The current static
// cache holds no private documents and must survive a normal page load.
const LEGACY_CACHE_PREFIXES = ["lembur-shell-", "sibuma-static-v1"];

async function clearLegacyCaches() {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) =>
        LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)),
      )
      .map((key) => caches.delete(key)),
  );
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    // Remove legacy caches that stored authenticated HTML. The old worker may
    // still be active, so clean up from the page as well.
    clearLegacyCaches().catch(() => undefined);

    let disposed = false;
    let reloadRequested = false;
    let registration: ServiceWorkerRegistration | null = null;

    function offerUpdate(worker: ServiceWorker | null) {
      if (!worker || disposed) return;
      toast("Versi baru SIBUMA tersedia", {
        id: "sibuma-update",
        description:
          "Simpan pekerjaan yang sedang berjalan, lalu muat ulang untuk memakai versi terbaru.",
        duration: Infinity,
        action: {
          label: "Muat ulang",
          onClick: () => {
            reloadRequested = true;
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        },
        cancel: {
          label: "Nanti",
          onClick: () => undefined,
        },
      });
    }

    function watchRegistration(current: ServiceWorkerRegistration) {
      if (current.waiting && navigator.serviceWorker.controller) {
        offerUpdate(current.waiting);
      }
      current.addEventListener("updatefound", () => {
        const installing = current.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            offerUpdate(current.waiting ?? installing);
          }
        });
      });
    }

    function register() {
      navigator.serviceWorker
        .register("/sw.js")
        .then((current) => {
          if (disposed) return;
          registration = current;
          watchRegistration(current);
          current.update().catch(() => undefined);
        })
        .catch(() => {
          // PWA support is an enhancement; registration failures are non-fatal.
        });
    }

    function onControllerChange() {
      if (reloadRequested) window.location.reload();
    }

    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      registration?.update().catch(() => undefined);
    }

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    document.addEventListener("visibilitychange", onVisibility);

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      disposed = true;
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}

/** Best-effort cleanup used on logout so the next user cannot read cached pages. */
export async function clearPrivateBrowserCache() {
  clearLegacyCaches().catch(() => undefined);
  try {
    // Per-tab checklist drafts contain free-text findings and must not survive
    // an account switch on a shared device.
    const keys = Object.keys(window.sessionStorage);
    for (const key of keys) {
      if (key.startsWith("sibuma:draft:")) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable; logout still expires the server session.
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_CACHES" });
  }
}
