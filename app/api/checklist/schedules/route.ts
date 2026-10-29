import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { generateChecklistInspections } from "@/lib/checklist-generate";
import { checklistIntervalLabel } from "@/lib/checklist-schedule";
import { checklistScheduleSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") return apiError("Hanya atasan yang dapat membuat jadwal.", 403);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistScheduleSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const assigneeIds = [...new Set(parsed.data.assigneeIds)];

  try {
    const schedule = await transaction(async (connection) => {
      const [target] = await query(
        `SELECT t.id,t.name template_name,l.id location_id,l.name location_name
         FROM checklist_templates t JOIN checklist_locations l ON l.id=$3
         WHERE t.id=$1 AND t.owner_id=$2 AND t.active AND l.owner_id=$2 AND l.active`,
        [parsed.data.templateId, user.id, parsed.data.locationId],
        connection,
      );
      if (!target) throw new Error("Template atau lokasi tidak tersedia.");
      const [version] = await query(
        `SELECT id FROM checklist_template_versions WHERE template_id=$1 ORDER BY version DESC LIMIT 1`,
        [parsed.data.templateId],
        connection,
      );
      if (!version) throw new Error("Template belum memiliki item checklist.");
      const members = await query(
        `SELECT id FROM employees
         WHERE supervisor_id=$1 AND active AND access_mode='full' AND id=ANY($2::text[])`,
        [user.id, assigneeIds],
        connection,
      );
      if (members.length !== assigneeIds.length) {
        throw new Error(
          "Sebagian anggota tim tidak aktif, hanya lihat, atau bukan bagian dari tim Anda.",
        );
      }

      const now = new Date().toISOString();
      const id = `cs_${crypto.randomUUID()}`;
      await query(
        `INSERT INTO checklist_schedules
          (id,owner_id,template_id,location_id,interval_unit,interval_count,anchor_date,due_days,active,created_by,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          id,
          user.id,
          parsed.data.templateId,
          parsed.data.locationId,
          parsed.data.intervalUnit,
          parsed.data.intervalCount,
          parsed.data.anchorDate,
          parsed.data.dueDays,
          parsed.data.active,
          user.id,
          now,
          now,
        ],
        connection,
      );
      await query(
        `INSERT INTO checklist_schedule_assignees (schedule_id,employee_id)
         SELECT $1,t.employee_id FROM unnest($2::text[]) AS t(employee_id)`,
        [id, assigneeIds],
        connection,
      );
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "checklist_jadwal_dibuat",
        objectType: "checklist",
        objectId: id,
        summary: `${user.name} membuat jadwal ${checklistIntervalLabel(parsed.data.intervalUnit, parsed.data.intervalCount)} untuk ${target.template_name as string} di ${target.location_name as string}.`,
        after: { ...parsed.data, assigneeIds },
      });
      return {
        id,
        ownerId: user.id,
        ...parsed.data,
        assigneeIds,
        createdAt: now,
        updatedAt: now,
      };
    });

    const generated = await generateChecklistInspections(user.id).catch(() => ({ created: 0 }));
    return apiOk(
      { schedule, generated: generated.created, message: "Jadwal checklist dibuat." },
      201,
    );
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
