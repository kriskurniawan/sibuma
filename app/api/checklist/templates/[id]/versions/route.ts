import { getCurrentUser } from "@/lib/auth";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { createTemplateVersion } from "@/lib/checklist-template-write";
import { checklistVersionSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan") return apiError("Hanya atasan yang dapat menerbitkan versi.", 403);

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistVersionSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const version = await transaction(async (connection) => {
      const [template] = await query(
        `SELECT * FROM checklist_templates WHERE id=$1 AND owner_id=$2 FOR UPDATE`,
        [id, user.id],
        connection,
      );
      if (!template) throw new Error("Template tidak ditemukan.");
      const nextVersion = (template.current_version as number) + 1;
      const versionId = `ctv_${crypto.randomUUID()}`;
      const items = await createTemplateVersion(connection, {
        id: versionId,
        templateId: id,
        version: nextVersion,
        notes: parsed.data.notes || `Versi ${nextVersion}`,
        createdBy: user.id,
        items: parsed.data.items,
      });
      const now = new Date().toISOString();
      await query(
        `UPDATE checklist_templates SET current_version=$2,updated_at=$3 WHERE id=$1`,
        [id, nextVersion, now],
        connection,
      );
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "checklist_template_versi",
        objectType: "checklist",
        objectId: id,
        summary: `${user.name} menerbitkan versi ${nextVersion} template ${template.name as string}.`,
        after: {
          version: nextVersion,
          itemCount: items.filter((item) => item.itemType === "item").length,
          notes: parsed.data.notes,
        },
      });
      return {
        id: versionId,
        templateId: id,
        version: nextVersion,
        notes: parsed.data.notes || `Versi ${nextVersion}`,
        createdBy: user.id,
        createdAt: now,
        items,
      };
    });
    return apiOk({ version, message: `Versi ${version.version} diterbitkan.` }, 201);
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
