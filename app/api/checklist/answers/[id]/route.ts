import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { canAccessInspection, loadAnswer } from "@/lib/checklist-access";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { loadChecklistConditionMap } from "@/lib/checklist-conditions";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import {
  checklistHasStarted,
  checklistNotStartedMessage,
} from "@/lib/checklist-schedule";
import { checklistAnswerSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { rowToCamel } from "@/lib/db-model";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistAnswerSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const answer = await transaction(async (connection) => {
      // Lock the inspection before its answer so every write that touches both
      // rows uses the same parent -> child order as completion and evidence.
      const [reference] = await query(
        `SELECT inspection_id FROM checklist_answers WHERE id=$1`,
        [id],
        connection,
      );
      if (!reference) throw new Error("Item checklist tidak ditemukan.");
      const [inspection] = await query(
        `SELECT owner_id,status,occurrence_date FROM checklist_inspections WHERE id=$1 FOR UPDATE`,
        [reference.inspection_id],
        connection,
      );
      if (!inspection) throw new Error("Checklist tidak ditemukan.");

      const current = await loadAnswer(connection, id);
      if (!current) throw new Error("Item checklist tidak ditemukan.");
      const allowed = await canAccessInspection(connection, user, {
        id: current.inspectionId,
        ownerId: inspection.owner_id as string,
      });
      if (!allowed) throw new Error("Kamu tidak ditugaskan pada checklist ini.");
      if (["selesai", "dilewati"].includes(inspection.status as string)) {
        throw new Error("Checklist sudah selesai. Minta atasan membuka kembali bila perlu diubah.");
      }
      if (!checklistHasStarted(inspection.occurrence_date as string)) {
        throw new Error(
          checklistNotStartedMessage(inspection.occurrence_date as string),
        );
      }
      if (parsed.data.expectedVersion !== current.version) {
        const error = new Error(
          "Item ini baru saja diubah oleh anggota lain. Muat ulang lalu ulangi perubahanmu.",
        ) as Error & { status?: number; currentVersion?: number };
        error.status = 409;
        error.currentVersion = current.version;
        throw error;
      }

      const note = parsed.data.note;
      const conditions = await loadChecklistConditionMap(connection);
      const selected = parsed.data.condition
        ? conditions.get(parsed.data.condition)
        : null;
      if (parsed.data.condition && !selected) {
        throw new Error("Status checklist tidak dikenal.");
      }
      if (
        selected &&
        !selected.active &&
        parsed.data.condition !== current.condition
      ) {
        throw new Error("Status checklist ini sudah dinonaktifkan.");
      }
      if (selected?.requiresNote && note.length < 3) {
        throw new Error("Tuliskan catatan untuk status checklist ini.");
      }
      if (
        selected?.isIssue &&
        current.requireNoteOnIssue &&
        note.length < 3
      ) {
        throw new Error("Catatan wajib diisi saat kondisi bermasalah.");
      }

      await query(
        `UPDATE checklist_answers SET condition=$2,note=$3,version=version+1,updated_by=$4,updated_at=now()
         WHERE id=$1`,
        [id, parsed.data.condition, note, user.id],
        connection,
      );
      await query(
        `UPDATE checklist_inspections
         SET status=CASE WHEN status='belum_dimulai' THEN 'berlangsung' ELSE status END,
           started_at=COALESCE(started_at,now()),updated_at=now()
         WHERE id=$1`,
        [current.inspectionId],
        connection,
      );
      const [updated] = await query(`SELECT * FROM checklist_answers WHERE id=$1`, [id], connection);
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "checklist_butir_diisi",
        objectType: "checklist",
        objectId: current.inspectionId,
        summary: `${user.name} mengisi item "${current.prompt}".`,
        before: { condition: current.condition, note: current.note, version: current.version },
        after: { condition: parsed.data.condition, note, version: current.version + 1 },
      });
      return rowToCamel(updated);
    });
    return apiOk({ answer, message: "Item checklist disimpan." });
  } catch (error) {
    const status = (error as { status?: number }).status;
    const currentVersion = (error as { currentVersion?: number }).currentVersion;
    if (status === 409) {
      return apiError(checklistErrorMessage(error), 409, { currentVersion });
    }
    return apiError(checklistErrorMessage(error));
  }
}
