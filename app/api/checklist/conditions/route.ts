import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { listChecklistConditions } from "@/lib/checklist-conditions";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { checklistConditionSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { rowToCamel } from "@/lib/db-model";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (!can(user.role, "checklistConditions.manage")) {
    return apiError("Kamu tidak memiliki izin untuk mengatur status checklist.", 403);
  }

  const conditions = await listChecklistConditions({ includeInactive: true });
  return apiOk({ conditions });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (!can(user.role, "checklistConditions.manage")) {
    return apiError("Kamu tidak memiliki izin untuk mengatur status checklist.", 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistConditionSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const condition = await transaction(async (connection) => {
      const id = `cc_${crypto.randomUUID()}`;
      const [order] = await query<{ position: number }>(
        `SELECT coalesce(max(position),0)+10 position FROM checklist_conditions`,
        [],
        connection,
      );
      const now = new Date().toISOString();
      const [row] = await query(
        `INSERT INTO checklist_conditions
          (id,label,tone,is_issue,requires_note,active,position,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
         RETURNING *`,
        [
          id,
          parsed.data.label,
          parsed.data.tone,
          parsed.data.isIssue,
          parsed.data.requiresNote,
          parsed.data.active,
          order.position,
          now,
        ],
        connection,
      );
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "status_checklist_ditambah",
        objectType: "checklist",
        objectId: id,
        summary: `${user.name} menambahkan status checklist "${parsed.data.label}".`,
        after: parsed.data,
      });
      return rowToCamel(row);
    });
    return apiOk({ condition, message: "Status checklist ditambahkan." }, 201);
  } catch (error) {
    return apiError(
      checklistErrorMessage(error, "Nama status checklist sudah dipakai."),
    );
  }
}
