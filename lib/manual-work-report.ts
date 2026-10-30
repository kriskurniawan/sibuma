import "server-only";

import {
  getChecklistLocationPathMap,
  getChecklistLocationScopeIds,
  listChecklistLocationOptions,
} from "./checklist-location-scope";
import { query } from "./db";
import {
  MANUAL_WORK_ROW_JOINS,
  MANUAL_WORK_ROW_SELECT,
  mapManualWorkRow,
} from "./manual-work-queries";
import type {
  ManualWorkPerson,
  ManualWorkReportFilters,
  ManualWorkReportOptions,
  ManualWorkReportRow,
  ManualWorkReportTotals,
} from "./manual-work-types";
import { clampPage, type PageRequest } from "./pagination";

const ACTIVE_SQL = "w.status IN ('terbuka','dikerjakan')";
const TODAY_SQL = "(now() AT TIME ZONE 'Asia/Jakarta')::date";
const STATUS_VALUES = ["terbuka", "dikerjakan", "selesai", "dibatalkan"];

async function reportWhere(
  ownerId: string | null,
  filters: ManualWorkReportFilters,
) {
  const values: unknown[] = [ownerId, filters.from, filters.to];
  let where = `WHERE ($1::text IS NULL OR w.owner_id=$1)
    AND w.start_date BETWEEN $2::date AND $3::date`;

  if (filters.status === "aktif") {
    where += ` AND ${ACTIVE_SQL}`;
  } else if (filters.status === "terlambat") {
    where += ` AND ${ACTIVE_SQL} AND w.target_date < ${TODAY_SQL}`;
  } else if (filters.status && STATUS_VALUES.includes(filters.status)) {
    values.push(filters.status);
    where += ` AND w.status=$${values.length}`;
  }

  if (filters.locationId) {
    const locationIds =
      filters.includeSubLocations === false
        ? [filters.locationId]
        : await getChecklistLocationScopeIds(ownerId, filters.locationId);
    values.push(locationIds);
    where += ` AND w.location_id=ANY($${values.length}::text[])`;
  }

  if (filters.employeeId) {
    values.push(filters.employeeId);
    where += ` AND EXISTS(
      SELECT 1 FROM manual_work_assignees mwa
      WHERE mwa.work_id=w.id AND mwa.employee_id=$${values.length}
    )`;
  }

  if (filters.search?.trim()) {
    values.push(filters.search.trim());
    where += ` AND (
      position(lower($${values.length}) in lower(w.title||' '||w.location_name||' '||w.description||' '||w.result_note||' '||w.safety_name))>0
      OR EXISTS(
        SELECT 1 FROM manual_work_assignees mwas
        JOIN employees es ON es.id=mwas.employee_id
        WHERE mwas.work_id=w.id
          AND position(lower($${values.length}) in lower(es.name||' '||es.nik))>0
      )
    )`;
  }

  return { where, values };
}

export async function getManualWorkReportData(
  ownerId: string | null,
  filters: ManualWorkReportFilters,
  request?: PageRequest,
) {
  const { where, values } = await reportWhere(ownerId, filters);
  const locationPathsPromise = getChecklistLocationPathMap(ownerId);

  const [countRows, totalsRows, workersRows, locationPaths] = await Promise.all([
    query<{ total: number }>(
      `SELECT count(*)::integer total FROM manual_works w ${where}`,
      values,
    ),
    query<{
      total: number;
      active: number;
      overdue: number;
      in_progress: number;
      not_started: number;
      completed: number;
      cancelled: number;
      photos: number;
    }>(
      `SELECT count(*)::integer total,
         count(*) FILTER (WHERE ${ACTIVE_SQL})::integer active,
         count(*) FILTER (WHERE ${ACTIVE_SQL} AND w.target_date < ${TODAY_SQL})::integer overdue,
         count(*) FILTER (WHERE w.status='dikerjakan')::integer in_progress,
         count(*) FILTER (WHERE w.status='terbuka')::integer not_started,
         count(*) FILTER (WHERE w.status='selesai')::integer completed,
         count(*) FILTER (WHERE w.status='dibatalkan')::integer cancelled,
         coalesce(sum(pc.photos),0)::integer photos
       FROM manual_works w
       LEFT JOIN LATERAL (
         SELECT count(*)::integer photos FROM manual_work_photos p
         WHERE p.work_id=w.id AND p.kind='photo'
       ) pc ON true
       ${where}`,
      values,
    ),
    query<{ workers: number }>(
      `SELECT count(DISTINCT mwa.employee_id)::integer workers
       FROM manual_works w
       JOIN manual_work_assignees mwa ON mwa.work_id=w.id
       ${where}`,
      values,
    ),
    locationPathsPromise,
  ]);

  const count = Number(countRows[0]?.total ?? 0);
  const pagination = request ? clampPage(request, count) : undefined;
  const rows = await query(
    `SELECT ${MANUAL_WORK_ROW_SELECT}
     FROM manual_works w
     ${MANUAL_WORK_ROW_JOINS}
     ${where}
     ORDER BY w.start_date DESC,w.created_at DESC,w.id
     ${pagination ? `LIMIT $${values.length + 1} OFFSET $${values.length + 2}` : ""}`,
    pagination
      ? [
          ...values,
          pagination.pageSize,
          pagination.pageIndex * pagination.pageSize,
        ]
      : values,
  );

  const items: ManualWorkReportRow[] = rows.map((row) => {
    const mapped = mapManualWorkRow(row);
    return {
      ...mapped,
      locationPath: mapped.work.locationId
        ? locationPaths.get(mapped.work.locationId)
        : undefined,
    };
  });

  const totals: ManualWorkReportTotals = {
    total: Number(totalsRows[0]?.total ?? 0),
    active: Number(totalsRows[0]?.active ?? 0),
    overdue: Number(totalsRows[0]?.overdue ?? 0),
    inProgress: Number(totalsRows[0]?.in_progress ?? 0),
    notStarted: Number(totalsRows[0]?.not_started ?? 0),
    completed: Number(totalsRows[0]?.completed ?? 0),
    cancelled: Number(totalsRows[0]?.cancelled ?? 0),
    photos: Number(totalsRows[0]?.photos ?? 0),
    workers: Number(workersRows[0]?.workers ?? 0),
  };

  return { rows: items, total: count, pagination, totals };
}

export async function getManualWorkReportOptions(
  ownerId: string | null,
): Promise<ManualWorkReportOptions> {
  const [locations, employees] = await Promise.all([
    listChecklistLocationOptions(ownerId),
    query(
      ownerId
        ? `SELECT id,name,nik FROM employees
           WHERE supervisor_id=$1 AND active
           ORDER BY name,id`
        : `SELECT id,name,nik FROM employees
           WHERE role='pekerja' AND active
           ORDER BY name,id`,
      ownerId ? [ownerId] : [],
    ),
  ]);
  return {
    // listChecklistLocationOptions hanya mengembalikan lokasi aktif.
    locations: locations.map((location) => ({ ...location, active: true })),
    employees: employees as unknown as ManualWorkPerson[],
  };
}
