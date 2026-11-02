import "server-only";

import * as webpush from "web-push";
import type { QueryResultRow } from "pg";
import { query } from "./db";
import type { AppNotificationKind } from "./notification-types";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;
const LOCK_SECONDS = 120;
const RETRY_SECONDS = [60, 300, 900, 3600];
const PERMANENT_STATUS = new Set([400, 401, 403, 404, 410, 413]);

export interface PushConfig {
  configured: boolean;
  publicKey: string | null;
  subject: string;
  privateKey: string;
}

/** Dibaca ulang setiap pemanggilan agar perubahan environment langsung terpakai. */
export function getPushConfig(): PushConfig {
  const publicKey = (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    process.env.VAPID_PUBLIC_KEY ??
    ""
  ).trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
  const subject = (process.env.VAPID_SUBJECT ?? "mailto:admin@bmbi.my.id").trim();
  return {
    configured: Boolean(publicKey && privateKey),
    publicKey: publicKey || null,
    subject: subject || "mailto:admin@bmbi.my.id",
    privateKey,
  };
}

interface DeliveryRow extends QueryResultRow {
  id: string;
  notification_id: string;
  subscription_id: string;
  attempts: number;
  recipient_id: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  href: string;
  read_at: Date | string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface DeliveryResult {
  sent: number;
  failed: number;
  skipped: number;
  retried: number;
}

async function claimDeliveries() {
  return query<DeliveryRow>(
    `WITH due AS (
       SELECT id FROM push_deliveries
       WHERE (status='pending' AND next_attempt_at<=now())
          OR (status='processing' AND locked_until<now())
       ORDER BY next_attempt_at,id
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     ), claimed AS (
       UPDATE push_deliveries d
       SET status='processing',
           attempts=d.attempts+1,
           locked_until=now()+($2::integer * interval '1 second')
       FROM due
       WHERE d.id=due.id
       RETURNING d.*
     )
     SELECT c.id,c.notification_id,c.subscription_id,c.attempts,
            n.recipient_id,n.kind,n.title,n.body,n.href,n.read_at,
            s.endpoint,s.p256dh,s.auth
     FROM claimed c
     JOIN app_notifications n ON n.id=c.notification_id
     JOIN push_subscriptions s ON s.id=c.subscription_id`,
    [BATCH_SIZE, LOCK_SECONDS],
  );
}

function notificationPayload(row: DeliveryRow) {
  // Catatan dapat berisi informasi sensitif. Layar kunci hanya menampilkan
  // pemberitahuan umum; judul dan isi lengkap tetap ada di kotak masuk.
  if (row.kind === "catatan_baru") {
    return {
      title: "Catatan baru",
      body: "Ada catatan baru untuk Anda. Ketuk untuk membuka.",
      href: row.href,
      notificationId: row.notification_id,
      tag: `sibuma-${row.notification_id}`,
    };
  }
  return {
    title: row.title,
    body: row.body,
    href: row.href,
    notificationId: row.notification_id,
    tag: `sibuma-${row.notification_id}`,
  };
}

async function skipDelivery(id: string) {
  await query(
    `UPDATE push_deliveries
     SET status='skipped',locked_until=NULL,last_error='Sudah dibaca di aplikasi'
     WHERE id=$1`,
    [id],
  );
}

async function markFailed(id: string, message: string) {
  await query(
    `UPDATE push_deliveries
     SET status='failed',locked_until=NULL,last_error=$2
     WHERE id=$1`,
    [id, message.slice(0, 500)],
  );
}

async function markRetry(id: string, attempts: number, message: string) {
  const delay =
    RETRY_SECONDS[Math.min(attempts - 1, RETRY_SECONDS.length - 1)] ?? 3600;
  await query(
    `UPDATE push_deliveries
     SET status='pending',locked_until=NULL,next_attempt_at=now()+($2::integer * interval '1 second'),last_error=$3
     WHERE id=$1`,
    [id, delay, message.slice(0, 500)],
  );
}

async function deliverOne(
  row: DeliveryRow,
  config: PushConfig,
): Promise<DeliveryResult> {
  if (row.read_at) {
    await skipDelivery(row.id);
    return { sent: 0, failed: 0, skipped: 1, retried: 0 };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      JSON.stringify(notificationPayload(row)),
      {
        TTL: 3600,
        urgency: "high",
      },
    );
    await query(
      `UPDATE push_deliveries
       SET status='sent',sent_at=now(),locked_until=NULL,last_error=NULL
       WHERE id=$1`,
      [row.id],
    );
    return { sent: 1, failed: 0, skipped: 0, retried: 0 };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    const message =
      (error as { body?: string }).body ||
      (error instanceof Error ? error.message : "Pengiriman push gagal.");

    // Langganan yang sudah tidak berlaku tidak boleh dicoba lagi. Baris
    // pengiriman ikut terhapus lewat ON DELETE CASCADE.
    if (statusCode === 404 || statusCode === 410) {
      await query(`DELETE FROM push_subscriptions WHERE id=$1`, [
        row.subscription_id,
      ]);
      return { sent: 0, failed: 0, skipped: 1, retried: 0 };
    }

    const permanent = statusCode
      ? PERMANENT_STATUS.has(statusCode)
      : false;
    if (permanent || row.attempts >= MAX_ATTEMPTS) {
      await markFailed(row.id, `${statusCode ?? ""} ${message}`.trim());
      return { sent: 0, failed: 1, skipped: 0, retried: 0 };
    }

    await markRetry(row.id, row.attempts, `${statusCode ?? ""} ${message}`.trim());
    return { sent: 0, failed: 0, skipped: 0, retried: 1 };
  }
}

/**
 * Mengirim antrean push yang jatuh tempo. Dipanggil langsung setelah kejadian
 * (best-effort) dan oleh scheduler sebagai jalur retry. Mengembalikan ringkasan
 * agar otomasi dapat menyimpannya di `automation_jobs.last_result`.
 */
export async function dispatchPushDeliveries(
  deadlineAt = Date.now() + 15_000,
): Promise<DeliveryResult & { configured: boolean }> {
  const config = getPushConfig();
  if (!config.configured || !config.publicKey) {
    return { configured: false, sent: 0, failed: 0, skipped: 0, retried: 0 };
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const total: DeliveryResult = { sent: 0, failed: 0, skipped: 0, retried: 0 };
  while (Date.now() < deadlineAt) {
    const rows = await claimDeliveries();
    if (rows.length === 0) break;

    const results = await Promise.all(
      rows.map((row) => deliverOne(row, config)),
    );
    for (const result of results) {
      total.sent += result.sent;
      total.failed += result.failed;
      total.skipped += result.skipped;
      total.retried += result.retried;
    }

    if (rows.length < BATCH_SIZE) break;
  }

  return { configured: true, ...total };
}
