import "server-only";
import { query, transaction } from "./db";
import type { QueryResultRow } from "pg";
import {
  CHECKLIST_GENERATION_DAYS_AHEAD,
  CHECKLIST_GENERATION_DAYS_BACK,
  checklistDueAt,
  checklistIntervalLabel,
  scheduledDates,
  shiftDate,
} from "./checklist-schedule";
import { todayLocal } from "./time";
import type { ChecklistIntervalUnit } from "./checklist-types";

interface ScheduleRow extends QueryResultRow {
  id: string;
  template_id: string;
  location_id: string;
  interval_unit: ChecklistIntervalUnit;
  interval_count: number;
  anchor_date: string;
  due_days: number;
  template_name: string;
  category: string;
  location_name: string;
  created_on: string;
  latest_version_id: string | null;
}

const CHUNK = 100;

/**
 * Idempotent calendar generator. It only creates missing occurrences for a
 * bounded window and never rewrites an inspection that already exists.
 */
export async function generateChecklistInspections(ownerId: string) {
  const schedules = (await query(
    `SELECT s.id,s.template_id,s.location_id,s.interval_unit,s.interval_count,s.anchor_date,s.due_days,
       t.name template_name,t.category,l.name location_name,
       (s.created_at AT TIME ZONE 'Asia/Jakarta')::date::text created_on,
       (SELECT v.id FROM checklist_template_versions v WHERE v.template_id=s.template_id ORDER BY v.version DESC LIMIT 1) latest_version_id
     FROM checklist_schedules s
     JOIN checklist_templates t ON t.id=s.template_id
     JOIN checklist_locations l ON l.id=s.location_id
     WHERE s.owner_id=$1 AND s.active
     ORDER BY s.id`,
    [ownerId],
  )) as ScheduleRow[];

  if (schedules.length === 0) return { created: 0 };

  const today = todayLocal();
  const windowFrom = shiftDate(today, -CHECKLIST_GENERATION_DAYS_BACK);
  const windowTo = shiftDate(today, CHECKLIST_GENERATION_DAYS_AHEAD);
  const now = new Date().toISOString();

  const rows: Array<{
    id: string;
    scheduleId: string;
    templateId: string;
    versionId: string;
    locationId: string;
    occurrenceDate: string;
    dueAt: string;
    templateName: string;
    category: string;
    locationName: string;
    periodLabel: string;
  }> = [];

  for (const schedule of schedules) {
    if (!schedule.latest_version_id) continue;
    // Never invent history before the schedule existed, and keep the window bounded.
    const from = [schedule.anchor_date.slice(0, 10), schedule.created_on, windowFrom].sort().at(-1)!;
    if (from > windowTo) continue;
    const dates = scheduledDates({
      anchorDate: schedule.anchor_date,
      unit: schedule.interval_unit,
      count: schedule.interval_count,
      from,
      to: windowTo,
    });
    const periodLabel = checklistIntervalLabel(schedule.interval_unit, schedule.interval_count);
    for (const date of dates) {
      rows.push({
        id: `ci_${crypto.randomUUID()}`,
        scheduleId: schedule.id,
        templateId: schedule.template_id,
        versionId: schedule.latest_version_id,
        locationId: schedule.location_id,
        occurrenceDate: date,
        dueAt: checklistDueAt(date, schedule.due_days),
        templateName: schedule.template_name,
        category: schedule.category,
        locationName: schedule.location_name,
        periodLabel,
      });
    }
  }

  if (rows.length === 0) return { created: 0 };

  return transaction(async (connection) => {
    const created: string[] = [];
    for (let start = 0; start < rows.length; start += CHUNK) {
      const chunk = rows.slice(start, start + CHUNK);
      const values: unknown[] = [];
      const placeholders = chunk.map((row) => {
        const offset = values.length;
        values.push(
          row.id,
          row.scheduleId,
          ownerId,
          row.templateId,
          row.versionId,
          row.locationId,
          row.occurrenceDate,
          row.dueAt,
          row.templateName,
          row.category,
          row.locationName,
          row.periodLabel,
          now,
          now,
        );
        return `(${Array.from({ length: 14 }, (_, index) => `$${offset + index + 1}`).join(",")})`;
      });
      const inserted = await query<QueryResultRow>(
        `INSERT INTO checklist_inspections
          (id,schedule_id,owner_id,template_id,template_version_id,location_id,occurrence_date,due_at,
           template_name,category,location_name,period_label,created_at,updated_at)
         VALUES ${placeholders.join(",")}
         ON CONFLICT DO NOTHING
         RETURNING id`,
        values,
        connection,
      );
      created.push(...inserted.map((row) => row.id as string));
    }

    if (created.length > 0) {
      await query(
        `INSERT INTO checklist_inspection_assignees (inspection_id,employee_id)
         SELECT i.id,sa.employee_id
         FROM checklist_inspections i JOIN checklist_schedule_assignees sa ON sa.schedule_id=i.schedule_id
         WHERE i.id=ANY($1::text[])
         ON CONFLICT DO NOTHING`,
        [created],
        connection,
      );
      await query(
        `INSERT INTO checklist_answers
          (id,inspection_id,item_id,position,prompt,guidance,required,photo_policy,require_note_on_issue,public_visible,group_path)
         SELECT 'ca_'||gen_random_uuid()::text,i.id,ti.id,
           (row_number() OVER (PARTITION BY i.id ORDER BY ti.position,ti.id)-1)::integer,
           ti.prompt,ti.guidance,ti.required,ti.photo_policy,ti.require_note_on_issue,
           ti.public_visible,ti.group_path
         FROM checklist_inspections i JOIN checklist_template_items ti ON ti.version_id=i.template_version_id
         WHERE i.id=ANY($1::text[]) AND ti.item_type='item'
         ON CONFLICT (inspection_id,item_id) DO NOTHING`,
        [created],
        connection,
      );
    }

    return { created: created.length };
  });
}
