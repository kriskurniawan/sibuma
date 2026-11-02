export type AppNotificationKind = "pekerjaan_baru" | "catatan_baru";

export type AppNotificationSource = "pekerjaan" | "catatan";

/** Dipakai komponen klien untuk menyegarkan lencana setelah status dibaca berubah. */
export const NOTIFICATION_CHANGED_EVENT = "sibuma:notifications-changed";

/** Satu baris kotak masuk. Ringkasan dibuat saat kejadian, bukan dihitung ulang. */
export interface AppNotificationItem {
  id: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  href: string;
  actorName: string;
  readAt: string | null;
  createdAt: string;
}

export interface AppNotificationPage {
  items: AppNotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
}

/** Data langganan yang dikirim browser setelah `pushManager.subscribe`. */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
}
