import "server-only";
import { insertAudit } from "./audit";
import { query, transaction } from "./db";
import { deleteDocumentObject } from "./document-storage";
import { loadWorkDocument } from "./work-document-access";
import { WorkDocumentError } from "./work-document-errors";
import { getWorkDocumentSettings } from "./work-document-settings";
import type { WorkDocument } from "./work-document-types";
import type { SessionUser } from "./types";

type MutationUser = Pick<SessionUser, "id" | "name">;

/**
 * Memindahkan satu dokumen milik pengguna ke sampah. Dipakai route tunggal
 * dan aksi massal agar aturan retensi, penutupan berbagi, dan audit tidak
 * berbeda antar jalur.
 */
export async function moveWorkDocumentToTrash(
  user: MutationUser,
  id: string,
): Promise<{ purgeAfter: string }> {
  return transaction(async (connection) => {
    const current = await loadWorkDocument(connection, id, true);
    if (!current) throw new WorkDocumentError("Dokumen tidak ditemukan.", 404);
    if (current.ownerId !== user.id) {
      throw new WorkDocumentError(
        "Hanya pemilik dokumen yang dapat menghapusnya.",
        403,
      );
    }
    if (current.deletedAt) {
      throw new WorkDocumentError("Dokumen sudah berada di sampah.");
    }

    // Kunci pengaturan agar masa simpan mengikuti nilai yang berlaku saat
    // dokumen dipindahkan ke sampah.
    await query(
      "SELECT 1 FROM work_document_settings WHERE id='settings' FOR SHARE",
      [],
      connection,
    );
    const settings = await getWorkDocumentSettings(connection);

    const now = new Date();
    const purgeAfter = new Date(
      now.getTime() + settings.trashRetentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    await query(
      `UPDATE work_documents
       SET deleted_at=$1,deleted_by=$2,purge_after=$3,updated_at=$1
       WHERE id=$4`,
      [now.toISOString(), user.id, purgeAfter, id],
      connection,
    );
    // Akses berbagi ditutup saat dokumen masuk sampah; pemilik harus
    // membukanya kembali secara sadar setelah memulihkan dokumen.
    await query(
      `UPDATE work_document_shares
       SET enabled=false,updated_by=$1,updated_at=$2
       WHERE document_id=$3 AND enabled`,
      [user.id, now.toISOString(), id],
      connection,
    );
    await query(
      "DELETE FROM work_document_share_targets WHERE document_id=$1",
      [id],
      connection,
    );
    await insertAudit(connection, {
      actorId: user.id,
      actorName: user.name,
      action: "dokumen_dipindahkan_ke_sampah",
      objectType: "dokumen",
      objectId: id,
      summary: `${user.name} memindahkan dokumen "${current.title}" ke sampah.`,
      before: { deletedAt: null },
      after: { deletedAt: now.toISOString(), purgeAfter, sharesClosed: true },
    });
    return { purgeAfter };
  });
}

/** Mengembalikan satu dokumen dari sampah ke daftar aktif pemiliknya. */
export async function restoreWorkDocument(
  user: MutationUser,
  id: string,
): Promise<WorkDocument> {
  return transaction(async (connection) => {
    const current = await loadWorkDocument(connection, id, true);
    if (!current) throw new WorkDocumentError("Dokumen tidak ditemukan.", 404);
    if (current.ownerId !== user.id) {
      throw new WorkDocumentError(
        "Hanya pemilik dokumen yang dapat memulihkannya.",
        403,
      );
    }
    if (!current.deletedAt) {
      throw new WorkDocumentError("Dokumen tidak berada di sampah.");
    }

    const now = new Date().toISOString();
    await query(
      `UPDATE work_documents
       SET deleted_at=NULL,deleted_by=NULL,purge_after=NULL,updated_at=$1
       WHERE id=$2`,
      [now, id],
      connection,
    );
    await insertAudit(connection, {
      actorId: user.id,
      actorName: user.name,
      action: "dokumen_dipulihkan",
      objectType: "dokumen",
      objectId: id,
      summary: `${user.name} memulihkan dokumen "${current.title}" dari sampah.`,
      before: { deletedAt: current.deletedAt, purgeAfter: current.purgeAfter },
      after: { deletedAt: null, purgeAfter: null },
    });
    return {
      ...current,
      deletedAt: null,
      deletedBy: null,
      purgeAfter: null,
      updatedAt: now,
    };
  });
}

/**
 * Menghapus satu dokumen dari sampah secara permanen. Baris dihapus lebih
 * dulu; kegagalan storage hanya meninggalkan objek yatim.
 */
export async function purgeWorkDocument(
  user: MutationUser,
  id: string,
): Promise<void> {
  let storageKey: string | null = null;
  try {
    const removed = await transaction(async (connection) => {
      const current = await loadWorkDocument(connection, id, true);
      if (!current) throw new WorkDocumentError("Dokumen tidak ditemukan.", 404);
      if (current.ownerId !== user.id) {
        throw new WorkDocumentError(
          "Hanya pemilik dokumen yang dapat menghapusnya permanen.",
          403,
        );
      }
      if (!current.deletedAt) {
        throw new WorkDocumentError(
          "Pindahkan dokumen ke sampah sebelum menghapus permanen.",
        );
      }

      await query("DELETE FROM work_documents WHERE id=$1", [id], connection);
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "dokumen_dihapus_permanen",
        objectType: "dokumen",
        objectId: id,
        summary: `${user.name} menghapus permanen dokumen "${current.title}".`,
        before: {
          id: current.id,
          title: current.title,
          fileName: current.fileName,
          sizeBytes: current.sizeBytes,
        },
      });
      return { storageKey: current.storageKey };
    });
    storageKey = removed.storageKey;
    await deleteDocumentObject(removed.storageKey).catch((error) => {
      console.error(
        `Gagal menghapus objek dokumen permanen ${removed.storageKey}:`,
        error,
      );
    });
  } catch (error) {
    console.error("Gagal menghapus permanen dokumen kerja:", error, storageKey);
    throw error;
  }
}
