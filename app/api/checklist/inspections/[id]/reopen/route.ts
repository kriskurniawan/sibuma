import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { checklistDeadlineLocked } from "@/lib/checklist-schedule";
import { checklistReopenSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { rowToCamel } from "@/lib/db-model";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") {
    return apiError("Hanya atasan pemilik checklist yang dapat membuka kembali.", 403);
  }

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistReopenSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const inspection = await transaction(async (connection) => {
      const [current] = await query(
        `SELECT * FROM checklist_inspections WHERE id=$1 AND owner_id=$2 FOR UPDATE`,
        [id, user.id],
        connection,
      );
      if (!current) throw new Error("Checklist tidak ditemukan.");
      if (current.status === "dilewati") {
        throw new Error("Checklist yang dilewati tidak dapat dibuka kembali.");
      }
      const deadlineLocked = checklistDeadlineLocked({
        status: current.status as string,
        dueAt: current.due_at as Date,
        reopenedAt: current.reopened_at as Date | null,
      });
      if (current.status !== "selesai" && !deadlineLocked) {
        throw new Error(
          "Hanya checklist selesai atau yang terkunci karena deadline yang dapat dibuka kembali.",
        );
      }

      const reopeningCompleted = current.status === "selesai";
      const nextStatus = reopeningCompleted ? "berlangsung" : (current.status as string);
      const now = new Date().toISOString();
      await query(
        `UPDATE checklist_inspections
         SET status=$2,completed_at=$5,completed_by=$6,
           reopened_at=$3,reopened_by=$4,reopen_reason=$7,updated_at=$3
         WHERE id=$1`,
        [
          id,
          nextStatus,
          now,
          user.id,
          reopeningCompleted ? null : current.completed_at,
          reopeningCompleted ? null : current.completed_by,
          parsed.data.reason,
        ],
        connection,
      );
      const [updated] = await query(`SELECT * FROM checklist_inspections WHERE id=$1`, [id], connection);
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: reopeningCompleted
          ? "checklist_dibuka_kembali"
          : "checklist_deadline_dibuka",
        objectType: "checklist",
        objectId: id,
        summary: reopeningCompleted
          ? `${user.name} membuka kembali checklist ${current.template_name as string}.`
          : `${user.name} membuka kunci deadline checklist ${current.template_name as string}.`,
        before: {
          status: current.status,
          completedAt: current.completed_at,
          dueAt: current.due_at,
          reopenedAt: current.reopened_at,
        },
        after: {
          status: nextStatus,
          reason: parsed.data.reason,
          deadlineUnlocked: !reopeningCompleted,
        },
      });
      return {
        inspection: rowToCamel(updated),
        reopenedCompleted: reopeningCompleted,
      };
    });
    return apiOk({
      inspection: inspection.inspection,
      message: inspection.reopenedCompleted
        ? "Checklist dibuka kembali."
        : "Kunci deadline dibuka. Pengisian dapat dilanjutkan.",
    });
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
