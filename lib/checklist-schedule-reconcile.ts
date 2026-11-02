import "server-only";
import type { Connection } from "./db";
import { query } from "./db";
import {
  checklistDueFor,
  checklistOpensAt,
  resolvedScheduleDays,
  scheduleDayFor,
} from "./checklist-schedule";
import { getActiveTimeZone, todayLocal } from "./time";
import type { AppTimeZone } from "./time-zone";
import type { ChecklistScheduleDay } from "./checklist-types";

interface DayRow {
  weekday: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

const CHUNK = 500;

function chunked<T>(items: T[], size = CHUNK) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Menyesuaikan occurrence yang belum disentuh setelah hari/jam jadwal berubah.
 * Riwayat selesai, checklist berlangsung, dan occurrence yang sudah punya
 * jawaban tidak pernah dihapus atau diubah.
 *
 * Deadline juga dihitung ulang untuk occurrence lama yang masih `belum_dimulai`
 * tanpa `started_at`, karena aturan "hari libur dilewati" perlu berlaku pada
 * checklist yang belum sempat dikerjakan.
 *
 * `timeZone` eksplisit dipakai saat zona kebijakan baru disimpan: transaksi
 * policy masih memuat zona lama, sehingga perhitungan tidak boleh bergantung
 * pada zona aktif modul.
 */
export async function reconcileChecklistSchedule(
  connection: Connection,
  scheduleId: string,
  ownerId: string,
  timeZone: AppTimeZone = getActiveTimeZone(),
) {
  const [schedule] = await query(
    `SELECT due_days FROM checklist_schedules WHERE id=$1 AND owner_id=$2`,
    [scheduleId, ownerId],
    connection,
  );
  if (!schedule) return { removed: 0, rescheduled: 0, packages: 0 };

  const dueDays = Number(schedule.due_days);
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
  const today = todayLocal(timeZone);
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

  // Hanya occurrence yang belum disentuh yang boleh dihitung ulang. Tanggal
  // lampau ikut diperbarui bila pekerjaannya memang belum pernah dimulai.
  const untouched = await query<{
    id: string;
    occurrence_date: string;
    package_id: string | null;
  }>(
    `SELECT i.id,i.occurrence_date::text occurrence_date,i.package_id
     FROM checklist_inspections i
     WHERE i.schedule_id=$1 AND i.status='belum_dimulai' AND i.started_at IS NULL
     ORDER BY i.occurrence_date,i.id`,
    [scheduleId],
    connection,
  );

  const inspections = untouched.flatMap((row) => {
    const date = row.occurrence_date.slice(0, 10);
    const day = scheduleDayFor(resolved, date);
    if (!day?.enabled) return [];
    return [
      {
        id: row.id,
        opensAt: checklistOpensAt(date, day.startTime, timeZone),
        dueAt: checklistDueFor(date, dueDays, resolved, timeZone).dueAt,
      },
    ];
  });

  for (const chunk of chunked(inspections)) {
    await query(
      `UPDATE checklist_inspections i
       SET opens_at=u.opens_at::timestamptz,due_at=u.due_at::timestamptz,updated_at=now()
       FROM unnest($1::text[],$2::text[],$3::text[]) AS u(id,opens_at,due_at)
       WHERE i.id=u.id`,
      [
        chunk.map((row) => row.id),
        chunk.map((row) => row.opensAt),
        chunk.map((row) => row.dueAt),
      ],
      connection,
    );
  }

  // Paket mengikuti aturan yang sama, tetapi hanya selama belum ada inspection
  // yang mulai dikerjakan atau selesai.
  const packageRows = await query<{ id: string; occurrence_date: string }>(
    `SELECT p.id,p.occurrence_date::text occurrence_date
     FROM checklist_inspection_packages p
     WHERE p.schedule_id=$1
       AND NOT EXISTS (
         SELECT 1 FROM checklist_inspections i
         WHERE i.package_id=p.id
           AND (i.status<>'belum_dimulai' OR i.started_at IS NOT NULL)
       )`,
    [scheduleId],
    connection,
  );

  const packages = packageRows.flatMap((row) => {
    const date = row.occurrence_date.slice(0, 10);
    const day = scheduleDayFor(resolved, date);
    if (!day?.enabled) return [];
    return [{ id: row.id, dueAt: checklistDueFor(date, dueDays, resolved, timeZone).dueAt }];
  });

  for (const chunk of chunked(packages)) {
    await query(
      `UPDATE checklist_inspection_packages p
       SET due_at=u.due_at::timestamptz,updated_at=now()
       FROM unnest($1::text[],$2::text[]) AS u(id,due_at)
       WHERE p.id=u.id`,
      [chunk.map((row) => row.id), chunk.map((row) => row.dueAt)],
      connection,
    );
  }

  return {
    removed,
    rescheduled: inspections.length,
    packages: packages.length,
  };
}

/**
 * Menyesuaikan seluruh jadwal setelah zona waktu kebijakan berubah. Snapshot
 * `opens_at`/`due_at` lama dihitung dengan zona sebelumnya, sehingga tanggal
 * kalender lokalnya bisa bergeser satu hari bila tidak dihitung ulang.
 */
export async function reconcileAllChecklistSchedules(
  connection: Connection,
  timeZone: AppTimeZone,
) {
  const schedules = await query<{ id: string; owner_id: string }>(
    `SELECT id,owner_id FROM checklist_schedules ORDER BY owner_id,id`,
    [],
    connection,
  );

  const totals = { schedules: 0, removed: 0, rescheduled: 0, packages: 0 };
  for (const schedule of schedules) {
    const result = await reconcileChecklistSchedule(
      connection,
      schedule.id,
      schedule.owner_id,
      timeZone,
    );
    totals.schedules += 1;
    totals.removed += result.removed;
    totals.rescheduled += result.rescheduled;
    totals.packages += result.packages;
  }
  return totals;
}
