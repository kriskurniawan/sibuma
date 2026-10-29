import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { listChecklistConditions } from "@/lib/checklist-conditions";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { checklistConditionOrderSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (!can(user.role, "checklistConditions.manage")) {
    return apiError("Kamu tidak memiliki izin untuk mengatur status checklist.", 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistConditionOrderSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));
  if (new Set(parsed.data.ids).size !== parsed.data.ids.length) {
    return apiError("Urutan status berisi data ganda.");
  }

  try {
    const conditions = await transaction(async (connection) => {
      const [count] = await query<{ total: number }>(
        `SELECT count(*)::integer total FROM checklist_conditions`,
        [],
        connection,
      );
      if (Number(count.total) !== parsed.data.ids.length) {
        throw new Error("Daftar status berubah. Muat ulang lalu coba lagi.");
      }
      const [missing] = await query<{ total: number }>(
        `SELECT count(*)::integer total FROM checklist_conditions WHERE NOT (id = ANY($1::text[]))`,
        [parsed.data.ids],
        connection,
      );
      if (Number(missing.total) > 0) {
        throw new Error("Daftar status berubah. Muat ulang lalu coba lagi.");
      }

      for (const [index, id] of parsed.data.ids.entries()) {
        await query(
          `UPDATE checklist_conditions SET position=$2,updated_at=$3 WHERE id=$1`,
          [id, (index + 1) * 10, new Date().toISOString()],
          connection,
        );
      }
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "status_checklist_diurutkan",
        objectType: "checklist",
        objectId: "checklist_conditions",
        summary: `${user.name} mengubah urutan status checklist.`,
        after: { ids: parsed.data.ids },
      });
      return listChecklistConditions({ includeInactive: true, connection });
    });
    return apiOk({ conditions, message: "Urutan status disimpan." });
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
