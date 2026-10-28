import { getCurrentUser } from "@/lib/auth";
import {
  canManageFollowUp,
  loadFollowUp,
} from "@/lib/checklist-access";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { checklistFollowUpUpdateSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { rowToCamel } from "@/lib/db-model";
import { formatDateTime } from "@/lib/time";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistFollowUpUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const followUp = await transaction(async (connection) => {
      const current = await loadFollowUp(connection, id);
      if (!current) throw new Error("Tindak lanjut tidak ditemukan.");
      const allowed = await canManageFollowUp(connection, user, current);
      if (!allowed) throw new Error("Kamu tidak berhak memperbarui tindak lanjut ini.");
      if (current.status === "dibatalkan") throw new Error("Tindak lanjut ini sudah dibatalkan.");

      const nextStatus = parsed.data.status;
      const cancelReason = parsed.data.cancelReason?.trim() || null;
      const resultNote = parsed.data.resultNote.trim();
      if (nextStatus === "dibatalkan" && (!cancelReason || cancelReason.length < 4)) {
        throw new Error("Tuliskan alasan pembatalan minimal 4 karakter.");
      }
      if (nextStatus === "selesai" && resultNote.length < 3) {
        throw new Error("Tuliskan hasil tindak lanjut minimal 3 karakter.");
      }

      const now = new Date().toISOString();
      const progressNote = parsed.data.progressNote
        ? [current.progressNote, `${formatDateTime(now)} — ${user.name}: ${parsed.data.progressNote}`]
            .filter(Boolean)
            .join("\n")
        : current.progressNote;
      const dueDate =
        parsed.data.dueDate === undefined ? current.dueDate : parsed.data.dueDate;
      const startedAt =
        nextStatus !== "terbuka" && nextStatus !== "tertunda" && !current.startedAt
          ? now
          : current.startedAt;
      const completedAt = nextStatus === "selesai" ? now : null;
      const completedBy = nextStatus === "selesai" ? user.id : null;

      await query(
        `UPDATE checklist_follow_ups
         SET status=$2,progress_note=$3,cancel_reason=$4,result_note=$5,due_date=$6,
           started_at=$7,completed_at=$8,completed_by=$9,updated_at=$10
         WHERE id=$1`,
        [
          id,
          nextStatus,
          progressNote,
          cancelReason,
          nextStatus === "selesai" ? resultNote : current.resultNote,
          dueDate,
          startedAt,
          completedAt,
          completedBy,
          now,
        ],
        connection,
      );
      await query(
        `INSERT INTO checklist_follow_up_events (id,follow_up_id,actor_id,actor_name,action,status,note,created_at)
         VALUES ($1,$2,$3,$4,'status_diubah',$5,$6,$7)`,
        [
          `cfe_${crypto.randomUUID()}`,
          id,
          user.id,
          user.name,
          nextStatus,
          [parsed.data.progressNote, cancelReason, nextStatus === "selesai" ? resultNote : ""]
            .filter(Boolean)
            .join(" · "),
          now,
        ],
        connection,
      );
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "tindak_lanjut_diubah",
        objectType: "tindak_lanjut",
        objectId: id,
        summary: `${user.name} memperbarui tindak lanjut "${current.title}" menjadi ${nextStatus}.`,
        before: { status: current.status, dueDate: current.dueDate },
        after: { status: nextStatus, dueDate, progressNote: parsed.data.progressNote || null },
      });
      const [row] = await query(`SELECT * FROM checklist_follow_ups WHERE id=$1`, [id], connection);
      return rowToCamel(row);
    });
    return apiOk({ followUp, message: "Tindak lanjut diperbarui." });
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
