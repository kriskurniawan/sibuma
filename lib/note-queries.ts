import "server-only";

import type { QueryResultRow } from "pg";
import { isReadOnly } from "./access";
import { insertAudit } from "./audit";
import { NOTE_MAX_PHOTOS, NOTE_MAX_TOTAL_BYTES } from "./constants";
import { query, transaction } from "./db";
import type {
  Note,
  NoteAttachment,
  NoteAudience,
  NoteOptions,
} from "./note-types";
import { clampPage, type PageRequest } from "./pagination";
import type { SessionUser } from "./types";

/**
 * Catatan hanya terlihat oleh penulis, super admin, penerima langsung, dan
 * anggota/atasan divisi tujuan. Predikat ini dipakai ulang oleh feed dan akses
 * media agar tidak ada dua aturan visibilitas yang bisa berbeda.
 */
const VISIBILITY = `(
  $1::boolean
  OR n.author_id=$2
  OR (
    n.audience_type IN ('division','divisions')
    AND (
      (
        n.division_id IS NOT NULL
        AND (
          n.division_id=(SELECT e.division_id FROM employees e WHERE e.id=$2)
          OR EXISTS (
            SELECT 1 FROM divisions d
            WHERE d.id=n.division_id AND d.supervisor_id=$2
          )
        )
      )
      OR EXISTS (
        SELECT 1 FROM note_divisions nd
        JOIN divisions d ON d.id=nd.division_id
        WHERE nd.note_id=n.id
          AND (
            nd.division_id=(SELECT e.division_id FROM employees e WHERE e.id=$2)
            OR d.supervisor_id=$2
          )
      )
    )
  )
  OR EXISTS (
    SELECT 1 FROM note_recipients r
    WHERE r.note_id=n.id AND r.employee_id=$2
  )
)`;

const NOTE_SELECT = `
  n.id,n.author_id,n.author_name,n.title,n.body,n.audience_type,
  n.division_id,n.division_name,n.created_at,n.updated_at,
  author.avatar_key author_avatar_key,
  COALESCE((
    SELECT array_agg(e.name ORDER BY e.name)
    FROM note_recipients r
    JOIN employees e ON e.id=r.employee_id
    WHERE r.note_id=n.id
  ), '{}'::text[]) recipient_names,
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', a.id,
      'fileName', a.file_name,
      'mimeType', a.mime_type,
      'sizeBytes', a.size_bytes
    ) ORDER BY a.sort_order,a.created_at)
    FROM note_attachments a
    WHERE a.note_id=n.id
  ), '[]'::json) attachments`;

interface NoteAttachmentRow {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string | number;
}

interface NoteRow extends QueryResultRow {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar_key: string | null;
  title: string;
  body: string;
  audience_type: NoteAudience;
  division_id: string | null;
  division_name: string;
  recipient_names: string[];
  attachments: NoteAttachmentRow[] | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function attachmentsFrom(row: NoteRow): NoteAttachment[] {
  return (row.attachments ?? []).map((attachment) => ({
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: Number(attachment.sizeBytes),
  }));
}

function toNote(row: NoteRow, user: SessionUser): Note {
  const canManage =
    !isReadOnly(user) &&
    (user.role === "super_admin" || row.author_id === user.id);
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatarKey: row.author_avatar_key,
    title: row.title,
    body: row.body,
    audienceType: row.audience_type,
    divisionId: row.division_id,
    divisionName: row.division_name,
    recipientNames: row.recipient_names ?? [],
    attachments: attachmentsFrom(row),
    canEdit: canManage,
    canDelete: canManage,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function visibilityValues(user: SessionUser) {
  return [user.role === "super_admin", user.id] as const;
}

/** Feed terbaru dengan pagination; total dipakai untuk kontrol halaman. */
export async function getNotesPage(
  user: SessionUser,
  request: PageRequest,
): Promise<{ notes: Note[]; total: number; page: PageRequest }> {
  const [isSuper, employeeId] = visibilityValues(user);
  const [countRow] = await query<{ total: number | string }>(
    `SELECT count(*)::integer total FROM notes n WHERE ${VISIBILITY}`,
    [isSuper, employeeId],
  );
  const total = Number(countRow?.total ?? 0);
  const page = clampPage(request, total);
  const rows = await query<NoteRow>(
    `SELECT ${NOTE_SELECT}
     FROM notes n
     LEFT JOIN employees author ON author.id=n.author_id
     WHERE ${VISIBILITY}
     ORDER BY n.created_at DESC,n.id DESC
     LIMIT $3 OFFSET $4`,
    [isSuper, employeeId, page.pageSize, page.pageIndex * page.pageSize],
  );
  return { notes: rows.map((row) => toNote(row, user)), total, page };
}

/** Satu catatan dengan aturan visibilitas yang sama seperti feed. */
export async function getNote(
  user: SessionUser,
  id: string,
): Promise<Note | null> {
  const [isSuper, employeeId] = visibilityValues(user);
  const [row] = await query<NoteRow>(
    `SELECT ${NOTE_SELECT}
     FROM notes n
     LEFT JOIN employees author ON author.id=n.author_id
     WHERE ${VISIBILITY} AND n.id=$3
     LIMIT 1`,
    [isSuper, employeeId, id],
  );
  return row ? toNote(row, user) : null;
}

/** Divisi dan karyawan aktif yang bisa dipilih sebagai penerima. */
export async function getNoteOptions(user: SessionUser): Promise<NoteOptions> {
  const [divisions, employees, mine] = await Promise.all([
    query<{ id: string; name: string }>(
      `SELECT id,name FROM divisions WHERE active ORDER BY name,id`,
    ),
    query<{ id: string; name: string; division_name: string | null }>(
      `SELECT e.id,e.name,d.name division_name
       FROM employees e
       LEFT JOIN divisions d ON d.id=e.division_id
       WHERE e.active AND e.role='pekerja' AND e.id<>$1
       ORDER BY e.name,e.id`,
      [user.id],
    ),
    query<{ division_id: string | null }>(
      `SELECT division_id FROM employees WHERE id=$1`,
      [user.id],
    ),
  ]);

  return {
    divisions: divisions.map((row) => ({ id: row.id, name: row.name })),
    employees: employees.map((row) => ({
      id: row.id,
      name: row.name,
      divisionName: row.division_name,
    })),
    myDivisionId: mine[0]?.division_id ?? null,
  };
}

export async function getNoteDivisions(ids: string[]) {
  if (ids.length === 0) return [];
  return query<{ id: string; name: string }>(
    `SELECT id,name FROM divisions
     WHERE active AND id = ANY($1::text[])
     ORDER BY name,id`,
    [ids],
  );
}

export async function getActiveEmployeeNames(ids: string[]) {
  if (ids.length === 0) return [];
  return query<{ id: string; name: string }>(
    `SELECT id,name FROM employees
     WHERE active AND role='pekerja' AND id = ANY($1::text[])
     ORDER BY name,id`,
    [ids],
  );
}

interface NoteMediaRow extends QueryResultRow {
  storage_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: string | number;
}

/** Media hanya dapat dibaca dengan predikat visibilitas yang sama seperti feed. */
export async function getNoteMedia(
  user: SessionUser,
  id: string,
  attachmentId: string | null = null,
) {
  const [isSuper, employeeId] = visibilityValues(user);
  const [row] = await query<NoteMediaRow>(
    `SELECT a.storage_key,a.file_name,a.mime_type,a.size_bytes
     FROM notes n
     JOIN note_attachments a ON a.note_id=n.id
     WHERE n.id=$3 AND ${VISIBILITY}
       AND ($4::text IS NULL OR a.id=$4)
     ORDER BY a.sort_order,a.created_at
     LIMIT 1`,
    [isSuper, employeeId, id, attachmentId],
  );
  return row ?? null;
}

export interface NewNoteRecord {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  audienceType: NoteAudience;
  divisions: Array<{ id: string; name: string }>;
  divisionId: string | null;
  divisionName: string;
  recipientIds: string[];
  clientRequestId: string | null;
  attachments: Array<{
    id: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  auditSummary: string;
}

export async function insertNote(input: NewNoteRecord) {
  const now = new Date().toISOString();
  await transaction(async (connection) => {
    await query(
      `INSERT INTO notes
        (id,author_id,author_name,title,body,audience_type,division_id,
         division_name,client_request_id,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
      [
        input.id,
        input.authorId,
        input.authorName,
        input.title,
        input.body,
        input.audienceType,
        input.divisionId,
        input.divisionName,
        input.clientRequestId,
        now,
      ],
      connection,
    );

    if (input.audienceType === "divisions") {
      for (const division of input.divisions) {
        await query(
          `INSERT INTO note_divisions (note_id,division_id,division_name)
           VALUES ($1,$2,$3)`,
          [input.id, division.id, division.name],
          connection,
        );
      }
    }

    for (const employeeId of input.recipientIds) {
      await query(
        `INSERT INTO note_recipients (note_id,employee_id) VALUES ($1,$2)`,
        [input.id, employeeId],
        connection,
      );
    }

    for (const [index, attachment] of input.attachments.entries()) {
      await query(
        `INSERT INTO note_attachments
          (id,note_id,storage_provider,storage_key,file_name,mime_type,
           size_bytes,sort_order,created_at)
         VALUES ($1,$2,'s3',$3,$4,$5,$6,$7,$8)`,
        [
          attachment.id,
          input.id,
          attachment.storageKey,
          attachment.fileName,
          attachment.mimeType,
          attachment.sizeBytes,
          index,
          now,
        ],
        connection,
      );
    }

    await insertAudit(connection, {
      actorId: input.authorId,
      actorName: input.authorName,
      action: "catatan_dibuat",
      objectType: "catatan",
      objectId: input.id,
      summary: input.auditSummary,
      after: {
        title: input.title,
        audienceType: input.audienceType,
        divisionName: input.divisionName,
        divisionCount: input.divisions.length,
        recipientCount: input.recipientIds.length,
        photoCount: input.attachments.length,
      },
    });
  });
}

/** Cari catatan yang sudah dibuat dengan kunci idempotensi yang sama. */
export async function findNoteByClientRequest(
  authorId: string,
  clientRequestId: string,
) {
  const [row] = await query<{ id: string }>(
    `SELECT id FROM notes
     WHERE author_id=$1 AND client_request_id=$2
     LIMIT 1`,
    [authorId, clientRequestId],
  );
  return row?.id ?? null;
}

/** Dipakai untuk merekonsiliasi COMMIT yang berhasil tetapi responsnya gagal. */
export async function noteExists(id: string) {
  const [row] = await query<{ id: string }>(
    `SELECT id FROM notes WHERE id=$1 LIMIT 1`,
    [id],
  );
  return Boolean(row);
}

export type DeleteNoteResult =
  | { status: "deleted"; storageKeys: string[] }
  | { status: "missing" };

/**
 * Penghapusan, pemeriksaan izin, dan audit berada dalam satu transaksi dengan
 * lock baris. Dua permintaan paralel tidak dapat mencatat audit dua kali, dan
 * catatan milik orang lain sengaja dilaporkan sama seperti catatan yang tidak
 * ada agar keberadaannya tidak bocor.
 */
export async function deleteNoteForUser(input: {
  id: string;
  actorId: string;
  actorName: string;
  canDeleteAny: boolean;
}): Promise<DeleteNoteResult> {
  return transaction(async (connection) => {
    const [note] = await query<{
      id: string;
      author_id: string;
      title: string;
      storage_keys: string[];
    }>(
      `SELECT n.id,n.author_id,n.title,
         COALESCE((
           SELECT array_agg(a.storage_key ORDER BY a.sort_order,a.created_at)
           FROM note_attachments a
           WHERE a.note_id=n.id
         ), '{}'::text[]) storage_keys
       FROM notes n
       WHERE n.id=$1
       FOR UPDATE`,
      [input.id],
      connection,
    );
    if (!note) return { status: "missing" };
    if (!input.canDeleteAny && note.author_id !== input.actorId) {
      return { status: "missing" };
    }

    const deleted = await query<{ id: string }>(
      `DELETE FROM notes WHERE id=$1 RETURNING id`,
      [input.id],
      connection,
    );
    if (!deleted[0]) return { status: "missing" };

    await insertAudit(connection, {
      actorId: input.actorId,
      actorName: input.actorName,
      action: "catatan_dihapus",
      objectType: "catatan",
      objectId: note.id,
      summary: `${input.actorName} menghapus catatan "${note.title}".`,
      before: { title: note.title },
    });

    return { status: "deleted", storageKeys: note.storage_keys ?? [] };
  });
}

export type UpdateNoteContentResult =
  | { status: "updated"; removedStorageKeys: string[] }
  | { status: "missing" }
  | { status: "conflict" };

export interface EditableNoteAttachment {
  id: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export type EditableNoteSnapshot =
  | {
      status: "ok";
      title: string;
      body: string;
      updatedAt: string;
      attachments: EditableNoteAttachment[];
    }
  | { status: "missing" };

interface EditableNoteAttachmentRow {
  id: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string | number;
}

/**
 * Dibaca sebelum unggah agar route dapat menolak `keepAttachmentIds` yang
 * bukan milik catatan ini. Pemeriksaan izin dan lampiran diulang di dalam
 * transaksi update, sehingga hasil ini tidak dipakai sebagai sumber kebenaran.
 */
export async function getEditableNoteForUser(input: {
  id: string;
  actorId: string;
  canEditAny: boolean;
}): Promise<EditableNoteSnapshot> {
  const [note] = await query<{
    id: string;
    author_id: string;
    title: string;
    body: string;
    updated_at: Date | string;
    attachments: EditableNoteAttachmentRow[] | null;
  }>(
    `SELECT n.id,n.author_id,n.title,n.body,n.updated_at,
       COALESCE((
         SELECT json_agg(json_build_object(
           'id', a.id,
           'storageKey', a.storage_key,
           'fileName', a.file_name,
           'mimeType', a.mime_type,
           'sizeBytes', a.size_bytes
         ) ORDER BY a.sort_order,a.created_at)
         FROM note_attachments a
         WHERE a.note_id=n.id
       ), '[]'::json) attachments
     FROM notes n
     WHERE n.id=$1
     LIMIT 1`,
    [input.id],
  );
  if (!note) return { status: "missing" };
  if (!input.canEditAny && note.author_id !== input.actorId) {
    return { status: "missing" };
  }

  return {
    status: "ok",
    title: note.title,
    body: note.body,
    updatedAt: new Date(note.updated_at).toISOString(),
    attachments: (note.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      storageKey: attachment.storageKey,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: Number(attachment.sizeBytes),
    })),
  };
}

interface StoredNoteAttachmentRow extends QueryResultRow {
  id: string;
  storage_key: string;
  file_name: string;
  size_bytes: string | number;
}

/**
 * Judul, isi, dan daftar foto diubah dalam satu transaksi. Penerima tetap
 * dipertahankan agar perubahan isi tidak diam-diam mengubah pembaca catatan.
 * Lampiran yang dihapus baru dibersihkan dari storage setelah COMMIT.
 */
export async function updateNoteContentForUser(input: {
  id: string;
  actorId: string;
  actorName: string;
  canEditAny: boolean;
  expectedUpdatedAt: string;
  title: string;
  body: string;
  keepAttachmentIds: string[];
  newAttachments: Array<{
    id: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
}): Promise<UpdateNoteContentResult> {
  return transaction(async (connection) => {
    const [note] = await query<{
      id: string;
      author_id: string;
      title: string;
      body: string;
      updated_at: Date | string;
    }>(
      `SELECT id,author_id,title,body,updated_at
       FROM notes
       WHERE id=$1
       FOR UPDATE`,
      [input.id],
      connection,
    );
    if (!note) return { status: "missing" };
    if (!input.canEditAny && note.author_id !== input.actorId) {
      return { status: "missing" };
    }

    const currentUpdatedAt = new Date(note.updated_at).toISOString();
    if (
      input.expectedUpdatedAt &&
      currentUpdatedAt !== input.expectedUpdatedAt
    ) {
      return { status: "conflict" };
    }

    const attachments = await query<StoredNoteAttachmentRow>(
      `SELECT id,storage_key,file_name,size_bytes
       FROM note_attachments
       WHERE note_id=$1
       ORDER BY sort_order,created_at`,
      [input.id],
      connection,
    );

    const keepIds = new Set(input.keepAttachmentIds);
    if (
      keepIds.size !== input.keepAttachmentIds.length ||
      input.keepAttachmentIds.some(
        (id) => !attachments.some((attachment) => attachment.id === id),
      )
    ) {
      return { status: "conflict" };
    }

    const kept = attachments.filter((attachment) => keepIds.has(attachment.id));
    const removed = attachments.filter(
      (attachment) => !keepIds.has(attachment.id),
    );
    const totalBytes =
      kept.reduce((sum, attachment) => sum + Number(attachment.size_bytes), 0) +
      input.newAttachments.reduce(
        (sum, attachment) => sum + attachment.sizeBytes,
        0,
      );
    if (
      input.newAttachments.length > 0 &&
      (kept.length + input.newAttachments.length > NOTE_MAX_PHOTOS ||
        totalBytes > NOTE_MAX_TOTAL_BYTES)
    ) {
      return { status: "conflict" };
    }

    const now = new Date().toISOString();
    await query(
      `UPDATE notes
       SET title=$2,body=$3,updated_at=$4
       WHERE id=$1`,
      [input.id, input.title, input.body, now],
      connection,
    );

    // Urutan foto lama mengikuti urutan yang dipertahankan klien; foto baru
    // selalu ditambahkan di belakang agar tampilan detail tetap stabil.
    for (const [index, attachmentId] of input.keepAttachmentIds.entries()) {
      await query(
        `UPDATE note_attachments
         SET sort_order=$3
         WHERE note_id=$1 AND id=$2`,
        [input.id, attachmentId, index],
        connection,
      );
    }

    for (const [index, attachment] of input.newAttachments.entries()) {
      await query(
        `INSERT INTO note_attachments
          (id,note_id,storage_provider,storage_key,file_name,mime_type,
           size_bytes,sort_order,created_at)
         VALUES ($1,$2,'s3',$3,$4,$5,$6,$7,$8)`,
        [
          attachment.id,
          input.id,
          attachment.storageKey,
          attachment.fileName,
          attachment.mimeType,
          attachment.sizeBytes,
          kept.length + index,
          now,
        ],
        connection,
      );
    }

    if (removed.length > 0) {
      await query(
        `DELETE FROM note_attachments
         WHERE note_id=$1 AND id = ANY($2::text[])`,
        [input.id, removed.map((attachment) => attachment.id)],
        connection,
      );
    }

    await insertAudit(connection, {
      actorId: input.actorId,
      actorName: input.actorName,
      action: "catatan_diubah",
      objectType: "catatan",
      objectId: note.id,
      summary: `${input.actorName} mengubah catatan "${input.title}".`,
      before: {
        title: note.title,
        bodyLength: note.body.length,
        photoCount: attachments.length,
      },
      after: {
        title: input.title,
        bodyLength: input.body.length,
        photoCount: kept.length + input.newAttachments.length,
        addedPhotos: input.newAttachments.length,
        removedPhotos: removed.length,
      },
    });

    return {
      status: "updated",
      removedStorageKeys: removed.map((attachment) => attachment.storage_key),
    };
  });
}
