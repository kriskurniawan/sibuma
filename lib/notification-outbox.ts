import "server-only";

import { createHash } from "node:crypto";
import type { QueryResultRow } from "pg";
import { query, transaction, type Connection } from "./db";
import {
  deliverWhatsApp,
  spklMessages,
  type SpklNotificationType,
} from "./notifications";
import type { Employee, NotificationStatus, Spkl } from "./types";

/** Batas percobaan sebelum pesan dinyatakan gagal permanen. */
const MAX_ATTEMPTS = 5;
/** Jeda antar percobaan dalam detik; indeks mengikuti jumlah percobaan. */
const RETRY_SECONDS = [60, 300, 900, 3600];
/** Satu pemanggilan mengirim beberapa pesan sekaligus seperti perilaku lama. */
const BATCH_SIZE = 10;
/** Baris `processing` lebih tua dari ini dianggap ditinggalkan proses yang mati. */
const STUCK_AFTER = "3 minutes";
/** Batas pesan usang yang disaring per putaran agar transaksi tetap pendek. */
const EXPIRE_BATCH_SIZE = 100;
const STALE_ERROR =
  "Pesan kedaluwarsa: SPKL sudah berakhir atau dibatalkan sebelum terkirim.";
const UNCERTAIN_ERROR =
  "Status pengiriman tidak pasti setelah proses berhenti; pesan tidak dikirim ulang agar tidak ganda.";

interface OutboxRow extends QueryResultRow {
  id: string;
  type: string;
  recipient_id: string | null;
  recipient_phone: string;
  message: string;
  attempts: number;
  created_at: Date | string;
}

interface RecoveredRow extends OutboxRow {
  status: "pending" | "failed";
}

type Delivery = {
  status: NotificationStatus;
  providerMessageId?: string;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface OutboxNotification {
  id: string;
  dedupeKey: string;
  type: SpklNotificationType | "pengingat";
  recipientId: string | null;
  recipientPhone: string;
  spklId: string | null;
  message: string;
  createdAt: string;
}

function messageFingerprint(message: string) {
  return createHash("sha256")
    .update(message)
    .digest("base64url")
    .slice(0, 16);
}

function spklOutboxRows(
  type: SpklNotificationType,
  spkl: Spkl,
  employees: Employee[],
  extra?: string,
): OutboxNotification[] {
  const createdAt = new Date().toISOString();
  return spklMessages(type, spkl, employees, extra).map(
    ({ employee, message }) => ({
      id: `no_${crypto.randomUUID()}`,
      // updatedAt berubah pada setiap pembuatan/perubahan/pembatalan. Sidik
      // pesan membedakan penerima yang sama pada jalur berbeda (mis. pekerja
      // yang dikeluarkan dari penugasan).
      dedupeKey: `${type}:${spkl.id}:${spkl.updatedAt}:${employee.id}:${messageFingerprint(message)}`,
      type,
      recipientId: employee.id,
      recipientPhone: employee.phone,
      spklId: spkl.id,
      message,
      createdAt,
    }),
  );
}

/**
 * Menulis outbox di transaksi yang sama dengan perubahan SPKL. Bila penulisan
 * gagal, perubahan SPKL ikut dibatalkan sehingga tidak ada perubahan data tanpa
 * notifikasi yang tercatat.
 */
export async function enqueueSpklNotifications(
  connection: Connection,
  type: SpklNotificationType,
  spkl: Spkl,
  employees: Employee[],
  extra?: string,
) {
  const rows = spklOutboxRows(type, spkl, employees, extra);
  if (rows.length === 0) return 0;

  const values: unknown[] = [];
  const placeholders = rows.map((row) => {
    const offset = values.length;
    values.push(
      row.id,
      row.dedupeKey,
      row.type,
      row.recipientId,
      row.recipientPhone,
      row.spklId,
      row.message,
    );
    return `(${Array.from({ length: 7 }, (_, index) => `$${offset + index + 1}`).join(",")},now(),now())`;
  });

  await query(
    `INSERT INTO notification_outbox
      (id,dedupe_key,type,recipient_id,recipient_phone,spkl_id,message,created_at,updated_at)
     VALUES ${placeholders.join(",")}
     ON CONFLICT (dedupe_key) DO NOTHING`,
    values,
    connection,
  );
  return rows.length;
}

function asIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function writeDeliveryLog(
  row: OutboxRow,
  status: NotificationStatus,
  providerMessageId: string | null,
  error: string | null,
  connection?: Connection,
) {
  await query(
    `INSERT INTO notification_logs
      (id,recipient_id,recipient_phone,type,message,status,provider_message_id,error,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET
       status=EXCLUDED.status,
       provider_message_id=EXCLUDED.provider_message_id,
       error=EXCLUDED.error`,
    [
      row.id,
      row.recipient_id,
      row.recipient_phone,
      row.type,
      row.message,
      status,
      providerMessageId,
      error,
      asIso(row.created_at),
    ],
    connection,
  );
}

/** Memulihkan baris `processing` yang ditinggalkan proses mati. */
async function recoverStuckNotifications() {
  return transaction(async (connection) => {
    const rows = await query<RecoveredRow>(
      `UPDATE notification_outbox
       SET status = CASE
             WHEN attempts >= $1 THEN 'failed'
             WHEN delivery_attempted_at IS NOT NULL THEN 'failed'
             ELSE 'pending'
           END,
           locked_at = NULL,
           delivery_attempted_at = NULL,
           error = CASE
             WHEN attempts >= $1
               THEN COALESCE(error,'Pengiriman terhenti sebelum selesai (batas percobaan tercapai).')
             WHEN delivery_attempted_at IS NOT NULL THEN $2
             ELSE error
           END,
           updated_at = now()
       WHERE status='processing'
         AND locked_at < now() - interval '${STUCK_AFTER}'
       RETURNING id,type,recipient_id,recipient_phone,message,attempts,created_at,status`,
      [MAX_ATTEMPTS, UNCERTAIN_ERROR],
      connection,
    );
    for (const row of rows) {
      if (row.status !== "failed") continue;
      await writeDeliveryLog(
        row,
        "gagal",
        null,
        row.attempts >= MAX_ATTEMPTS
          ? "Pengiriman terhenti sebelum selesai (batas percobaan tercapai)."
          : UNCERTAIN_ERROR,
        connection,
      );
    }
    return rows.length;
  });
}

/** Menandai pesan yang sudah tidak relevan agar tidak dikirim terlambat. */
async function expireStaleNotifications() {
  return transaction(async (connection) => {
    const rows = await query<OutboxRow>(
      `WITH stale AS (
         SELECT o.id
         FROM notification_outbox o
         JOIN spkls s ON s.id=o.spkl_id
         WHERE o.status='pending'
           AND (
             (o.type IN ('spkl_baru','spkl_diubah')
               AND (s.canceled_at IS NOT NULL OR s.end_at < now()))
             OR (o.type='spkl_dibatalkan' AND s.canceled_at IS NULL)
           )
         ORDER BY o.created_at, o.id
         LIMIT $1
         FOR UPDATE OF o SKIP LOCKED
       )
       UPDATE notification_outbox o
       SET status='failed',
           error=$2,
           locked_at=NULL,
           delivery_attempted_at=NULL,
           updated_at=now()
       FROM stale
       WHERE o.id=stale.id
       RETURNING o.id,o.type,o.recipient_id,o.recipient_phone,o.message,o.attempts,o.created_at`,
      [EXPIRE_BATCH_SIZE, STALE_ERROR],
      connection,
    );

    for (const row of rows) {
      await writeDeliveryLog(row, "gagal", null, STALE_ERROR, connection);
    }
    return rows.length;
  });
}

/**
 * Mengirim pesan yang sudah jatuh tempo. Klaim memakai `FOR UPDATE SKIP LOCKED`
 * sehingga dua pemanggilan scheduler tidak mengirim baris yang sama. Pesan yang
 * gagal sementara dikembalikan ke `pending` dengan jeda bertahap.
 */
export async function dispatchNotificationOutbox(deadlineAt: number) {
  // Proses yang berhenti setelah memulai pengiriman tidak boleh langsung
  // dicoba lagi: penyedia mungkin sudah menerima pesan. Baris seperti itu
  // ditandai gagal untuk diperiksa manual, bukan dikirim ganda.
  const recovered = await recoverStuckNotifications();

  let expired = 0;
  try {
    expired = await expireStaleNotifications();
  } catch (error) {
    // Penyaringan bersifat pengaman; kegagalannya tidak boleh menghentikan
    // pengiriman pesan yang masih valid.
    console.error(
      "Gagal menyaring pesan kedaluwarsa:",
      error instanceof Error ? error.message : error,
    );
  }

  if (Date.now() >= deadlineAt) {
    return {
      recovered,
      expired,
      claimed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
    };
  }

  const rows = await query<OutboxRow>(
    `WITH due AS (
       SELECT id FROM notification_outbox
       WHERE status='pending' AND next_attempt_at <= now()
       ORDER BY next_attempt_at, created_at, id
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE notification_outbox o
     SET status='processing', attempts=o.attempts+1, locked_at=now(), updated_at=now()
     FROM due
     WHERE o.id=due.id
     RETURNING o.id,o.type,o.recipient_id,o.recipient_phone,o.message,o.attempts,o.created_at`,
    [BATCH_SIZE],
  );

  if (rows.length === 0) {
    return {
      recovered,
      expired,
      claimed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
    };
  }

  const outcomes = await Promise.all(
    rows.map(async (row) => {
      let delivery: Delivery;
      try {
        const marked = await query<{ id: string }>(
          `UPDATE notification_outbox
           SET delivery_attempted_at=now(), updated_at=now()
           WHERE id=$1 AND status='processing'
           RETURNING id`,
          [row.id],
        );
        delivery =
          marked.length === 0
            ? {
                status: "gagal",
                error: "Pesan tidak lagi dalam status diproses.",
              }
            : await deliverWhatsApp(row.recipient_phone, row.message);
      } catch (error) {
        delivery = {
          status: "gagal",
          error:
            error instanceof Error
              ? error.message
              : "Gagal menandai percobaan pengiriman.",
        };
      }
      const configurationError =
        delivery.error?.includes("belum dikonfigurasi") ?? false;
      const terminal =
        delivery.status === "terkirim" ||
        configurationError ||
        row.attempts >= MAX_ATTEMPTS;
      return { row, delivery, terminal };
    }),
  );

  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (const { row, delivery, terminal } of outcomes) {
    const status =
      delivery.status === "terkirim" ? "sent" : terminal ? "failed" : "pending";
    const retrySeconds =
      RETRY_SECONDS[
        Math.min(Math.max(row.attempts - 1, 0), RETRY_SECONDS.length - 1)
      ];

    let saved = false;
    for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
      try {
        // Status outbox dan log ditulis dalam satu transaksi agar audit tidak
        // berbeda dari status pengiriman sebenarnya.
        await transaction(async (connection) => {
          await query(
            `UPDATE notification_outbox
             SET status=$2::text,
                 provider_message_id=$3,
                 error=$4,
                 locked_at=NULL,
                 delivery_attempted_at=CASE
                   WHEN $2::text='pending' THEN NULL
                   ELSE delivery_attempted_at
                 END,
                 next_attempt_at=CASE
                   WHEN $2::text='pending' THEN now() + ($5::integer * interval '1 second')
                   ELSE next_attempt_at
                 END,
                 sent_at=CASE WHEN $2::text='sent' THEN now() ELSE sent_at END,
                 updated_at=now()
             WHERE id=$1`,
            [
              row.id,
              status,
              delivery.providerMessageId ?? null,
              delivery.error ?? null,
              retrySeconds,
            ],
            connection,
          );
          await writeDeliveryLog(
            row,
            delivery.status,
            delivery.providerMessageId ?? null,
            delivery.error ?? null,
            connection,
          );
        });
        saved = true;
      } catch (error) {
        if (attempt === 2) {
          // Baris dibiarkan `processing`; pemulihan berikutnya tidak akan
          // mengirim ulang karena `delivery_attempted_at` sudah terpasang.
          console.error(
            `Gagal menyimpan hasil notifikasi ${row.id}:`,
            error instanceof Error ? error.message : error,
          );
        } else {
          await sleep(50 * (attempt + 1));
        }
      }
    }

    if (!saved) failed += 1;
    else if (status === "sent") sent += 1;
    else if (status === "pending") retried += 1;
    else failed += 1;
  }

  return {
    recovered,
    expired,
    claimed: rows.length,
    sent,
    retried,
    failed,
  };
}
