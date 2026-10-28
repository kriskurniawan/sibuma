import { getCurrentUser } from "@/lib/auth";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { checklistTemplateUpdateSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan") return apiError("Hanya atasan yang dapat mengubah template.", 403);

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistTemplateUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const template = await transaction(async (connection) => {
      const [current] = await query(
        `SELECT * FROM checklist_templates WHERE id=$1 AND owner_id=$2 FOR UPDATE`,
        [id, user.id],
        connection,
      );
      if (!current) throw new Error("Template tidak ditemukan.");
      const next = {
        name: parsed.data.name ?? (current.name as string),
        description: parsed.data.description ?? (current.description as string),
        active: parsed.data.active ?? (current.active as boolean),
      };
      await query(
        `UPDATE checklist_templates SET name=$3,description=$4,active=$5,updated_at=$6
         WHERE id=$1 AND owner_id=$2`,
        [id, user.id, next.name, next.description, next.active, new Date().toISOString()],
        connection,
      );
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "checklist_template_diubah",
        objectType: "checklist",
        objectId: id,
        summary: `${user.name} mengubah template checklist ${next.name}.`,
        before: current,
        after: next,
      });
      return { ...next, id, ownerId: user.id, currentVersion: current.current_version };
    });
    return apiOk({ template, message: "Template checklist diperbarui." });
  } catch (error) {
    return apiError(checklistErrorMessage(error, "Nama template sudah dipakai."));
  }
}
