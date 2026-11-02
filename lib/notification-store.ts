import "server-only";

import type { QueryResultRow } from "pg";
import { query, type Connection } from "./db";
import type {
  AppNotificationItem,
  AppNotificationKind,
  AppNotificationPage,
  AppNotificationSource,
  PushSubscriptionInput,
} from "./notification-types";

interface NotificationRow extends QueryResultRow {
  id: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  href: string;
  actor_name: string;
  read_at: Date | string | null;
  created_at: Date | string;
}

interface InsertNotificationInput {
  recipientIds: string[];
  kind: AppNotificationKind;
  title: string;
  body: string;
  href: string;
  actorId: string;
  actorName: string;
  sourceType: AppNotificationSource;
  sourceId: string;
  dedupeKey: string;
}

function asIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapNotification(row: NotificationRow): AppNotificationItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    actorName: row.actor_name,
    readAt: row.read_at ? asIso(row.read_at) : null,
    createdAt: asIso(row.created_at),
  };
}

/**
 * Menyimpan satu kejadian untuk banyak penerima sekaligus, lalu membuat antrean
 * push untuk perangkat yang sudah terdaftar. Harus dipanggil di dalam transaksi
 * yang sama dengan data sumber agar notifikasi tidak pernah merujuk data yang
 * gagal tersimpan.
 */
async function insertNotificationBatch(
  connection: Connection,
  input: InsertNotificationInput,
) {
  const recipientIds = [...new Set(input.recipientIds)];
  if (recipientIds.length === 0) return 0;

  const count = recipientIds.length;
  const ids = recipientIds.map(() => `an_${crypto.randomUUID()}`);
  const rows = await query<{ id: string; recipient_id: string }>(
    `INSERT INTO app_notifications
       (id,recipient_id,kind,title,body,href,actor_id,actor_name,
        source_type,source_id,dedupe_key)
     SELECT * FROM unnest(
       $1::text[],$2::text[],$3::text[],$4::text[],$5::text[],$6::text[],
       $7::text[],$8::text[],$9::text[],$10::text[],$11::text[]
     )
     ON CONFLICT (recipient_id,dedupe_key) DO NOTHING
     RETURNING id,recipient_id`,
    [
      ids,
      recipientIds,
      Array(count).fill(input.kind),
      Array(count).fill(input.title),
      Array(count).fill(input.body),
      Array(count).fill(input.href),
      Array(count).fill(input.actorId),
      Array(count).fill(input.actorName),
      Array(count).fill(input.sourceType),
      Array(count).fill(input.sourceId),
      Array(count).fill(input.dedupeKey),
    ],
    connection,
  );

  if (rows.length === 0) return 0;

  // Hanya notifikasi yang benar-benar baru yang masuk antrean. Perangkat yang
  // terdaftar setelah kejadian tetap melihat notifikasi ini di kotak masuk.
  await query(
    `INSERT INTO push_deliveries (id,notification_id,subscription_id)
     SELECT 'pd_' || replace(gen_random_uuid()::text,'-',''), n.id, s.id
     FROM app_notifications n
     JOIN push_subscriptions s ON s.employee_id=n.recipient_id
     WHERE n.id = ANY($1::text[])
     ON CONFLICT (notification_id,subscription_id) DO NOTHING`,
    [rows.map((row) => row.id)],
    connection,
  );

  return rows.length;
}

/** Seluruh pekerja aktif lintas divisi, kecuali pembuat kejadian. */
export async function resolveWorkNotificationRecipients(
  connection: Connection,
  actorId: string,
) {
  const rows = await query<{ id: string }>(
    `SELECT id FROM employees
     WHERE role='pekerja' AND active AND id<>$1
     ORDER BY name,id`,
    [actorId],
    connection,
  );
  return rows.map((row) => row.id);
}

/**
 * Penerima catatan mengikuti audiens yang sudah divalidasi: karyawan terpilih,
 * atau seluruh pekerja aktif di divisi tujuan.
 */
export async function resolveNoteNotificationRecipients(
  connection: Connection,
  input: {
    authorId: string;
    audienceType: string;
    recipientIds: string[];
    divisionIds: string[];
  },
) {
  const rows = await query<{ id: string }>(
    `SELECT DISTINCT e.id
     FROM employees e
     WHERE e.active AND e.role='pekerja' AND e.id<>$1
       AND (
         ($2::text='employees' AND e.id = ANY($3::text[]))
         OR (
           $2::text IN ('division','divisions')
           AND e.division_id = ANY($4::text[])
         )
       )
     ORDER BY e.id`,
    [
      input.authorId,
      input.audienceType,
      input.recipientIds,
      input.divisionIds,
    ],
    connection,
  );
  return rows.map((row) => row.id);
}

export async function insertWorkCreatedNotifications(
  connection: Connection,
  work: {
    id: string;
    title: string;
    locationName: string;
    actorId: string;
    actorName: string;
  },
) {
  const recipients = await resolveWorkNotificationRecipients(
    connection,
    work.actorId,
  );
  if (recipients.length === 0) return 0;

  const location = work.locationName.trim();
  return insertNotificationBatch(connection, {
    recipientIds: recipients,
    kind: "pekerjaan_baru",
    title: `Pekerjaan baru: ${work.title.trim().slice(0, 160)}`,
    body: `${work.actorName} membuat pekerjaan baru${location ? ` di ${location}` : ""}.`,
    href: `/pekerjaan/${work.id}`,
    actorId: work.actorId,
    actorName: work.actorName,
    sourceType: "pekerjaan",
    sourceId: work.id,
    dedupeKey: `pekerjaan_baru:${work.id}`,
  });
}

export async function insertNoteCreatedNotifications(
  connection: Connection,
  note: {
    id: string;
    title: string;
    authorId: string;
    authorName: string;
    audienceType: string;
    recipientIds: string[];
    divisionIds: string[];
    divisionName: string;
  },
) {
  const recipients = await resolveNoteNotificationRecipients(connection, {
    authorId: note.authorId,
    audienceType: note.audienceType,
    recipientIds: note.recipientIds,
    divisionIds: note.divisionIds,
  });
  if (recipients.length === 0) return 0;

  const audience =
    note.audienceType === "employees"
      ? "Anda"
      : `divisi ${note.divisionName.trim() || "tujuan"}`;
  return insertNotificationBatch(connection, {
    recipientIds: recipients,
    kind: "catatan_baru",
    title: `Catatan baru: ${note.title.trim().slice(0, 160)}`,
    body: `${note.authorName} mengirim catatan untuk ${audience}.`,
    href: `/catatan/${note.id}`,
    actorId: note.authorId,
    actorName: note.authorName,
    sourceType: "catatan",
    sourceId: note.id,
    dedupeKey: `catatan_baru:${note.id}`,
  });
}

export async function getUnreadNotificationCount(recipientId: string) {
  const [row] = await query<{ total: number }>(
    `SELECT count(*)::integer total
     FROM app_notifications
     WHERE recipient_id=$1 AND read_at IS NULL`,
    [recipientId],
  );
  return Number(row?.total ?? 0);
}

export async function getNotificationInbox(
  recipientId: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<AppNotificationPage> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  const [cursorCreatedAt, cursorId] = (options.cursor ?? "").split("|");
  const cursor =
    cursorCreatedAt && cursorId
      ? { createdAt: cursorCreatedAt, id: cursorId }
      : null;

  const rows = await query<NotificationRow>(
    `SELECT id,kind,title,body,href,actor_name,read_at,created_at
     FROM app_notifications
     WHERE recipient_id=$1
       AND ($2::timestamptz IS NULL OR (created_at,id) < ($2::timestamptz,$3::text))
     ORDER BY created_at DESC,id DESC
     LIMIT $4`,
    [recipientId, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
  );

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(mapNotification);
  const last = items.at(-1);
  const [unread] = await query<{ total: number }>(
    `SELECT count(*)::integer total
     FROM app_notifications
     WHERE recipient_id=$1 AND read_at IS NULL`,
    [recipientId],
  );

  return {
    items,
    unreadCount: Number(unread?.total ?? 0),
    nextCursor:
      hasMore && last ? `${last.createdAt}|${last.id}` : null,
  };
}

export async function markNotificationsRead(
  recipientId: string,
  ids?: string[],
) {
  const selected = ids?.filter(Boolean) ?? [];
  await query(
    `UPDATE app_notifications
     SET read_at=now()
     WHERE recipient_id=$1
       AND read_at IS NULL
       AND ($2::text[] IS NULL OR id = ANY($2::text[]))`,
    [recipientId, selected.length > 0 ? selected : null],
  );
  return getUnreadNotificationCount(recipientId);
}

export async function savePushSubscription(
  employeeId: string,
  subscription: PushSubscriptionInput,
  userAgent: string,
) {
  const [row] = await query<{ id: string }>(
    `INSERT INTO push_subscriptions
       (id,employee_id,endpoint,p256dh,auth,user_agent,created_at,last_seen_at)
     VALUES ($1,$2,$3,$4,$5,$6,now(),now())
     ON CONFLICT (endpoint) DO UPDATE SET
       employee_id=EXCLUDED.employee_id,
       p256dh=EXCLUDED.p256dh,
       auth=EXCLUDED.auth,
       user_agent=EXCLUDED.user_agent,
       last_seen_at=now()
     RETURNING id`,
    [
      `ps_${crypto.randomUUID()}`,
      employeeId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
      userAgent.slice(0, 400),
    ],
  );

  if (row) {
    // Endpoint milik perangkat, bukan milik akun. Saat akun berganti tanpa
    // logout, antrean milik akun lama tidak boleh terkirim ke perangkat ini.
    await query(
      `DELETE FROM push_deliveries d
       USING app_notifications n
       WHERE d.subscription_id=$1
         AND d.notification_id=n.id
         AND n.recipient_id<>$2`,
      [row.id, employeeId],
    );
  }

  return row?.id ?? null;
}

export async function deletePushSubscription(
  employeeId: string,
  endpoint: string,
) {
  await query(
    `DELETE FROM push_subscriptions WHERE employee_id=$1 AND endpoint=$2`,
    [employeeId, endpoint],
  );
}

export async function countPushSubscriptions(employeeId: string) {
  const [row] = await query<{ total: number }>(
    `SELECT count(*)::integer total
     FROM push_subscriptions
     WHERE employee_id=$1`,
    [employeeId],
  );
  return Number(row?.total ?? 0);
}
