import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { createTemplateVersion } from "@/lib/checklist-template-write";
import { checklistTemplateSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat membuat template checklist.", 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistTemplateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const result = await transaction(async (connection) => {
      const now = new Date().toISOString();
      const templateId = `ct_${crypto.randomUUID()}`;
      const versionId = `ctv_${crypto.randomUUID()}`;
      await query(
        `INSERT INTO checklist_templates
          (id,owner_id,name,category,description,active,current_version,created_by,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,true,1,$6,$7,$8)`,
        [templateId, user.id, parsed.data.name, parsed.data.category, parsed.data.description, user.id, now, now],
        connection,
      );
      const items = await createTemplateVersion(connection, {
        id: versionId,
        templateId,
        version: 1,
        notes: "Versi awal",
        createdBy: user.id,
        items: parsed.data.items,
      });
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "checklist_template_dibuat",
        objectType: "checklist",
        objectId: templateId,
        summary: `${user.name} membuat template checklist ${parsed.data.name}.`,
        after: {
          version: 1,
          itemCount: items.filter((item) => item.itemType === "item").length,
        },
      });
      return {
        template: {
          id: templateId,
          ownerId: user.id,
          name: parsed.data.name,
          category: parsed.data.category,
          description: parsed.data.description,
          active: true,
          currentVersion: 1,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        },
        version: { id: versionId, templateId, version: 1, notes: "Versi awal", createdBy: user.id, createdAt: now, items },
      };
    });
    return apiOk({ ...result, message: "Template checklist dibuat." }, 201);
  } catch (error) {
    return apiError(
      checklistErrorMessage(error, "Nama template sudah dipakai."),
    );
  }
}
