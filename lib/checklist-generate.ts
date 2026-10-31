import "server-only";
import { query, transaction } from "./db";
import type { QueryResultRow } from "pg";
import {
  CHECKLIST_GENERATION_DAYS_AHEAD,
  CHECKLIST_GENERATION_DAYS_BACK,
  checklistDueAt,
  checklistIntervalLabel,
  checklistOpensAt,
  resolvedScheduleDays,
  scheduledDates,
  shiftDate,
  weekdayOf,
} from "./checklist-schedule";
import { todayLocal } from "./time";
import { sqlTimeZone } from "./sql-time-zone";
import type {
  ChecklistDistributionMode,
  ChecklistIntervalUnit,
  ChecklistScheduleDay,
} from "./checklist-types";

interface ScheduleRow extends QueryResultRow {
  id: string;
  template_id: string;
  location_id: string;
  distribution_mode: ChecklistDistributionMode;
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

interface TemplateLeafRow extends QueryResultRow {
  version_id: string;
  location_id: string | null;
  parent_location_id: string | null;
}

interface ExistingInspectionRow extends QueryResultRow {
  schedule_id: string;
  occurrence_date: string;
}

interface LocationRow extends QueryResultRow {
  id: string;
  name: string;
}

interface ScheduleDayRow extends QueryResultRow {
  schedule_id: string;
  weekday: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

interface PackageSeedRow extends QueryResultRow {
  id: string;
  schedule_id: string;
  occurrence_date: string;
}

interface InspectionPlan {
  id: string;
  scheduleId: string;
  packageId: string | null;
  templateId: string;
  versionId: string;
  locationId: string;
  occurrenceDate: string;
  opensAt: string;
  dueAt: string;
  templateName: string;
  category: string;
  locationName: string;
  periodLabel: string;
}

interface PackagePlan {
  id: string;
  scheduleId: string;
  templateId: string;
  versionId: string;
  occurrenceDate: string;
  dueAt: string;
  templateName: string;
  category: string;
  periodLabel: string;
}

const CHUNK = 100;

function chunked<T>(items: T[], size = CHUNK) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

/**
 * Idempotent calendar generator. It only creates missing occurrences for a
 * bounded window and never rewrites an inspection that already exists.
 *
 * Mode `tunggal` mempertahankan perilaku lama: satu pemeriksaan berisi semua
 * item di lokasi jadwal. Mode `per_lokasi` mengelompokkan item menurut lokasi
 * efektifnya (item → grup → lokasi jadwal) menjadi satu paket per periode.
 */
export async function generateChecklistInspections(ownerId: string) {
  const schedules = (await query(
    `SELECT s.id,s.template_id,s.location_id,s.distribution_mode,s.interval_unit,s.interval_count,
       s.anchor_date,s.due_days,t.name template_name,t.category,l.name location_name,
       (s.created_at AT TIME ZONE ${sqlTimeZone()})::date::text created_on,
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

  const scheduleIds = schedules.map((schedule) => schedule.id);
  const versionIds = [
    ...new Set(
      schedules
        .map((schedule) => schedule.latest_version_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [leafRows, existingRows, locationRows, dayRows] = await Promise.all([
    versionIds.length === 0
      ? Promise.resolve([] as TemplateLeafRow[])
      : (query(
          `SELECT ti.version_id,ti.location_id,parent.location_id parent_location_id
           FROM checklist_template_items ti
           LEFT JOIN checklist_template_items parent ON parent.id=ti.parent_item_id
           WHERE ti.version_id=ANY($1::text[]) AND ti.item_type='item'
           ORDER BY ti.version_id,ti.position,ti.id`,
          [versionIds],
        ) as Promise<TemplateLeafRow[]>),
    query(
      `SELECT schedule_id,occurrence_date
       FROM checklist_inspections
       WHERE schedule_id=ANY($1::text[]) AND occurrence_date BETWEEN $2::date AND $3::date`,
      [scheduleIds, windowFrom, windowTo],
    ) as Promise<ExistingInspectionRow[]>,
    query(`SELECT id,name FROM checklist_locations WHERE owner_id=$1`, [
      ownerId,
    ]) as Promise<LocationRow[]>,
    query(
      `SELECT schedule_id,weekday,enabled,start_time::text start_time,end_time::text end_time
       FROM checklist_schedule_days WHERE schedule_id=ANY($1::text[])`,
      [scheduleIds],
    ) as Promise<ScheduleDayRow[]>,
  ]);

  const leavesByVersion = new Map<string, TemplateLeafRow[]>();
  for (const leaf of leafRows) {
    const list = leavesByVersion.get(leaf.version_id) ?? [];
    list.push(leaf);
    leavesByVersion.set(leaf.version_id, list);
  }

  const daysBySchedule = new Map<string, ChecklistScheduleDay[]>();
  for (const row of dayRows) {
    const list = daysBySchedule.get(row.schedule_id) ?? [];
    list.push({
      weekday: row.weekday as ChecklistScheduleDay["weekday"],
      enabled: row.enabled,
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
    });
    daysBySchedule.set(row.schedule_id, list);
  }

  const existingByOccurrence = new Set(
    existingRows.map(
      (row) => `${row.schedule_id}|${String(row.occurrence_date).slice(0, 10)}`,
    ),
  );
  const locationNames = new Map(
    locationRows.map((location) => [location.id, location.name]),
  );

  const packagePlans: PackagePlan[] = [];
  const inspectionPlans: InspectionPlan[] = [];

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
    const scheduleDays = resolvedScheduleDays(
      daysBySchedule.get(schedule.id),
    );
    const periodLabel = checklistIntervalLabel(schedule.interval_unit, schedule.interval_count);

    for (const date of dates) {
      // A generated occurrence is atomic. Existing rows are never rewritten or
      // extended with a newer template version.
      if (existingByOccurrence.has(`${schedule.id}|${date}`)) continue;
      const day = scheduleDays[weekdayOf(date) - 1];
      if (!day?.enabled) continue;

      const opensAt = checklistOpensAt(date, day.startTime);
      const dueAt = checklistDueAt(date, schedule.due_days, day.endTime);
      const base = {
        scheduleId: schedule.id,
        templateId: schedule.template_id,
        versionId: schedule.latest_version_id,
        occurrenceDate: date,
        opensAt,
        dueAt,
        templateName: schedule.template_name,
        category: schedule.category,
        periodLabel,
      };

      if (schedule.distribution_mode === "tunggal") {
        inspectionPlans.push({
          ...base,
          id: `ci_${crypto.randomUUID()}`,
          packageId: null,
          locationId: schedule.location_id,
          locationName: schedule.location_name,
        });
        continue;
      }

      const leaves = leavesByVersion.get(schedule.latest_version_id) ?? [];
      if (leaves.length === 0) continue;
      const locations = new Map<string, number>();
      for (const leaf of leaves) {
        const locationId =
          leaf.location_id ??
          leaf.parent_location_id ??
          schedule.location_id;
        locations.set(locationId, (locations.get(locationId) ?? 0) + 1);
      }
      if (locations.size === 0) continue;

      const packageId = `cip_${crypto.randomUUID()}`;
      packagePlans.push({ ...base, id: packageId });
      for (const locationId of locations.keys()) {
        inspectionPlans.push({
          ...base,
          id: `ci_${crypto.randomUUID()}`,
          packageId,
          locationId,
          locationName:
            locationNames.get(locationId) ?? schedule.location_name,
        });
      }
    }
  }

  if (inspectionPlans.length === 0) return { created: 0 };

  return transaction(async (connection) => {
    // Serialize generation per owner so package ids and child inspections from
    // concurrent requests cannot diverge.
    await query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,
      [`checklist-generate:${ownerId}`],
      connection,
    );

    // Plans are computed before the lock. Re-check inside it so a concurrent
    // request that already generated an occurrence wins and this request never
    // extends an existing package with a newer template version or location set.
    const plannedScheduleIds = [
      ...new Set(
        [...packagePlans, ...inspectionPlans].map((plan) => plan.scheduleId),
      ),
    ];
    const plannedDates = [
      ...new Set(
        [...packagePlans, ...inspectionPlans].map((plan) => plan.occurrenceDate),
      ),
    ];
    const existingNow =
      plannedScheduleIds.length === 0 || plannedDates.length === 0
        ? []
        : await query<{ schedule_id: string; occurrence_date: string }>(
            `SELECT schedule_id,occurrence_date::text occurrence_date
             FROM checklist_inspections
             WHERE schedule_id=ANY($1::text[]) AND occurrence_date=ANY($2::date[])`,
            [plannedScheduleIds, plannedDates],
            connection,
          );
    const currentSchedules = await query<{
      id: string;
      template_id: string;
      distribution_mode: ChecklistDistributionMode;
      active: boolean;
    }>(
      `SELECT id,template_id,distribution_mode,active
       FROM checklist_schedules WHERE id=ANY($1::text[])`,
      [plannedScheduleIds],
      connection,
    );
    const scheduleState = new Map(
      currentSchedules.map((schedule) => [schedule.id, schedule]),
    );
    const currentDayRows = await query<{
      schedule_id: string;
      weekday: number;
      enabled: boolean;
    }>(
      `SELECT schedule_id,weekday,enabled
       FROM checklist_schedule_days WHERE schedule_id=ANY($1::text[])`,
      [plannedScheduleIds],
      connection,
    );
    const currentDays = new Map<string, Set<number>>();
    for (const row of currentDayRows) {
      const set = currentDays.get(row.schedule_id) ?? new Set<number>();
      if (row.enabled) set.add(row.weekday);
      currentDays.set(row.schedule_id, set);
    }
    const isCurrentDay = (plan: {
      scheduleId: string;
      occurrenceDate: string;
    }) => {
      const days = currentDays.get(plan.scheduleId);
      // Missing rows mean a schedule created before migration 028; the
      // migration backfills all seven days, so absence stays permissive.
      if (!days) return true;
      return days.has(weekdayOf(plan.occurrenceDate));
    };
    const isCurrent = (
      plan: {
        scheduleId: string;
        templateId: string;
        packageId?: string | null;
      },
      perLocation: boolean,
    ) => {
      const current = scheduleState.get(plan.scheduleId);
      return Boolean(
        current &&
          current.active &&
          current.template_id === plan.templateId &&
          current.distribution_mode ===
            (perLocation ? "per_lokasi" : "tunggal"),
      );
    };
    const existsNow = new Set(
      existingNow.map(
        (row) =>
          `${row.schedule_id}|${String(row.occurrence_date).slice(0, 10)}`,
      ),
    );
    const occurrenceKey = (plan: {
      scheduleId: string;
      occurrenceDate: string;
    }) => `${plan.scheduleId}|${plan.occurrenceDate.slice(0, 10)}`;
    const remainingPackages = packagePlans.filter(
      (plan) =>
        isCurrent(plan, true) &&
        isCurrentDay(plan) &&
        !existsNow.has(occurrenceKey(plan)),
    );
    const remainingInspections = inspectionPlans.filter(
      (plan) =>
        isCurrent(plan, plan.packageId !== null) &&
        isCurrentDay(plan) &&
        !existsNow.has(occurrenceKey(plan)),
    );
    if (remainingInspections.length === 0) return { created: 0 };

    const packageIds = new Map<string, string>();
    for (const chunk of chunked(remainingPackages)) {
      const values: unknown[] = [];
      const now = new Date().toISOString();
      const placeholders = chunk.map((row) => {
        const offset = values.length;
        values.push(
          row.id,
          row.scheduleId,
          ownerId,
          row.templateId,
          row.versionId,
          row.occurrenceDate,
          row.dueAt,
          row.templateName,
          row.category,
          row.periodLabel,
          now,
          now,
        );
        return `(${Array.from({ length: 12 }, (_, index) => `$${offset + index + 1}`).join(",")})`;
      });
      const inserted = (await query(
        `INSERT INTO checklist_inspection_packages
          (id,schedule_id,owner_id,template_id,template_version_id,occurrence_date,due_at,
           template_name,category,period_label,created_at,updated_at)
         VALUES ${placeholders.join(",")}
         ON CONFLICT (schedule_id,occurrence_date) WHERE schedule_id IS NOT NULL
         DO UPDATE SET updated_at=EXCLUDED.updated_at
         RETURNING id,schedule_id,occurrence_date::text occurrence_date`,
        values,
        connection,
      )) as PackageSeedRow[];
      for (const row of inserted) {
        packageIds.set(
          `${row.schedule_id}|${String(row.occurrence_date).slice(0, 10)}`,
          row.id,
        );
      }
    }

    const created: string[] = [];
    for (const chunk of chunked(remainingInspections)) {
      const now = new Date().toISOString();
      const values: unknown[] = [];
      const placeholders = chunk.map((row) => {
        const offset = values.length;
        const packageId = row.packageId
          ? (packageIds.get(`${row.scheduleId}|${row.occurrenceDate}`) ??
            row.packageId)
          : null;
        values.push(
          row.id,
          row.scheduleId,
          packageId,
          ownerId,
          row.templateId,
          row.versionId,
          row.locationId,
          row.occurrenceDate,
          row.opensAt,
          row.dueAt,
          row.templateName,
          row.category,
          row.locationName,
          row.periodLabel,
          now,
          now,
        );
        return `(${Array.from({ length: 16 }, (_, index) => `$${offset + index + 1}`).join(",")})`;
      });
      const inserted = await query<QueryResultRow>(
        `INSERT INTO checklist_inspections
          (id,schedule_id,package_id,owner_id,template_id,template_version_id,location_id,
           occurrence_date,opens_at,due_at,template_name,category,location_name,period_label,created_at,updated_at)
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
         FROM checklist_inspections i
         JOIN checklist_schedules s ON s.id=i.schedule_id
         JOIN checklist_template_items ti ON ti.version_id=i.template_version_id
         LEFT JOIN checklist_template_items parent ON parent.id=ti.parent_item_id
         WHERE i.id=ANY($1::text[]) AND ti.item_type='item'
           AND (i.package_id IS NULL
             OR coalesce(ti.location_id,parent.location_id,i.location_id)=i.location_id)
         ON CONFLICT (inspection_id,item_id) DO NOTHING`,
        [created],
        connection,
      );
    }

    return { created: created.length };
  });
}
