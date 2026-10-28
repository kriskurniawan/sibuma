import { getCurrentUser } from "@/lib/auth";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { generateChecklistInspections } from "@/lib/checklist-generate";
import { checklistScheduleUpdateSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan") return apiError("Hanya atasan yang dapat mengubah jadwal.", 403);

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistScheduleUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const assigneeIds =
    parsed.data.assigneeIds === undefined
      ? undefined
      : [...new Set(parsed.data.assigneeIds)];

  try {
    const schedule = await transaction(async (connection) => {
      const [current] = await query(
        `SELECT * FROM checklist_schedules WHERE id=$1 AND owner_id=$2 FOR UPDATE`,
        [id, user.id],
        connection,
      );
      if (!current) throw new Error("Jadwal tidak ditemukan.");

      const templateId = parsed.data.templateId ?? (current.template_id as string);
      const locationId = parsed.data.locationId ?? (current.location_id as string);
      const [target] = await query(
        `SELECT t.id FROM checklist_templates t JOIN checklist_locations l ON l.id=$3
         WHERE t.id=$1 AND t.owner_id=$2 AND t.active AND l.owner_id=$2 AND l.active`,
        [templateId, user.id, locationId],
        connection,
      );
      if (!target) throw new Error("Template atau lokasi tidak tersedia.");

      if (assigneeIds) {
        const members = await query(
          `SELECT id FROM employees WHERE supervisor_id=$1 AND active AND id=ANY($2::text[])`,
          [user.id, assigneeIds],
          connection,
        );
        if (members.length !== assigneeIds.length) {
          throw new Error("Sebagian anggota tim tidak aktif atau bukan bagian dari tim Anda.");
        }
      }

      const next = {
        templateId,
        locationId,
        intervalUnit: parsed.data.intervalUnit ?? (current.interval_unit as string),
        intervalCount: parsed.data.intervalCount ?? (current.interval_count as number),
        anchorDate: parsed.data.anchorDate ?? (current.anchor_date as string),
        dueDays: parsed.data.dueDays ?? (current.due_days as number),
        active: parsed.data.active ?? (current.active as boolean),
      };
      const now = new Date().toISOString();
      await query(
        `UPDATE checklist_schedules SET template_id=$3,location_id=$4,interval_unit=$5,
           interval_count=$6,anchor_date=$7,due_days=$8,active=$9,updated_at=$10
         WHERE id=$1 AND owner_id=$2`,
        [
          id,
          user.id,
          next.templateId,
          next.locationId,
          next.intervalUnit,
          next.intervalCount,
          next.anchorDate,
          next.dueDays,
          next.active,
          now,
        ],
        connection,
      );

      if (assigneeIds) {
        await query(`DELETE FROM checklist_schedule_assignees WHERE schedule_id=$1`, [id], connection);
        await query(
          `INSERT INTO checklist_schedule_assignees (schedule_id,employee_id)
           SELECT $1,t.employee_id FROM unnest($2::text[]) AS t(employee_id)`,
          [id, assigneeIds],
          connection,
        );
        // Keep open occurrences fillable by the latest team, without touching history.
        await query(
          `DELETE FROM checklist_inspection_assignees ia
           USING checklist_inspections i
           WHERE ia.inspection_id=i.id AND i.schedule_id=$1
             AND i.status IN ('belum_dimulai','berlangsung')`,
          [id],
          connection,
        );
        await query(
          `INSERT INTO checklist_inspection_assignees (inspection_id,employee_id)
           SELECT i.id,sa.employee_id FROM checklist_inspections i
           JOIN checklist_schedule_assignees sa ON sa.schedule_id=i.schedule_id
           WHERE i.schedule_id=$1 AND i.status IN ('belum_dimulai','berlangsung')
           ON CONFLICT DO NOTHING`,
          [id],
          connection,
        );
      }

      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "checklist_jadwal_diubah",
        objectType: "checklist",
        objectId: id,
        summary: `${user.name} mengubah jadwal checklist.`,
        before: current,
        after: { ...next, assigneeIds: assigneeIds ?? null },
      });
      return { id, ...next, assigneeIds: assigneeIds ?? null, updatedAt: now };
    });

    const generated = await generateChecklistInspections(user.id).catch(() => ({ created: 0 }));
    return apiOk({ schedule, generated: generated.created, message: "Jadwal checklist diperbarui." });
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
