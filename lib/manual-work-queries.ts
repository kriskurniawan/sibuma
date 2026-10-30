import "server-only";
import type { QueryResultRow } from "pg";
import { query } from "./db";
import { rowToCamel } from "./db-model";
import { listManualWorkLocations } from "./manual-work-locations";
import { clampPage, type PageRequest } from "./pagination";
import { todayLocal } from "./time";
import type { SessionUser } from "./types";
import type {
  ManualWork,
  ManualWorkDetail,
  ManualWorkEvent,
  ManualWorkFilterOptions,
  ManualWorkFilters,
  ManualWorkFollowUpOption,
  ManualWorkFormData,
  ManualWorkPerson,
  ManualWorkPhoto,
  ManualWorkRow,
  ManualWorkStatus,
  ManualWorkTeamMember,
  ManualWorkTotals,
} from "./manual-work-types";

const ACTIVE_STATUSES: ManualWorkStatus[] = ["terbuka", "dikerjakan"];
const TODAY_SQL = "(now() AT TIME ZONE 'Asia/Jakarta')::date";

function toPlain(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        toPlain(item),
      ]),
    );
  }
  return value;
}

function mapRow<T>(row: Record<string, unknown>): T {
  return toPlain(rowToCamel(row)) as T;
}

const WORK_FIELDS = [
  "id",
  "owner_id",
  "title",
  "description",
  "safety_name",
  "location_id",
  "location_name",
  "start_date",
  "target_date",
  "requires_documentation",
  "status",
  "source_follow_up_id",
  "result_note",
  "cancel_reason",
  "created_by",
  "started_at",
  "completed_at",
  "completed_by",
  "reopened_at",
  "reopened_by",
  "reopen_reason",
  "created_at",
  "updated_at",
] as const;

const camelKey = (value: string) =>
  value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

function pickWork(row: Record<string, unknown>): ManualWork {
  const result: Record<string, unknown> = {};
  for (const field of WORK_FIELDS) result[camelKey(field)] = row[field];
  return toPlain(result) as ManualWork;
}

function roleParams(user: SessionUser) {
  return [user.id, user.role === "atasan"] as const;
}

/**
 * Atasan melihat pekerjaan miliknya; pekerja melihat pekerjaan yang
 * ditugaskan kepadanya dan laporan yang ia buat sendiri. Super admin tidak
 * memakai modul operasional ini.
 */
function workAccess(
  alias: string,
  employeeParam = "$1",
  managerParam = "$2",
) {
  return `((${managerParam}::boolean AND ${alias}.owner_id=${employeeParam})
    OR ${alias}.created_by=${employeeParam}
    OR EXISTS(
    SELECT 1 FROM manual_work_assignees mwa
    WHERE mwa.work_id=${alias}.id AND mwa.employee_id=${employeeParam}))`;
}

export const MANUAL_WORK_ROW_SELECT = `w.*,o.name owner_name,cr.name created_by_name,
  coalesce(asg.assignees,'[]'::json) assignees,
  coalesce(pc.photo_count,0)::integer photo_count,
  f.title source_follow_up_title,f.inspection_id source_follow_up_inspection_id`;

export const MANUAL_WORK_ROW_JOINS = `JOIN employees o ON o.id=w.owner_id
  JOIN employees cr ON cr.id=w.created_by
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('id',e.id,'name',e.name,'nik',e.nik) ORDER BY e.name,e.id) assignees
    FROM manual_work_assignees mwa JOIN employees e ON e.id=mwa.employee_id
    WHERE mwa.work_id=w.id
  ) asg ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::integer photo_count FROM manual_work_photos p
    WHERE p.work_id=w.id AND p.kind='photo'
  ) pc ON true
  LEFT JOIN checklist_follow_ups f ON f.id=w.source_follow_up_id`;

export function mapManualWorkRow(row: Record<string, unknown>): ManualWorkRow {
  const work = pickWork(row);
  const today = todayLocal();
  const assignees = (row.assignees as ManualWorkPerson[] | null) ?? [];
  return {
    work,
    assignees,
    photoCount: Number(row.photo_count),
    overdue:
      ACTIVE_STATUSES.includes(work.status) &&
      Boolean(work.targetDate) &&
      String(work.targetDate) < today,
    ownerName: (row.owner_name as string | null) ?? "Atasan",
    createdByName: (row.created_by_name as string | null) ?? "Tidak diketahui",
    selfReported: work.createdBy !== work.ownerId,
    sourceFollowUp:
      work.sourceFollowUpId && row.source_follow_up_title
        ? {
            id: work.sourceFollowUpId,
            title: row.source_follow_up_title as string,
            inspectionId: row.source_follow_up_inspection_id as string,
          }
        : null,
  };
}

export async function getManualWorkTotals(
  user: SessionUser,
): Promise<ManualWorkTotals> {
  const [userId, manager] = roleParams(user);
  const [row] = await query(
    `SELECT
       count(*) FILTER (WHERE w.status IN ('terbuka','dikerjakan'))::integer active,
       count(*) FILTER (WHERE w.status IN ('terbuka','dikerjakan') AND w.target_date < ${TODAY_SQL})::integer overdue,
       count(*) FILTER (WHERE w.status='terbuka')::integer not_started,
       count(*) FILTER (WHERE w.status='selesai' AND w.completed_at>=date_trunc('month',now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta')::integer completed_this_month
     FROM manual_works w
     WHERE ${workAccess("w")}`,
    [userId, manager],
  );
  return {
    active: Number(row.active),
    overdue: Number(row.overdue),
    notStarted: Number(row.not_started),
    completedThisMonth: Number(row.completed_this_month),
  };
}

/**
 * Pilihan filter "siapa yang bekerja": pekerja dari tim pemilik pekerjaan,
 * lengkap dengan divisinya agar daftar dapat dikelompokkan.
 */
export async function getManualWorkFilterOptions(
  user: SessionUser,
): Promise<ManualWorkFilterOptions> {
  const ownerId =
    user.role === "atasan"
      ? user.id
      : user.role === "pekerja"
        ? user.supervisorId
        : null;
  if (!ownerId) return { divisions: [], workers: [] };

  const [divisions, workers] = await Promise.all([
    query<{ id: string; name: string; active: boolean }>(
      `SELECT id,name,active FROM divisions
       WHERE supervisor_id=$1
       ORDER BY active DESC,name,id`,
      [ownerId],
    ),
    query<{
      id: string;
      name: string;
      nik: string;
      division_id: string | null;
      division_name: string | null;
    }>(
      `SELECT e.id,e.name,e.nik,e.division_id,d.name division_name
       FROM employees e
       LEFT JOIN divisions d ON d.id=e.division_id
       WHERE e.supervisor_id=$1 AND e.active AND e.access_mode='full'
       ORDER BY d.name NULLS LAST,e.name,e.id`,
      [ownerId],
    ),
  ]);

  return {
    divisions,
    workers: workers.map((row) => ({
      id: row.id,
      name: row.name,
      nik: row.nik,
      divisionId: row.division_id,
      divisionName: row.division_name,
    })),
  };
}

export async function getManualWorks(
  user: SessionUser,
  filters: ManualWorkFilters = {},
  request?: PageRequest,
) {
  const [userId, manager] = roleParams(user);
  const values: unknown[] = [userId, manager];
  let where = `WHERE ${workAccess("w")}`;

  const status = filters.status ?? "aktif";
  if (status === "aktif") {
    where += ` AND w.status IN ('terbuka','dikerjakan')`;
  } else if (status === "terlambat") {
    where += ` AND w.status IN ('terbuka','dikerjakan') AND w.target_date < ${TODAY_SQL}`;
  } else if (status === "belum_mulai") {
    where += ` AND w.status='terbuka'`;
  } else if (["terbuka", "dikerjakan", "selesai", "dibatalkan"].includes(status)) {
    values.push(status);
    where += ` AND w.status=$${values.length}`;
  }

  if (filters.search?.trim()) {
    values.push(filters.search.trim());
    where += ` AND position(lower($${values.length}) in lower(w.title||' '||w.location_name||' '||w.description||' '||w.safety_name))>0`;
  }

  if (filters.divisionId?.trim()) {
    values.push(filters.divisionId.trim());
    where += ` AND EXISTS(
      SELECT 1 FROM manual_work_assignees mwa_division
      JOIN employees e_division ON e_division.id=mwa_division.employee_id
      WHERE mwa_division.work_id=w.id
        AND e_division.division_id=$${values.length})`;
  }

  if (filters.employeeId?.trim()) {
    values.push(filters.employeeId.trim());
    where += ` AND EXISTS(
      SELECT 1 FROM manual_work_assignees mwa_worker
      WHERE mwa_worker.work_id=w.id
        AND mwa_worker.employee_id=$${values.length})`;
  }

  const [countRows] = await query<{ total: number }>(
    `SELECT count(*)::integer total FROM manual_works w ${where}`,
    values,
  );
  const count = countRows?.total ?? 0;
  const pagination = request ? clampPage(request, count) : undefined;

  const rows = await query(
    `SELECT ${MANUAL_WORK_ROW_SELECT}
     FROM manual_works w
     ${MANUAL_WORK_ROW_JOINS}
     ${where}
     ORDER BY
       CASE WHEN w.status IN ('terbuka','dikerjakan') THEN 0 ELSE 1 END,
       CASE WHEN w.status IN ('terbuka','dikerjakan') AND w.target_date < ${TODAY_SQL} THEN 0 ELSE 1 END,
       w.target_date NULLS LAST,w.updated_at DESC,w.id
     ${pagination ? `LIMIT $${values.length + 1} OFFSET $${values.length + 2}` : ""}`,
    pagination
      ? [...values, pagination.pageSize, pagination.pageIndex * pagination.pageSize]
      : values,
  );

  return {
    items: rows.map((row) => mapManualWorkRow(row)),
    total: count,
    pagination,
    totals: await getManualWorkTotals(user),
  };
}

export async function getManualWorkDashboard(
  user: SessionUser,
  limit = 3,
): Promise<{ items: ManualWorkRow[]; totals: ManualWorkTotals }> {
  const [userId, manager] = roleParams(user);
  const [rows, totals] = await Promise.all([
    query(
      `SELECT ${MANUAL_WORK_ROW_SELECT}
       FROM manual_works w
       ${MANUAL_WORK_ROW_JOINS}
       WHERE ${workAccess("w")}
         AND w.status IN ('terbuka','dikerjakan')
       ORDER BY
         CASE WHEN w.target_date < ${TODAY_SQL} THEN 0 ELSE 1 END,
         w.target_date NULLS LAST,w.updated_at DESC,w.id
       LIMIT $3`,
      [userId, manager, Math.max(1, Math.min(limit, 10))],
    ),
    getManualWorkTotals(user),
  ]);
  return { items: rows.map((row) => mapManualWorkRow(row)), totals };
}

export async function getManualWorkDetail(
  user: SessionUser,
  id: string,
): Promise<ManualWorkDetail | null> {
  const [userId, manager] = roleParams(user);
  const [row] = await query(
    `SELECT ${MANUAL_WORK_ROW_SELECT},cb.name completed_by_name,rb.name reopened_by_name
     FROM manual_works w
     ${MANUAL_WORK_ROW_JOINS}
     LEFT JOIN employees cb ON cb.id=w.completed_by
     LEFT JOIN employees rb ON rb.id=w.reopened_by
     WHERE w.id=$3 AND ${workAccess("w")}`,
    [userId, manager, id],
  );
  if (!row) return null;

  const detailRow = mapManualWorkRow(row);
  const [photos, events] = await Promise.all([
    query(
      `SELECT * FROM manual_work_photos WHERE work_id=$1 ORDER BY created_at,id`,
      [id],
    ),
    query(
      `SELECT * FROM manual_work_events WHERE work_id=$1 ORDER BY created_at,id`,
      [id],
    ),
  ]);

  const work = detailRow.work;
  const owner = user.role === "atasan" && work.ownerId === user.id;
  const reporter = user.role === "pekerja" && work.createdBy === user.id;
  const assigned = detailRow.assignees.some((person) => person.id === user.id);
  const readOnly = user.accessMode === "read_only";
  const active = ACTIVE_STATUSES.includes(work.status);
  const operator = !readOnly && (owner || reporter || assigned);
  const canManage = !readOnly && (owner || reporter);

  return {
    ...detailRow,
    photos: photos.map((photo) => mapRow<ManualWorkPhoto>(photo)),
    events: events.map((event) => mapRow<ManualWorkEvent>(event)),
    completedByName: (row.completed_by_name as string | null) ?? null,
    reopenedByName: (row.reopened_by_name as string | null) ?? null,
    readOnly,
    canEdit: canManage && active,
    canStart: operator && work.status === "terbuka",
    canComplete: operator && work.status === "dikerjakan",
    canCancel: canManage && active,
    canReopen: !readOnly && owner && work.status === "selesai",
    canUpload: operator && active,
  };
}

export async function getManualWorkFormData(
  user: SessionUser,
  currentWorkId?: string,
): Promise<ManualWorkFormData> {
  let ownerId: string | null = null;

  if (user.role === "atasan") {
    ownerId = user.id;
  } else if (user.role === "pekerja") {
    // Saat mengubah laporan sendiri, pakai pemilik pekerjaan agar daftar
    // lokasi tetap sama walau supervisor pekerja sudah berubah.
    if (currentWorkId) {
      const [work] = await query<{ owner_id: string }>(
        `SELECT owner_id FROM manual_works WHERE id=$1 AND created_by=$2`,
        [currentWorkId, user.id],
      );
      ownerId = work?.owner_id ?? null;
    }
    if (!ownerId) {
      const [employee] = await query<{ supervisor_id: string | null }>(
        `SELECT supervisor_id FROM employees
         WHERE id=$1 AND role='pekerja' AND active`,
        [user.id],
      );
      ownerId = employee?.supervisor_id ?? user.supervisorId;
    }
  }

  const [teamRows, followUpRows, locations] = await Promise.all([
    // Pelapor dan atasan sama-sama memilih dari tim pemilik pekerjaan, supaya
    // pekerja yang mencatat dapat menambahkan rekan yang ikut mengerjakan.
    ownerId
      ? query(
          `SELECT e.id,e.name,e.nik,e.phone,e.division_id,d.name division_name
           FROM employees e
           LEFT JOIN divisions d ON d.id=e.division_id
           WHERE e.supervisor_id=$1 AND e.active AND e.access_mode='full'
           ORDER BY d.name NULLS LAST,e.name,e.id`,
          [ownerId],
        )
      : Promise.resolve([]),
    user.role === "atasan"
      ? query(
          `SELECT f.id,f.title,f.inspection_id,f.due_date
           FROM checklist_follow_ups f
           WHERE f.owner_id=$1
             AND (
               -- Tautan lama tetap tampil walau temuannya sudah ditutup.
               f.id = (SELECT source_follow_up_id FROM manual_works WHERE id=$2)
               OR (
                 f.status IN ('terbuka','diproses','tertunda')
                 AND NOT EXISTS(
                   SELECT 1 FROM manual_works w
                   WHERE w.source_follow_up_id=f.id
                     AND w.status <> 'dibatalkan'
                     AND ($2::text IS NULL OR w.id <> $2)
                 )
               )
             )
           ORDER BY f.due_date NULLS LAST,f.created_at DESC,f.id`,
          [user.id, currentWorkId ?? null],
        )
      : Promise.resolve([]),
    ownerId ? listManualWorkLocations(ownerId) : Promise.resolve([]),
  ]);

  return {
    team: (
      teamRows as unknown as Array<
        QueryResultRow & {
          id: string;
          name: string;
          nik: string;
          phone: string;
          division_id: string | null;
          division_name: string | null;
        }
      >
    ).map((row) => ({
      id: row.id,
      name: row.name,
      nik: row.nik,
      phone: row.phone,
      divisionId: row.division_id,
      divisionName: row.division_name,
    })) satisfies ManualWorkTeamMember[],
    followUps: (
      followUpRows as Array<QueryResultRow & {
        id: string;
        title: string;
        inspection_id: string;
        due_date: string | null;
      }>
    ).map((row) => ({
      id: row.id,
      title: row.title,
      inspectionId: row.inspection_id,
      dueDate: row.due_date,
    })) satisfies ManualWorkFollowUpOption[],
    locations,
  };
}
