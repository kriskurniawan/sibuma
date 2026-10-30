import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { canAccessInspection } from "@/lib/checklist-access";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { loadChecklistConditionMap } from "@/lib/checklist-conditions";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import {
  checklistHasStarted,
  checklistNotStartedMessage,
} from "@/lib/checklist-schedule";
import { query, transaction } from "@/lib/db";
import { rowToCamel } from "@/lib/db-model";
import { apiError, apiOk } from "@/lib/http";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const { id } = await params;
  try {
    const inspection = await transaction(async (connection) => {
      const [current] = await query(
        `SELECT * FROM checklist_inspections WHERE id=$1 FOR UPDATE`,
        [id],
        connection,
      );
      if (!current) throw new Error("Checklist tidak ditemukan.");
      const allowed = await canAccessInspection(connection, user, {
        id: current.id as string,
        ownerId: current.owner_id as string,
      });
      if (!allowed) throw new Error("Kamu tidak ditugaskan pada checklist ini.");
      if (!checklistHasStarted(current.occurrence_date as string)) {
        throw new Error(
          checklistNotStartedMessage(current.occurrence_date as string),
        );
      }
      if (current.status === "selesai") throw new Error("Checklist ini sudah selesai.");
      if (current.status === "dilewati") throw new Error("Checklist ini dilewati.");

      const answers = await query(
        `SELECT a.*,(SELECT count(*)::integer FROM checklist_photos p WHERE p.answer_id=a.id AND p.kind='photo') photo_count
         FROM checklist_answers a WHERE a.inspection_id=$1 ORDER BY a.position,a.id`,
        [id],
        connection,
      );
      const conditions = await loadChecklistConditionMap(connection);
      for (const answer of answers) {
        const prompt = answer.prompt as string;
        const condition = answer.condition as string | null;
        if (answer.required && !condition) {
          throw new Error(`Item "${prompt}" belum diisi.`);
        }
        const meta = condition ? conditions.get(condition) : null;
        if (condition && !meta) {
          throw new Error(`Status checklist item "${prompt}" tidak dikenal.`);
        }
        const note = ((answer.note as string) ?? "").trim();
        if (meta?.requiresNote && note.length < 3) {
          throw new Error(`Tuliskan catatan untuk item "${prompt}".`);
        }
        if (
          meta?.isIssue &&
          (answer.require_note_on_issue as boolean) &&
          note.length < 3
        ) {
          throw new Error(`Catatan wajib diisi untuk item "${prompt}".`);
        }
        const needsPhoto =
          answer.photo_policy === "wajib" ||
          (answer.photo_policy === "wajib_saat_masalah" && meta?.isIssue);
        if (needsPhoto && Number(answer.photo_count) === 0) {
          throw new Error(`Foto wajib dilampirkan untuk item "${prompt}".`);
        }
      }

      const now = new Date().toISOString();
      await query(
        `UPDATE checklist_inspections
         SET status='selesai',completed_at=$2,completed_by=$3,updated_at=$2
         WHERE id=$1`,
        [id, now, user.id],
        connection,
      );
      const [updated] = await query(`SELECT * FROM checklist_inspections WHERE id=$1`, [id], connection);
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "checklist_selesai",
        objectType: "checklist",
        objectId: id,
        summary: `${user.name} menyelesaikan checklist ${current.template_name as string} di ${current.location_name as string}.`,
        before: { status: current.status },
        after: { status: "selesai", answered: answers.length },
      });
      return rowToCamel(updated);
    });
    return apiOk({ inspection, message: "Checklist selesai." });
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
