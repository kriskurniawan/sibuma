import { getCurrentUser } from "@/lib/auth";
import {
  assertTeamMember,
  canAccessInspection,
  loadInspection,
} from "@/lib/checklist-access";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { checklistFollowUpSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { rowToCamel } from "@/lib/db-model";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistFollowUpSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const followUp = await transaction(async (connection) => {
      const inspection = await loadInspection(connection, parsed.data.inspectionId);
      if (!inspection) throw new Error("Checklist tidak ditemukan.");
      const allowed = await canAccessInspection(connection, user, inspection);
      if (!allowed) throw new Error("Kamu tidak ditugaskan pada checklist ini.");

      if (parsed.data.answerId) {
        const [answer] = await query(
          `SELECT id,prompt,condition FROM checklist_answers WHERE id=$1 AND inspection_id=$2`,
          [parsed.data.answerId, inspection.id],
          connection,
        );
        if (!answer) throw new Error("Item checklist tidak ditemukan.");
        const [condition] = answer.condition
          ? await query(
              `SELECT is_issue FROM checklist_conditions WHERE id=$1`,
              [answer.condition],
              connection,
            )
          : [];
        if (!condition?.is_issue) {
          throw new Error("Tindak lanjut hanya dibuat dari item yang bermasalah.");
        }
        const [existing] = await query(
          `SELECT id FROM checklist_follow_ups WHERE answer_id=$1 AND status<>'dibatalkan' LIMIT 1`,
          [parsed.data.answerId],
          connection,
        );
        if (existing) throw new Error("Item ini sudah memiliki tindak lanjut aktif.");
      }

      let picName: string | null = null;
      if (parsed.data.picId) {
        if (parsed.data.picId === inspection.ownerId) {
          const [owner] = await query(`SELECT name FROM employees WHERE id=$1`, [inspection.ownerId], connection);
          picName = (owner?.name as string) ?? null;
        } else {
          const member = await assertTeamMember(connection, inspection.ownerId, parsed.data.picId);
          if (!member) throw new Error("PIC harus anggota tim yang aktif.");
          picName = member.name;
        }
      }

      const now = new Date().toISOString();
      const id = `cf_${crypto.randomUUID()}`;
      await query(
        `INSERT INTO checklist_follow_ups
          (id,inspection_id,answer_id,owner_id,title,description,pic_id,priority,due_date,status,
           progress_note,result_note,created_by,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'terbuka','','',$10,$11,$12)`,
        [
          id,
          inspection.id,
          parsed.data.answerId ?? null,
          inspection.ownerId,
          parsed.data.title,
          parsed.data.description,
          parsed.data.picId ?? null,
          parsed.data.priority,
          parsed.data.dueDate ?? null,
          user.id,
          now,
          now,
        ],
        connection,
      );
      await query(
        `INSERT INTO checklist_follow_up_events (id,follow_up_id,actor_id,actor_name,action,status,note,created_at)
         VALUES ($1,$2,$3,$4,'dibuat','terbuka',$5,$6)`,
        [
          `cfe_${crypto.randomUUID()}`,
          id,
          user.id,
          user.name,
          parsed.data.description || parsed.data.title,
          now,
        ],
        connection,
      );
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "tindak_lanjut_dibuat",
        objectType: "tindak_lanjut",
        objectId: id,
        summary: `${user.name} membuat tindak lanjut "${parsed.data.title}" pada checklist ${inspection.templateName}.`,
        after: { ...parsed.data, picName },
      });
      const [row] = await query(`SELECT * FROM checklist_follow_ups WHERE id=$1`, [id], connection);
      return rowToCamel(row);
    });
    return apiOk({ followUp, message: "Tindak lanjut dibuat." }, 201);
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
