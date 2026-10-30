import "server-only";
import {
  canAccessInspection,
  canManageFollowUp,
  loadInspection,
} from "./checklist-access";
import {
  checklistHasStarted,
  checklistNotStartedMessage,
} from "./checklist-schedule";
import type {
  ChecklistFollowUp,
  ChecklistInspection,
  ChecklistPhotoStage,
} from "./checklist-types";
import { pool, query, type Connection } from "./db";
import { rowToCamel } from "./db-model";
import type { SessionUser } from "./types";

export interface ChecklistVideoTarget {
  inspection: ChecklistInspection;
  stage: ChecklistPhotoStage;
}

/**
 * Aturan yang sama dengan unggah foto checklist: tepat satu target, checklist
 * sudah dimulai, belum ditutup, dan pengguna berhak menambah bukti. Dipakai
 * ulang oleh langkah siap dan selesai agar pemeriksaan tidak berbeda.
 */
export async function assertChecklistVideoTarget(
  user: SessionUser,
  inspectionId: string,
  answerId: string | null,
  followUpId: string | null,
  options: { connection?: Connection; lock?: boolean } = {},
): Promise<ChecklistVideoTarget> {
  const connection = options.connection ?? pool();
  if (Boolean(answerId) === Boolean(followUpId)) {
    throw new Error(
      "Video harus terhubung ke tepat satu item atau tindak lanjut.",
    );
  }
  if (options.lock) {
    await query(
      `SELECT 1 FROM checklist_inspections WHERE id=$1 FOR UPDATE`,
      [inspectionId],
      connection,
    );
  }
  const inspection = await loadInspection(connection, inspectionId);
  if (!inspection) throw new Error("Checklist tidak ditemukan.");

  if (followUpId) {
    const [followUpRow] = await query(
      `SELECT * FROM checklist_follow_ups WHERE id=$1 AND inspection_id=$2`,
      [followUpId, inspectionId],
      connection,
    );
    if (!followUpRow) throw new Error("Tindak lanjut tidak ditemukan.");
    const followUp = rowToCamel(followUpRow) as unknown as ChecklistFollowUp;
    if (["selesai", "dibatalkan"].includes(followUp.status)) {
      throw new Error(
        "Tindak lanjut ini sudah ditutup. Bukti perbaikan tidak dapat ditambahkan.",
      );
    }
    if (!(await canManageFollowUp(connection, user, followUp))) {
      throw new Error(
        "Kamu tidak berhak menambah bukti pada tindak lanjut ini.",
      );
    }
    return { inspection, stage: "perbaikan" };
  }

  if (!(await canAccessInspection(connection, user, inspection))) {
    throw new Error("Kamu tidak ditugaskan pada checklist ini.");
  }
  if (!checklistHasStarted(inspection.occurrenceDate)) {
    throw new Error(checklistNotStartedMessage(inspection.occurrenceDate));
  }
  if (["selesai", "dilewati"].includes(inspection.status)) {
    throw new Error(
      "Checklist sudah selesai. Minta atasan membuka kembali sebelum menambah video.",
    );
  }
  const [answer] = await query(
    `SELECT id FROM checklist_answers WHERE id=$1 AND inspection_id=$2`,
    [answerId, inspectionId],
    connection,
  );
  if (!answer) throw new Error("Item checklist tidak ditemukan.");
  return { inspection, stage: "temuan" };
}

/** Jumlah video pada satu item/tindak lanjut, terpisah dari kuota foto. */
export async function countChecklistVideos(
  connection: Connection,
  inspectionId: string,
  answerId: string | null,
  followUpId: string | null,
) {
  const [row] = await query<{ total: number }>(
    `SELECT count(*)::integer total FROM checklist_photos
     WHERE inspection_id=$1 AND kind='video'
       AND (($2::text IS NOT NULL AND answer_id=$2) OR ($3::text IS NOT NULL AND follow_up_id=$3))`,
    [inspectionId, answerId, followUpId],
    connection,
  );
  return row?.total ?? 0;
}
