"use client";

import type { PushSubscriptionInput } from "./notification-types";

export type PushCapability =
  | "unsupported"
  | "default"
  | "denied"
  | "granted";

export type PushActivationResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unsupported" | "denied" | "unconfigured" | "failed";
      message: string;
    };

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const decoded = window.atob(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

export function pushCapability(): PushCapability {
  if (typeof window === "undefined") return "unsupported";
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "default";
}

export async function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  return (
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await navigator.serviceWorker.register("/sw.js"))
  );
}

async function currentSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  // Jangan mendaftarkan worker baru saat sekadar menyelaraskan langganan;
  // pendaftaran hanya terjadi ketika pengguna mengaktifkan notifikasi.
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration?.pushManager) return null;
  return registration.pushManager.getSubscription();
}

export async function localPushState() {
  const capability = pushCapability();
  if (capability === "unsupported") {
    return { capability, subscribed: false };
  }
  const subscription = await currentSubscription().catch(() => null);
  return { capability, subscribed: Boolean(subscription) };
}

function toPayload(subscription: PushSubscription): PushSubscriptionInput | null {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    expirationTime: json.expirationTime ?? null,
  };
}

async function attachSubscription(subscription: PushSubscription) {
  const payload = toPayload(subscription);
  if (!payload) throw new Error("Data langganan perangkat tidak lengkap.");
  const response = await fetch("/api/notifikasi/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(data?.message ?? "Perangkat gagal didaftarkan.");
  }
}

/**
 * Dipanggil dari klik pengguna. Izin diminta lebih dulu agar tetap dianggap
 * gestur pengguna oleh Safari/iOS, lalu langganan dikirim ke server.
 */
export async function activatePush(
  publicKey: string,
): Promise<PushActivationResult> {
  if (pushCapability() === "unsupported") {
    return {
      ok: false,
      reason: "unsupported",
      message: "Browser ini belum mendukung notifikasi push.",
    };
  }
  if (!publicKey) {
    return {
      ok: false,
      reason: "unconfigured",
      message: "Notifikasi perangkat belum diaktifkan admin.",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      reason: "denied",
      message: "Izin notifikasi ditolak. Kamu tetap menerima pemberitahuan di aplikasi.",
    };
  }

  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration?.pushManager) {
      return {
        ok: false,
        reason: "unsupported",
        message: "Perangkat ini belum siap menerima notifikasi.",
      };
    }

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));
    await attachSubscription(subscription);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: "failed",
      message:
        error instanceof Error
          ? error.message
          : "Notifikasi perangkat gagal diaktifkan. Coba lagi.",
    };
  }
}

/** Melepas perangkat ini dari akun yang sedang aktif. */
export async function detachPushSubscription() {
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return;

  try {
    await fetch("/api/notifikasi/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch {
    // Server juga akan menghapus langganan saat endpoint mengembalikan 404/410.
  }
  await subscription.unsubscribe().catch(() => false);
}

/**
 * Menyelaraskan langganan perangkat dengan akun yang sedang login. Berguna saat
 * akun berganti tanpa logout: perangkat tidak boleh menerima push akun lama.
 */
export async function syncPushSubscription() {
  const capability = pushCapability();
  if (capability === "unsupported") return;
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return;

  if (capability !== "granted") {
    await detachPushSubscription();
    return;
  }

  await attachSubscription(subscription).catch(() => undefined);
}
