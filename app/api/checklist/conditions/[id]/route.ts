import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { checklistConditionUpdateSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { rowToCamel } from "@/lib/db-model";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (!can(user.role, "checklistConditions.manage")) {
    return apiError("Kamu tidak memiliki izin untuk mengatur status checklist.", 403);
  }

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistConditionUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const condition = await transaction(async (connection) => {
      const [current] = await query(
        `SELECT * FROM checklist_conditions WHERE id=$1 FOR UPDATE`,
        [id],
        connection,
      );
      if (!current) throw new Error("Status checklist tidak ditemukan.");

      if (parsed.data.active === false && current.active) {
        const [active] = await query<{ total: number }>(
          `SELECT count(*)::integer total FROM checklist_conditions WHERE active=true`,
          [],
          connection,
        );
        if (Number(active.total) <= 1) {
          throw new Error("Minimal satu status checklist harus tetap aktif.");
        }
      }

      const next = {
        label: parsed.data.label ?? (current.label as string),
        tone: parsed.data.tone ?? (current.tone as string),
        isIssue: parsed.data.isIssue ?? (current.is_issue as boolean),
        requiresNote:
          parsed.data.requiresNote ?? (current.requires_note as boolean),
        active: parsed.data.active ?? (current.active as boolean),
      };
      const [row] = await query(
        `UPDATE checklist_conditions
         SET label=$2,tone=$3,is_issue=$4,requires_note=$5,active=$6,updated_at=$7
         WHERE id=$1 RETURNING *`,
        [
          id,
          next.label,
          next.tone,
          next.isIssue,
          next.requiresNote,
          next.active,
          new Date().toISOString(),
        ],
        connection,
      );
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "status_checklist_diubah",
        objectType: "checklist",
        objectId: id,
        summary: `${user.name} mengubah status checklist "${next.label}".`,
        before: current,
        after: next,
      });
      return rowToCamel(row);
    });
    return apiOk({ condition, message: "Status checklist diperbarui." });
  } catch (error) {
    return apiError(
      checklistErrorMessage(error, "Nama status checklist sudah dipakai."),
    );
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
  if (!can(user.role, "checklistConditions.manage")) {
    return apiError("Kamu tidak memiliki izin untuk mengatur status checklist.", 403);
  }

  const { id } = await params;
  try {
    await transaction(async (connection) => {
      const [current] = await query(
        `SELECT * FROM checklist_conditions WHERE id=$1 FOR UPDATE`,
        [id],
        connection,
      );
      if (!current) throw new Error("Status checklist tidak ditemukan.");

      const [used] = await query<{ total: number }>(
        `SELECT count(*)::integer total FROM checklist_answers WHERE condition=$1`,
        [id],
        connection,
      );
      if (Number(used.total) > 0) {
        throw new Error(
          `Status "${current.label as string}" sudah dipakai pada ${used.total} jawaban. Nonaktifkan saja agar riwayat tetap terbaca.`,
        );
      }

      if (current.active) {
        const [active] = await query<{ total: number }>(
          `SELECT count(*)::integer total FROM checklist_conditions WHERE active=true`,
          [],
          connection,
        );
        if (Number(active.total) <= 1) {
          throw new Error("Minimal satu status checklist harus tetap aktif.");
        }
      }

      await query(`DELETE FROM checklist_conditions WHERE id=$1`, [id], connection);
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "status_checklist_dihapus",
        objectType: "checklist",
        objectId: id,
        summary: `${user.name} menghapus status checklist "${current.label as string}".`,
        before: current,
      });
    });
    return apiOk({ message: "Status checklist dihapus." });
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
