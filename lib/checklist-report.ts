import "server-only";

import { query } from "./db";
import { rowToCamel } from "./db-model";
import { getChecklistLocationPathMap, getChecklistLocationScopeIds, listChecklistLocationOptions } from "./checklist-location-scope";
import { clampPage, type PageRequest } from "./pagination";
import type {
  ChecklistFollowUp,
  ChecklistFollowUpReportTotals,
  ChecklistFollowUpRow,
  ChecklistInspection,
  ChecklistInspectionRef,
  ChecklistPerson,
  ChecklistReportFilters,
  ChecklistReportOptions,
  ChecklistReportRow,
  ChecklistReportTotals,
} from "./checklist-types";

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

const OPEN_STATUSES = `('belum_dimulai','berlangsung')`;
const OPEN_FOLLOW_UP_STATUSES = `('terbuka','diproses','tertunda')`;

async function checklistWhere(userId: string | null, filters: ChecklistReportFilters) {
  const values: unknown[] = [userId, filters.from, filters.to];
  let where = `WHERE ($1::text IS NULL OR i.owner_id=$1) AND i.occurrence_date BETWEEN $2::date AND $3::date`;

  if (filters.locationId) {
    const locationIds =
      filters.includeSubLocations === false
        ? [filters.locationId]
        : await getChecklistLocationScopeIds(userId, filters.locationId);
    values.push(locationIds);
    where += ` AND i.location_id=ANY($${values.length}::text[])`;
  }
  if (filters.templateId) {
    values.push(filters.templateId);
    where += ` AND i.template_id=$${values.length}`;
  }
  if (filters.status === "aktif") {
    where += ` AND i.status IN ${OPEN_STATUSES}`;
  } else if (filters.status === "terlambat") {
    where += ` AND i.status IN ${OPEN_STATUSES} AND i.due_at<now()`;
  } else if (
    filters.status &&
    ["belum_dimulai", "berlangsung", "selesai", "dilewati"].includes(
      filters.status,
    )
  ) {
    values.push(filters.status);
    where += ` AND i.status=$${values.length}`;
  }
  if (filters.search?.trim()) {
    values.push(filters.search.trim());
    where += ` AND position(lower($${values.length}) in lower(i.template_name||' '||i.location_name||' '||i.category||' '||i.period_label))>0`;
  }
  return { where, values };
}

const FOLLOW_UP_FIELDS = [
  "id",
  "inspection_id",
  "answer_id",
  "owner_id",
  "title",
  "description",
  "pic_id",
  "safety_name",
  "priority",
  "due_date",
  "status",
  "progress_note",
  "cancel_reason",
  "result_note",
  "created_by",
  "started_at",
  "completed_at",
  "completed_by",
  "created_at",
  "updated_at",
] as const;

const camelKey = (value: string) =>
  value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

function pickFollowUp(row: Record<string, unknown>): ChecklistFollowUp {
  const result: Record<string, unknown> = {};
  for (const field of FOLLOW_UP_FIELDS) {
    result[camelKey(field)] = row[field];
  }
  return toPlain(result) as ChecklistFollowUp;
}

export async function getChecklistReportData(
  userId: string | null,
  filters: ChecklistReportFilters,
  request?: PageRequest,
) {
  const { where, values } = await checklistWhere(userId, filters);

  const locationPathsPromise = getChecklistLocationPathMap(userId);
  const countPromise = query<{ total: number }>(
    `SELECT count(*)::integer total FROM checklist_inspections i ${where}`,
    values,
  );
  const [countRows, locationPaths] = await Promise.all([
    countPromise,
    locationPathsPromise,
  ]);
  const countRow = countRows[0];
  const pagination = request ? clampPage(request, countRow.total) : undefined;

  const rowsPromise = query(
    `SELECT i.*,
       coalesce(c.answered,0)::integer answered_count,
       coalesce(c.total,0)::integer total_items,
       coalesce(c.issues,0)::integer issue_count,
       coalesce(f.open,0)::integer open_follow_ups,
       coalesce(asg.assignees,'[]'::json) assignees
     FROM checklist_inspections i
     LEFT JOIN LATERAL (
       SELECT count(*) FILTER (WHERE a.condition IS NOT NULL)::integer answered,
         count(*)::integer total,
         count(*) FILTER (WHERE a.condition IN (SELECT id FROM checklist_conditions WHERE is_issue))::integer issues
       FROM checklist_answers a WHERE a.inspection_id=i.id
     ) c ON true
     LEFT JOIN LATERAL (
       SELECT count(*)::integer open FROM checklist_follow_ups f
       WHERE f.inspection_id=i.id AND f.status NOT IN ('selesai','dibatalkan')
     ) f ON true
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object('id',e.id,'name',e.name,'nik',e.nik) ORDER BY e.name,e.id) assignees
       FROM checklist_inspection_assignees ia JOIN employees e ON e.id=ia.employee_id
       WHERE ia.inspection_id=i.id
     ) asg ON true
     ${where}
     ORDER BY i.occurrence_date DESC,i.due_at DESC,i.id
     ${
       pagination
         ? `LIMIT $${values.length + 1} OFFSET $${values.length + 2}`
         : ""
     }`,
    pagination
      ? [
          ...values,
          pagination.pageSize,
          pagination.pageIndex * pagination.pageSize,
        ]
      : values,
  );

  const [totalsRow, findingsRow, followUpRow] = await Promise.all([
    query<{
      total: number;
      completed: number;
      on_time: number;
      late: number;
      pending: number;
      overdue: number;
    }>(
      `SELECT count(*)::integer total,
         count(*) FILTER (WHERE i.status='selesai')::integer completed,
         count(*) FILTER (WHERE i.status='selesai' AND i.completed_at<=i.due_at)::integer on_time,
         count(*) FILTER (WHERE i.status='selesai' AND i.completed_at>i.due_at)::integer late,
         count(*) FILTER (WHERE i.status IN ${OPEN_STATUSES})::integer pending,
         count(*) FILTER (WHERE i.status IN ${OPEN_STATUSES} AND i.due_at<now())::integer overdue
       FROM checklist_inspections i ${where}`,
      values,
    ),
    query<{ findings: number }>(
      `SELECT count(*)::integer findings
       FROM checklist_answers a JOIN checklist_inspections i ON i.id=a.inspection_id
       ${where} AND a.condition IN (SELECT id FROM checklist_conditions WHERE is_issue)`,
      values,
    ),
    query<{ open: number }>(
      `SELECT count(*)::integer open
       FROM checklist_follow_ups f JOIN checklist_inspections i ON i.id=f.inspection_id
       ${where} AND f.status NOT IN ('selesai','dibatalkan')`,
      values,
    ),
  ]);

  const now = Date.now();
  const rows: ChecklistReportRow[] = (
    await rowsPromise
  ).map((row) => {
    const inspection = mapRow<ChecklistInspection>(row);
    const completedAt = inspection.completedAt
      ? new Date(inspection.completedAt).getTime()
      : null;
    return {
      inspection,
      assignees: (row.assignees as ChecklistPerson[]) ?? [],
      answeredCount: Number(row.answered_count),
      totalItems: Number(row.total_items),
      issueCount: Number(row.issue_count),
      openFollowUps: Number(row.open_follow_ups),
      late: Boolean(
        completedAt && completedAt > new Date(inspection.dueAt).getTime(),
      ),
      overdue:
        !["selesai", "dilewati"].includes(inspection.status) &&
        new Date(inspection.dueAt).getTime() < now,
      locationPath: locationPaths.get(inspection.locationId),
    };
  });

  const totals: ChecklistReportTotals = {
    total: Number(totalsRow[0]?.total ?? 0),
    completed: Number(totalsRow[0]?.completed ?? 0),
    onTime: Number(totalsRow[0]?.on_time ?? 0),
    late: Number(totalsRow[0]?.late ?? 0),
    pending: Number(totalsRow[0]?.pending ?? 0),
    overdue: Number(totalsRow[0]?.overdue ?? 0),
    findings: Number(findingsRow[0]?.findings ?? 0),
    openFollowUps: Number(followUpRow[0]?.open ?? 0),
  };

  return { rows, total: countRow.total, pagination, totals };
}

export async function getChecklistReportOptions(
  userId: string | null,
): Promise<ChecklistReportOptions> {
  const [locations, templates, employees] = await Promise.all([
    listChecklistLocationOptions(userId),
    query(
      userId
        ? `SELECT id,name FROM checklist_templates WHERE owner_id=$1 AND active ORDER BY name,id`
        : `SELECT id,name FROM checklist_templates WHERE active ORDER BY name,id`,
      userId ? [userId] : [],
    ),
    query(
      userId
        ? `SELECT id,name,nik FROM employees WHERE supervisor_id=$1 AND active ORDER BY name,id`
        : `SELECT id,name,nik FROM employees WHERE role='pekerja' AND active ORDER BY name,id`,
      userId ? [userId] : [],
    ),
  ]);
  return {
    locations,
    templates: templates as Array<{ id: string; name: string }>,
    employees: employees as ChecklistPerson[],
  };
}

export async function getChecklistItemExportRows(
  userId: string | null,
  filters: ChecklistReportFilters,
) {
  const { where, values } = await checklistWhere(userId, filters);
  const [rows, locationPaths] = await Promise.all([
    query(
      `SELECT i.occurrence_date,i.due_at,i.template_name,i.category,i.location_id,i.location_name,
         i.period_label,i.status,a.position,a.group_path,a.prompt,a.condition,a.note,a.updated_at
       FROM checklist_answers a
       JOIN checklist_inspections i ON i.id=a.inspection_id
       ${where}
       ORDER BY i.occurrence_date DESC,i.location_name,i.period_label,a.position,a.id`,
      values,
    ),
    getChecklistLocationPathMap(userId),
  ]);
  return rows.map((row) => {
    const mapped = mapRow<{
      occurrenceDate: string;
      dueAt: string;
      templateName: string;
      category: string;
      locationId: string;
      locationName: string;
      periodLabel: string;
      status: ChecklistInspection["status"];
      position: number;
      groupPath: string;
      prompt: string;
      condition: string | null;
      note: string;
      updatedAt: string | null;
    }>(row);
    return {
      ...mapped,
      locationPath: locationPaths.get(mapped.locationId),
    };
  });
}

async function followUpWhere(userId: string | null, filters: ChecklistReportFilters) {
  const values: unknown[] = [userId, filters.from, filters.to];
  let where = `WHERE ($1::text IS NULL OR i.owner_id=$1) AND i.occurrence_date BETWEEN $2::date AND $3::date`;

  if (filters.status === "aktif") {
    where += ` AND f.status IN ${OPEN_FOLLOW_UP_STATUSES}`;
  } else if (filters.status === "terlambat") {
    where += ` AND f.status IN ${OPEN_FOLLOW_UP_STATUSES} AND f.due_date<(now() AT TIME ZONE 'Asia/Jakarta')::date`;
  } else if (
    filters.status &&
    ["terbuka", "diproses", "tertunda", "selesai", "dibatalkan"].includes(
      filters.status,
    )
  ) {
    values.push(filters.status);
    where += ` AND f.status=$${values.length}`;
  }
  if (filters.locationId) {
    const locationIds =
      filters.includeSubLocations === false
        ? [filters.locationId]
        : await getChecklistLocationScopeIds(userId, filters.locationId);
    values.push(locationIds);
    where += ` AND i.location_id=ANY($${values.length}::text[])`;
  }
  if (filters.search?.trim()) {
    values.push(filters.search.trim());
    where += ` AND position(lower($${values.length}) in lower(f.title||' '||f.description||' '||i.template_name||' '||i.location_name||' '||i.period_label||' '||f.safety_name))>0`;
  }
  return { where, values };
}

export async function getChecklistFollowUpReportData(
  userId: string | null,
  filters: ChecklistReportFilters,
  request?: PageRequest,
) {
  const { where, values } = await followUpWhere(userId, filters);

  const locationPathsPromise = getChecklistLocationPathMap(userId);
  const countPromise = query<{ total: number }>(
    `SELECT count(*)::integer total
     FROM checklist_follow_ups f JOIN checklist_inspections i ON i.id=f.inspection_id
     ${where}`,
    values,
  );
  const [countRows, locationPaths] = await Promise.all([
    countPromise,
    locationPathsPromise,
  ]);
  const countRow = countRows[0];
  const pagination = request ? clampPage(request, countRow.total) : undefined;
  const baseValues = pagination
    ? [
        ...values,
        pagination.pageSize,
        pagination.pageIndex * pagination.pageSize,
      ]
    : values;

  const [rows, totalsRow] = await Promise.all([
    query(
      `SELECT f.*,a.prompt,p.name pic_name,p.nik pic_nik,c.name creator_name,
         i.id source_inspection_id,i.template_name,i.category,i.location_id,i.location_name,i.occurrence_date,
         i.due_at source_due_at,i.status source_status,i.period_label
       FROM checklist_follow_ups f
       JOIN checklist_inspections i ON i.id=f.inspection_id
       LEFT JOIN checklist_answers a ON a.id=f.answer_id
       LEFT JOIN employees p ON p.id=f.pic_id
       LEFT JOIN employees c ON c.id=f.created_by
       ${where}
       ORDER BY CASE WHEN f.status IN ('terbuka','diproses','tertunda') THEN 0 ELSE 1 END,
         f.due_date NULLS LAST,f.created_at DESC,f.id
       ${pagination ? `LIMIT $${values.length + 1} OFFSET $${values.length + 2}` : ""}`,
      baseValues,
    ),
    query<{
      total: number;
      open: number;
      in_progress: number;
      overdue: number;
      done: number;
      cancelled: number;
    }>(
      `SELECT count(*)::integer total,
         count(*) FILTER (WHERE f.status IN ${OPEN_FOLLOW_UP_STATUSES})::integer open,
         count(*) FILTER (WHERE f.status='diproses')::integer in_progress,
         count(*) FILTER (WHERE f.status IN ${OPEN_FOLLOW_UP_STATUSES} AND f.due_date<(now() AT TIME ZONE 'Asia/Jakarta')::date)::integer overdue,
         count(*) FILTER (WHERE f.status='selesai')::integer done,
         count(*) FILTER (WHERE f.status='dibatalkan')::integer cancelled
       FROM checklist_follow_ups f JOIN checklist_inspections i ON i.id=f.inspection_id
       ${where}`,
      values,
    ),
  ]);

  const now = Date.now();
  const items: ChecklistFollowUpRow[] = rows.map((row) => {
    const followUp = pickFollowUp(row);
    const inspection: ChecklistInspectionRef = {
      id: row.source_inspection_id as string,
      templateName: row.template_name as string,
      category: row.category as string,
      locationName: row.location_name as string,
      locationPath: locationPaths.get(row.location_id as string),
      occurrenceDate: row.occurrence_date as string,
      dueAt: toPlain(row.source_due_at) as string,
      status: row.source_status as ChecklistInspectionRef["status"],
      periodLabel: row.period_label as string,
    };
    return {
      followUp,
      inspection,
      prompt: (row.prompt as string | null) ?? null,
      pic: row.pic_name
        ? {
            id: followUp.picId as string,
            name: row.pic_name as string,
            nik: row.pic_nik as string,
          }
        : null,
      creatorName: (row.creator_name as string | null) ?? null,
      events: [],
      overdue:
        ["terbuka", "diproses", "tertunda"].includes(followUp.status) &&
        Boolean(followUp.dueDate) &&
        new Date(`${followUp.dueDate}T23:59:59+07:00`).getTime() < now,
    };
  });

  const totals: ChecklistFollowUpReportTotals = {
    total: Number(totalsRow[0]?.total ?? 0),
    open: Number(totalsRow[0]?.open ?? 0),
    inProgress: Number(totalsRow[0]?.in_progress ?? 0),
    overdue: Number(totalsRow[0]?.overdue ?? 0),
    done: Number(totalsRow[0]?.done ?? 0),
    cancelled: Number(totalsRow[0]?.cancelled ?? 0),
  };

  return { items, total: countRow.total, pagination, totals };
}
