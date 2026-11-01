import "server-only";

import { createHash } from "node:crypto";
import type { QueryResultRow } from "pg";
import { query, type Connection } from "./db";
import {
  deliverWhatsApp,
  spklMessages,
  type SpklNotificationType,
} from "./notifications";
import type { Employee, Spkl } from "./types";

/** Batas percobaan sebelum pesan dinyatakan gagal permanen. */
const MAX_ATTEMPTS = 5;
/** Jeda antar percobaan dalam detik; indeks mengikuti jumlah percobaan. */
const RETRY_SECONDS = [60, 300, 900, 3600];
/** Satu pemanggilan mengirim beberapa pesan sekaligus seperti perilaku lama. */
const BATCH_SIZE = 10;
/** Baris `processing` lebih tua dari ini dianggap ditinggalkan proses yang mati. */
const STUCK_AFTER = "3 minutes";

interface OutboxRow extends QueryResultRow {
  id: string;
  type: string;
  recipient_id: string | null;
  recipient_phone: string;
  message: string;
  attempts: number;
  created_at: Date | string;
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
  status: "terkirim" | "gagal",
  providerMessageId: string | null,
  error: string | null,
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
  );
}

/**
 * Mengirim pesan yang sudah jatuh tempo. Klaim memakai `FOR UPDATE SKIP LOCKED`
 * sehingga dua pemanggilan scheduler tidak mengirim baris yang sama. Pesan yang
 * gagal sementara dikembalikan ke `pending` dengan jeda bertahap.
 */
export async function dispatchNotificationOutbox(deadlineAt: number) {
  const recovered = (
    await query<{ id: string }>(
      `UPDATE notification_outbox
       SET status = CASE WHEN attempts >= $1 THEN 'failed' ELSE 'pending' END,
           locked_at = NULL,
           error = CASE WHEN attempts >= $1
             THEN COALESCE(error,'Pengiriman terhenti sebelum selesai.')
             ELSE error END,
           updated_at = now()
       WHERE status='processing'
         AND locked_at < now() - interval '${STUCK_AFTER}'
       RETURNING id`,
      [MAX_ATTEMPTS],
    )
  ).length;

  if (Date.now() >= deadlineAt) {
    return { recovered, claimed: 0, sent: 0, retried: 0, failed: 0 };
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
    return { recovered, claimed: 0, sent: 0, retried: 0, failed: 0 };
  }

  const outcomes = await Promise.all(
    rows.map(async (row) => {
      const delivery = await deliverWhatsApp(row.recipient_phone, row.message);
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
    const status = delivery.status === "terkirim" ? "sent" : terminal ? "failed" : "pending";
    const retrySeconds =
      RETRY_SECONDS[Math.min(Math.max(row.attempts - 1, 0), RETRY_SECONDS.length - 1)];

    try {
      await query(
        `UPDATE notification_outbox
         SET status=$2::text,
             provider_message_id=$3,
             error=$4,
             locked_at=NULL,
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
      );
      await writeDeliveryLog(
        row,
        delivery.status,
        delivery.providerMessageId ?? null,
        delivery.error ?? null,
      );

      if (status === "sent") sent += 1;
      else if (status === "pending") retried += 1;
      else failed += 1;
    } catch (error) {
      // Baris dibiarkan `processing`; pemulihan berikutnya akan mencoba lagi.
      console.error(
        `Gagal menyimpan hasil notifikasi ${row.id}:`,
        error instanceof Error ? error.message : error,
      );
      failed += 1;
    }
  }

  return { recovered, claimed: rows.length, sent, retried, failed };
}
