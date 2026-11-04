import "server-only";
import type { Connection } from "./db";
import { query } from "./db";

export const CHECKLIST_SCHEDULE_DUPLICATE_MESSAGE =
  "Jadwal aktif dengan template, lokasi, dan interval yang sama sudah ada. Nonaktifkan jadwal tersebut terlebih dahulu.";

interface ScheduleIdentity {
  ownerId: string;
  templateId: string;
  locationId: string;
  intervalUnit: string;
  intervalCount: number;
  excludeId?: string;
}

/**
 * Hanya satu jadwal aktif yang boleh memakai kombinasi template, lokasi, dan
 * interval yang sama. Jadwal nonaktif tetap boleh memiliki kombinasi serupa
 * karena disimpan sebagai arsip; partial unique index menjadi pengaman terakhir
 * bila dua permintaan berjalan bersamaan.
 */
export async function assertNoDuplicateActiveSchedule(
  connection: Connection,
  schedule: ScheduleIdentity,
) {
  const [duplicate] = await query<{ id: string }>(
    `SELECT id FROM checklist_schedules
      WHERE owner_id=$1 AND template_id=$2 AND location_id=$3
        AND interval_unit=$4 AND interval_count=$5 AND active
        AND ($6::text IS NULL OR id<>$6)
      LIMIT 1`,
    [
      schedule.ownerId,
      schedule.templateId,
      schedule.locationId,
      schedule.intervalUnit,
      schedule.intervalCount,
      schedule.excludeId ?? null,
    ],
    connection,
  );
  if (duplicate) throw new Error(CHECKLIST_SCHEDULE_DUPLICATE_MESSAGE);
}
