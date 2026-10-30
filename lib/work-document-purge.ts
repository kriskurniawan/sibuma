import "server-only";
import { deleteDocumentObject } from "./document-storage";
import { query } from "./db";

/**
 * Sampah dokumen dihapus permanen setelah masa simpannya berakhir. Baris
 * dihapus lebih dulu agar dokumen yang tidak lagi tersedia tidak tertahan oleh
 * gangguan storage; objek lalu dihapus best-effort. Objek yatim tidak dapat
 * diakses karena tidak ada baris yang menunjuk ke sana.
 */
export async function purgeExpiredWorkDocuments(limit = 25) {
  const rows = await query(
    `SELECT id,storage_key FROM work_documents
     WHERE purge_after IS NOT NULL AND purge_after <= now()
     ORDER BY purge_after,id LIMIT $1`,
    [limit],
  );
  let purged = 0;
  for (const row of rows) {
    const deleted = await query(
      `DELETE FROM work_documents
       WHERE id=$1 AND purge_after IS NOT NULL AND purge_after <= now()
       RETURNING id`,
      [row.id],
    );
    if (deleted.length === 0) continue;
    purged += 1;
    await deleteDocumentObject(row.storage_key as string).catch((error) => {
      console.error(
        `Gagal menghapus objek sampah dokumen ${String(row.storage_key)}:`,
        error instanceof Error ? error.message : error,
      );
    });
  }
  return purged;
}
