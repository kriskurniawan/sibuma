import "server-only";
import { query, type Connection } from "./db";

/**
 * Tautan temuan checklist harus milik atasan yang sama, masih terbuka, dan
 * belum dipakai pekerjaan lain (kecuali pekerjaan yang sedang diubah).
 */
export async function assertManualWorkFollowUp(
  connection: Connection,
  ownerId: string,
  followUpId: string,
  currentWorkId?: string,
) {
  const [row] = await query(
    `SELECT f.id,f.title FROM checklist_follow_ups f
     WHERE f.id=$1 AND f.owner_id=$2
       AND (
         -- Tautan lama boleh dipertahankan walau temuannya sudah ditutup.
         f.id = (SELECT source_follow_up_id FROM manual_works WHERE id=$3)
         OR (
           f.status NOT IN ('selesai','dibatalkan')
           AND NOT EXISTS(
             SELECT 1 FROM manual_works w
             WHERE w.source_follow_up_id=f.id
               AND w.status <> 'dibatalkan'
               AND ($3::text IS NULL OR w.id <> $3)
           )
         )
       )`,
    [followUpId, ownerId, currentWorkId ?? null],
    connection,
  );
  if (!row) {
    throw new Error(
      "Tindak lanjut tidak tersedia. Pilih temuan terbuka yang belum ditautkan.",
    );
  }
  return row as { id: string; title: string };
}
