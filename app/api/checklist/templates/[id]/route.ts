import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
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
  const denied = readOnlyWrite(user);
  if (denied) return denied;
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat menghapus template.", 403);
  }

  const { id } = await params;
  try {
    await transaction(async (connection) => {
      const [current] = await query(
        `SELECT * FROM checklist_templates WHERE id=$1 AND owner_id=$2 FOR UPDATE`,
        [id, user.id],
        connection,
      );
      if (!current) throw new Error("Template tidak ditemukan.");

      const [usage] = await query<{ schedules: number; inspections: number }>(
        `SELECT
           (SELECT count(*)::integer FROM checklist_schedules WHERE template_id=$1) schedules,
           (SELECT count(*)::integer FROM checklist_inspections WHERE template_id=$1) inspections`,
        [id],
        connection,
      );
      const schedules = Number(usage?.schedules ?? 0);
      const inspections = Number(usage?.inspections ?? 0);
      if (schedules > 0 || inspections > 0) {
        const used = [
          schedules > 0 ? `${schedules} jadwal` : null,
          inspections > 0 ? `${inspections} inspeksi` : null,
        ].filter(Boolean);
        throw new Error(
          `Template sudah dipakai pada ${used.join(" dan ")}. Nonaktifkan saja agar riwayat tetap terbaca.`,
        );
      }

      await query(
        `DELETE FROM checklist_templates WHERE id=$1 AND owner_id=$2`,
        [id, user.id],
        connection,
      );
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "checklist_template_dihapus",
        objectType: "checklist",
        objectId: id,
        summary: `${user.name} menghapus template checklist ${current.name as string}.`,
        before: current,
      });
    });
    return apiOk({ message: "Template checklist dihapus." });
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
