import "server-only";
import type { Connection } from "./db";
import { query } from "./db";
import {
  resolvedScheduleDays,
} from "./checklist-schedule";
import { todayLocal } from "./time";
import type { ChecklistScheduleDay } from "./checklist-types";

interface DayRow {
  weekday: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

/**
 * Menyesuaikan occurrence yang belum disentuh setelah hari/jam jadwal berubah.
 * Riwayat selesai, checklist berlangsung, dan occurrence yang sudah punya
 * jawaban tidak pernah dihapus atau diubah.
 */
export async function reconcileChecklistSchedule(
  connection: Connection,
  scheduleId: string,
  ownerId: string,
) {
  const [schedule] = await query(
    `SELECT due_days FROM checklist_schedules WHERE id=$1 AND owner_id=$2`,
    [scheduleId, ownerId],
    connection,
  );
  if (!schedule) return { removed: 0, rescheduled: 0 };

  const dayRows = (await query(
    `SELECT weekday,enabled,start_time::text start_time,end_time::text end_time
     FROM checklist_schedule_days WHERE schedule_id=$1`,
    [scheduleId],
    connection,
  )) as DayRow[];
  const days: ChecklistScheduleDay[] = dayRows.map((row) => ({
    weekday: row.weekday as ChecklistScheduleDay["weekday"],
    enabled: row.enabled,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
  }));
  const resolved = resolvedScheduleDays(days);
  const today = todayLocal();
  const disabled = resolved
    .filter((day) => !day.enabled)
    .map((day) => day.weekday);

  let removed = 0;
  if (disabled.length > 0) {
    const deleted = await query<{ id: string }>(
      `DELETE FROM checklist_inspections
       WHERE schedule_id=$1 AND occurrence_date>=$2::date
         AND status='belum_dimulai' AND started_at IS NULL
         AND extract(isodow FROM occurrence_date)::integer=ANY($3::integer[])
       RETURNING id`,
      [scheduleId, today, disabled],
      connection,
    );
    removed = deleted.length;
    await query(
      `DELETE FROM checklist_inspection_packages p
       WHERE p.schedule_id=$1 AND p.occurrence_date>=$2::date
         AND NOT EXISTS (
           SELECT 1 FROM checklist_inspections i WHERE i.package_id=p.id
         )`,
      [scheduleId, today],
      connection,
    );
  }

  const tz = `coalesce((SELECT timezone FROM policies WHERE id='policy'), 'Asia/Jakarta')`;
  const rescheduled = await query<{ id: string }>(
    `UPDATE checklist_inspections i
     SET opens_at=((i.occurrence_date + d.start_time) AT TIME ZONE ${tz}),
         due_at=(((i.occurrence_date + $2::integer) + d.end_time) AT TIME ZONE ${tz}),
         updated_at=now()
     FROM checklist_schedule_days d
     WHERE i.schedule_id=$1 AND i.occurrence_date>=$3::date
       AND i.status='belum_dimulai' AND i.started_at IS NULL
       AND d.schedule_id=i.schedule_id
       AND d.weekday=extract(isodow FROM i.occurrence_date)
       AND d.enabled
     RETURNING i.id`,
    [scheduleId, Number(schedule.due_days), today],
    connection,
  );

  await query(
    `UPDATE checklist_inspection_packages p
     SET due_at=(((p.occurrence_date + $2::integer) + d.end_time) AT TIME ZONE ${tz}),
         updated_at=now()
     FROM checklist_schedule_days d
     WHERE p.schedule_id=$1 AND p.occurrence_date>=$3::date
       AND d.schedule_id=p.schedule_id
       AND d.weekday=extract(isodow FROM p.occurrence_date)
       AND d.enabled
       AND NOT EXISTS (
         SELECT 1 FROM checklist_inspections i
         WHERE i.package_id=p.id AND i.status<>'belum_dimulai'
       )`,
    [scheduleId, Number(schedule.due_days), today],
    connection,
  );

  return { removed, rescheduled: rescheduled.length };
}
