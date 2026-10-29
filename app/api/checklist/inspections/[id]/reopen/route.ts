import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
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
      if (current.status !== "selesai") throw new Error("Hanya checklist selesai yang dapat dibuka kembali.");

      const now = new Date().toISOString();
      await query(
        `UPDATE checklist_inspections
         SET status='berlangsung',completed_at=NULL,completed_by=NULL,
           reopened_at=$2,reopened_by=$3,reopen_reason=$4,updated_at=$2
         WHERE id=$1`,
        [id, now, user.id, parsed.data.reason],
        connection,
      );
      const [updated] = await query(`SELECT * FROM checklist_inspections WHERE id=$1`, [id], connection);
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "checklist_dibuka_kembali",
        objectType: "checklist",
        objectId: id,
        summary: `${user.name} membuka kembali checklist ${current.template_name as string}.`,
        before: { status: current.status, completedAt: current.completed_at },
        after: { status: "berlangsung", reason: parsed.data.reason },
      });
      return rowToCamel(updated);
    });
    return apiOk({ inspection, message: "Checklist dibuka kembali." });
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
