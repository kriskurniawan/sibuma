import "server-only";
import type { QueryResultRow } from "pg";
import { query } from "./db";
import { rowToCamel } from "./db-model";
import { clampPage, type PageRequest } from "./pagination";
import { generateChecklistInspections } from "./checklist-generate";
import { buildChecklistLocationOptions } from "./checklist-location-path";
import {
  getChecklistLocationPathMap,
  getChecklistLocationScopeIds,
  listChecklistLocationOptions,
} from "./checklist-location-scope";
import {
  checklistHasStarted,
  scheduleOccurrences,
  shiftDate,
} from "./checklist-schedule";
import { todayLocal } from "./time";
import type { SessionUser } from "./types";
import type {
  ChecklistAnswer,
  ChecklistFollowUp,
  ChecklistFollowUpEvent,
  ChecklistFollowUpRow,
  ChecklistFollowUpTotals,
  ChecklistInspection,
  ChecklistInspectionDetail,
  ChecklistInspectionRef,
  ChecklistInspectionRow,
  ChecklistLocation,
  ChecklistPerson,
  ChecklistPhoto,
  ChecklistSchedule,
  ChecklistSetup,
  ChecklistSetupEmployee,
  ChecklistSetupSchedule,
  ChecklistSetupTemplate,
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistTemplateVersion,
  ChecklistTotals,
} from "./checklist-types";

function toPlain(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, toPlain(item)]),
    );
  }
  return value;
}

function mapRow<T>(row: Record<string, unknown>): T {
  return toPlain(rowToCamel(row)) as T;
}

const camelKey = (value: string) =>
  value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

const FOLLOW_UP_FIELDS = [
  "id", "inspection_id", "answer_id", "owner_id", "title", "description", "pic_id",
  "priority", "due_date", "status", "progress_note", "cancel_reason", "result_note",
  "created_by", "started_at", "completed_at", "completed_by", "created_at", "updated_at",
] as const;

function pickFollowUp(row: Record<string, unknown>): ChecklistFollowUp {
  const result: Record<string, unknown> = {};
  for (const field of FOLLOW_UP_FIELDS) result[camelKey(field)] = row[field];
  return toPlain(result) as ChecklistFollowUp;
}

function inspectionAccess(
  alias: string,
  employeeParam = "$1",
  managerParam = "$2",
) {
  return `((${managerParam}::boolean AND ${alias}.owner_id=${employeeParam}) OR EXISTS(
    SELECT 1 FROM checklist_inspection_assignees ia WHERE ia.inspection_id=${alias}.id AND ia.employee_id=${employeeParam}))`;
}

function followUpAccess(
  alias: string,
  employeeParam = "$1",
  managerParam = "$2",
) {
  return `((${managerParam}::boolean AND ${alias}.owner_id=${employeeParam}) OR ${alias}.pic_id=${employeeParam} OR EXISTS(
    SELECT 1 FROM checklist_inspection_assignees ia WHERE ia.inspection_id=${alias}.inspection_id AND ia.employee_id=${employeeParam}))`;
}

/**
 * Read access to the source checklist for the PIC of any follow-up on it.
 * Mutation routes keep using inspectionAccess, so a PIC gains context without
 * gaining permission to fill unrelated items.
 */
function inspectionViewAccess(
  alias: string,
  employeeParam = "$1",
  managerParam = "$2",
) {
  return `(${inspectionAccess(alias, employeeParam, managerParam)} OR EXISTS(
    SELECT 1 FROM checklist_follow_ups f WHERE f.inspection_id=${alias}.id AND f.pic_id=${employeeParam}))`;
}

function roleParams(user: SessionUser) {
  return [user.id, user.role === "atasan"] as const;
}

async function generateForUser(user: SessionUser) {
  const ownerId = user.role === "atasan" ? user.id : user.supervisorId;
  if (ownerId) await generateChecklistInspections(ownerId);
}

export interface ChecklistFilters {
  status?: string;
  locationId?: string;
  /** Default true: area yang dipilih mencakup seluruh sub-lokasinya. */
  includeSubLocations?: boolean;
  search?: string;
  from?: string;
  to?: string;
}

const INSPECTION_STATUSES = ["belum_dimulai", "berlangsung", "selesai", "dilewati"];

export async function getChecklistDashboard(
  user: SessionUser,
  filters: ChecklistFilters = {},
  request?: PageRequest,
) {
  await generateForUser(user);
  const [userId, manager] = roleParams(user);
  const ownerId = user.role === "atasan" ? user.id : user.supervisorId;
  const locationPathsPromise = getChecklistLocationPathMap(ownerId);
  const values: unknown[] = [userId, manager];
  let where = `WHERE ${inspectionAccess("i")}`;

  const status = filters.status ?? "aktif";
  if (status === "aktif") {
    where += ` AND i.status IN ('belum_dimulai','berlangsung')`;
  } else if (status === "terlambat") {
    where += ` AND i.status IN ('belum_dimulai','berlangsung') AND i.due_at<now()`;
  } else if (INSPECTION_STATUSES.includes(status)) {
    values.push(status);
    where += ` AND i.status=$${values.length}`;
  }
  if (filters.locationId) {
    const locationIds =
      filters.includeSubLocations === false
        ? [filters.locationId]
        : await getChecklistLocationScopeIds(ownerId, filters.locationId);
    values.push(locationIds);
    where += ` AND i.location_id=ANY($${values.length}::text[])`;
  }
  if (filters.search?.trim()) {
    values.push(filters.search.trim());
    where += ` AND position(lower($${values.length}) in lower(i.template_name||' '||i.location_name||' '||i.category))>0`;
  }
  if (filters.from) {
    values.push(filters.from);
    where += ` AND i.occurrence_date>=$${values.length}::date`;
  }
  if (filters.to) {
    values.push(filters.to);
    where += ` AND i.occurrence_date<=$${values.length}::date`;
  }

  const [countRows, locationPaths] = await Promise.all([
    query<{ total: number }>(
      `SELECT count(*)::integer total FROM checklist_inspections i ${where}`,
      values,
    ),
    locationPathsPromise,
  ]);
  const count = countRows[0];
  const pagination = request ? clampPage(request, count.total) : undefined;

  const rows = await query(
    `SELECT i.*,
       coalesce(c.answered,0)::integer answered_count,
       coalesce(c.total,0)::integer total_items,
       coalesce(f.open,0)::integer open_follow_ups,
       coalesce(asg.assignees,'[]'::json) assignees
     FROM checklist_inspections i
     LEFT JOIN LATERAL (
       SELECT count(*) FILTER (WHERE a.condition IS NOT NULL)::integer answered,
         count(*)::integer total
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
     ORDER BY CASE WHEN i.status IN ('belum_dimulai','berlangsung') THEN 0 ELSE 1 END,i.due_at,i.id
     ${pagination ? `LIMIT $${values.length + 1} OFFSET $${values.length + 2}` : ""}`,
    pagination
      ? [...values, pagination.pageSize, pagination.pageIndex * pagination.pageSize]
      : values,
  );

  const now = Date.now();
  const items: ChecklistInspectionRow[] = rows.map((row) => {
    const inspection = mapRow<ChecklistInspection>(row);
    return {
      inspection,
      assignees: (row.assignees as ChecklistPerson[]) ?? [],
      answeredCount: Number(row.answered_count),
      totalItems: Number(row.total_items),
      openFollowUps: Number(row.open_follow_ups),
      overdue:
        !["selesai", "dilewati"].includes(inspection.status) &&
        new Date(inspection.dueAt).getTime() < now,
      locationPath: locationPaths.get(inspection.locationId),
    };
  });

  const totals = await getChecklistTotals(user);
  return { items, total: count.total, pagination, totals };
}

export async function getChecklistTotals(user: SessionUser): Promise<ChecklistTotals> {
  const [userId, manager] = roleParams(user);
  const [row] = await query(
    `SELECT
       count(*) FILTER (WHERE i.status IN ('belum_dimulai','berlangsung'))::integer todo,
       count(*) FILTER (WHERE i.status IN ('belum_dimulai','berlangsung') AND i.due_at<now())::integer overdue,
       count(*) FILTER (WHERE i.status='selesai' AND i.completed_at>=date_trunc('month',now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta')::integer completed_this_month,
       (SELECT count(*)::integer FROM checklist_follow_ups f JOIN checklist_inspections i2 ON i2.id=f.inspection_id
        WHERE f.status NOT IN ('selesai','dibatalkan') AND ${inspectionAccess("i2")}) open_follow_ups
     FROM checklist_inspections i
     WHERE ${inspectionAccess("i")}`,
    [userId, manager],
  );
  return {
    todo: Number(row.todo),
    overdue: Number(row.overdue),
    completedThisMonth: Number(row.completed_this_month),
    openFollowUps: Number(row.open_follow_ups),
  };
}

async function followUpRows(where: string, values: unknown[], suffix = "") {
  const rows = await query(
    `SELECT f.id,f.inspection_id,f.answer_id,f.owner_id,f.title,f.description,f.pic_id,f.priority,
       f.due_date,f.status,f.progress_note,f.cancel_reason,f.result_note,f.created_by,f.started_at,
       f.completed_at,f.completed_by,f.created_at,f.updated_at,
       a.prompt,p.name pic_name,p.nik pic_nik,c.name creator_name,
       i.id source_inspection_id,i.template_name,i.category,i.location_name,i.occurrence_date,
       i.due_at source_due_at,i.status source_status,i.period_label
     FROM checklist_follow_ups f
     JOIN checklist_inspections i ON i.id=f.inspection_id
     LEFT JOIN checklist_answers a ON a.id=f.answer_id
     LEFT JOIN employees p ON p.id=f.pic_id
     LEFT JOIN employees c ON c.id=f.created_by
     ${where}
     ORDER BY CASE WHEN f.status IN ('terbuka','diproses','tertunda') THEN 0 ELSE 1 END,
       f.due_date NULLS LAST,f.created_at DESC,f.id ${suffix}`,
    values,
  );
  if (rows.length === 0) return [] as ChecklistFollowUpRow[];

  const events = await query(
    `SELECT * FROM checklist_follow_up_events WHERE follow_up_id=ANY($1::text[]) ORDER BY created_at,id`,
    [rows.map((row) => row.id)],
  );
  const eventsByFollowUp = new Map<string, ChecklistFollowUpEvent[]>();
  for (const event of events) {
    const mapped = mapRow<ChecklistFollowUpEvent>(event);
    const list = eventsByFollowUp.get(mapped.followUpId) ?? [];
    list.push(mapped);
    eventsByFollowUp.set(mapped.followUpId, list);
  }

  const now = Date.now();
  return rows.map((row) => {
    const followUp = pickFollowUp(row);
    const inspection: ChecklistInspectionRef = {
      id: row.source_inspection_id as string,
      templateName: row.template_name as string,
      category: row.category as string,
      locationName: row.location_name as string,
      occurrenceDate: row.occurrence_date as string,
      dueAt: (toPlain(row.source_due_at) as string),
      status: row.source_status as ChecklistInspectionRef["status"],
      periodLabel: row.period_label as string,
    };
    return {
      followUp,
      inspection,
      prompt: (row.prompt as string | null) ?? null,
      pic: row.pic_name
        ? { id: followUp.picId as string, name: row.pic_name as string, nik: row.pic_nik as string }
        : null,
      creatorName: (row.creator_name as string | null) ?? null,
      events: eventsByFollowUp.get(followUp.id) ?? [],
      overdue:
        ["terbuka", "diproses", "tertunda"].includes(followUp.status) &&
        Boolean(followUp.dueDate) &&
        new Date(`${followUp.dueDate}T23:59:59+07:00`).getTime() < now,
    };
  });
}

export async function getChecklistInspectionDetail(
  user: SessionUser,
  id: string,
): Promise<ChecklistInspectionDetail | null> {
  await generateForUser(user);
  const [userId, manager] = roleParams(user);
  const [row] = await query(
    `SELECT i.*,o.name owner_name,o.access_mode owner_access_mode,
       cb.name completed_by_name,rb.name reopened_by_name
     FROM checklist_inspections i
     JOIN employees o ON o.id=i.owner_id
     LEFT JOIN employees cb ON cb.id=i.completed_by
     LEFT JOIN employees rb ON rb.id=i.reopened_by
     WHERE i.id=$1 AND ${inspectionViewAccess("i", "$2", "$3")}`,
    [id, userId, manager],
  );
  if (!row) return null;

  const inspection = mapRow<ChecklistInspection>(row);
  const [answers, photos, assignees, scheduleRow, followUps, team] = await Promise.all([
    query(`SELECT * FROM checklist_answers WHERE inspection_id=$1 ORDER BY position,id`, [id]),
    query(`SELECT * FROM checklist_photos WHERE inspection_id=$1 ORDER BY created_at,id`, [id]),
    query(
      `SELECT e.id,e.name,e.nik FROM checklist_inspection_assignees ia
       JOIN employees e ON e.id=ia.employee_id WHERE ia.inspection_id=$1 ORDER BY e.name,e.id`,
      [id],
    ),
    inspection.scheduleId
      ? query(`SELECT * FROM checklist_schedules WHERE id=$1`, [inspection.scheduleId])
      : Promise.resolve([]),
    followUpRows(`WHERE f.inspection_id=$1`, [id]),
    query(
      `SELECT id,name,nik FROM employees
       WHERE supervisor_id=$1 AND active AND access_mode='full' ORDER BY name,id`,
      [inspection.ownerId],
    ),
  ]);

  const mappedPhotos = photos.map((photo) => mapRow<ChecklistPhoto>(photo));
  const mappedAnswers: ChecklistAnswer[] = answers.map((answer) =>
    mapRow<ChecklistAnswer>(answer),
  );
  const assigned = assignees.some((item) => item.id === user.id);
  const owner = inspection.ownerId === user.id;
  const readOnly = user.accessMode === "read_only";
  const open = !["selesai", "dilewati"].includes(inspection.status);
  const hasStarted = checklistHasStarted(inspection.occurrenceDate);
  const canFill = !readOnly && open && hasStarted && (owner || assigned);

  return {
    inspection,
    overdue:
      open &&
      new Date(inspection.dueAt).getTime() < Date.now(),
    assignees: assignees as ChecklistPerson[],
    answers: mappedAnswers.map((answer) => ({
      answer,
      photos: mappedPhotos.filter((photo) => photo.answerId === answer.id),
    })),
    photos: mappedPhotos,
    followUps,
    schedule: scheduleRow.length
      ? mapRow<ChecklistSchedule>(scheduleRow[0])
      : null,
    team: team as ChecklistPerson[],
    ownerName: (row.owner_name as string | null) ?? null,
    ownerReadOnly: row.owner_access_mode === "read_only",
    readOnly,
    canManage: !readOnly && owner,
    hasStarted,
    canFill,
    canComplete: canFill,
    canReopen: !readOnly && owner && inspection.status === "selesai",
    completedByName: (row.completed_by_name as string | null) ?? null,
    reopenedByName: (row.reopened_by_name as string | null) ?? null,
  };
}

export interface ChecklistFollowUpFilters {
  status?: string;
  search?: string;
  mine?: boolean;
}

export async function getChecklistFollowUps(
  user: SessionUser,
  filters: ChecklistFollowUpFilters = {},
  request?: PageRequest,
) {
  await generateForUser(user);
  const [userId, manager] = roleParams(user);
  let where = `WHERE ${followUpAccess("f")}`;
  const values: unknown[] = [userId, manager];

  const status = filters.status ?? "aktif";
  if (status === "aktif") {
    where += ` AND f.status IN ('terbuka','diproses','tertunda')`;
  } else if (status === "terlambat") {
    where += ` AND f.status IN ('terbuka','diproses','tertunda') AND f.due_date<(now() AT TIME ZONE 'Asia/Jakarta')::date`;
  } else if (["terbuka", "diproses", "tertunda", "selesai", "dibatalkan"].includes(status)) {
    values.push(status);
    where += ` AND f.status=$${values.length}`;
  }
  if (filters.search?.trim()) {
    values.push(filters.search.trim());
    where += ` AND position(lower($${values.length}) in lower(f.title||' '||f.description||' '||i.template_name||' '||i.location_name||' '||coalesce(p.name,'')))>0`;
  }
  if (filters.mine) {
    where += ` AND f.pic_id=$1`;
  }

  const [count] = await query<{ total: number }>(
    `SELECT count(*)::integer total FROM checklist_follow_ups f
     JOIN checklist_inspections i ON i.id=f.inspection_id
     LEFT JOIN employees p ON p.id=f.pic_id
     ${where}`,
    values,
  );
  const pagination = request ? clampPage(request, count.total) : undefined;

  let suffix = "";
  const listValues = [...values];
  if (pagination) {
    suffix = ` LIMIT $${listValues.length + 1} OFFSET $${listValues.length + 2}`;
    listValues.push(pagination.pageSize, pagination.pageIndex * pagination.pageSize);
  }
  const items = await followUpRows(where, listValues, suffix);
  const totals = await getChecklistFollowUpTotals(user);
  return { items, total: count.total, pagination, totals };
}

export async function getChecklistFollowUpTotals(
  user: SessionUser,
): Promise<ChecklistFollowUpTotals> {
  const [userId, manager] = roleParams(user);
  const [row] = await query(
    `SELECT
       count(*) FILTER (WHERE f.status IN ('terbuka','diproses','tertunda'))::integer open,
       count(*) FILTER (WHERE f.status='diproses')::integer in_progress,
       count(*) FILTER (WHERE f.status IN ('terbuka','diproses','tertunda') AND f.due_date<(now() AT TIME ZONE 'Asia/Jakarta')::date)::integer overdue,
       count(*) FILTER (WHERE f.status='selesai' AND f.completed_at>=date_trunc('month',now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta')::integer done_this_month
     FROM checklist_follow_ups f
     WHERE ${followUpAccess("f")}`,
    [userId, manager],
  );
  return {
    open: Number(row.open),
    inProgress: Number(row.in_progress),
    overdue: Number(row.overdue),
    doneThisMonth: Number(row.done_this_month),
  };
}

export async function getChecklistLocations(ownerId: string | null) {
  if (!ownerId) return [];
  return listChecklistLocationOptions(ownerId);
}

export async function getChecklistSetup(userId: string): Promise<ChecklistSetup> {  await generateChecklistInspections(userId);
  const [locations, templates, schedules, employees] = await Promise.all([
    query(`SELECT * FROM checklist_locations WHERE owner_id=$1 ORDER BY active DESC,name,id`, [userId]),
    query(`SELECT * FROM checklist_templates WHERE owner_id=$1 ORDER BY active DESC,name,id`, [userId]),
    query(
      `SELECT s.*,t.name template_name,l.name location_name,
         coalesce((SELECT json_agg(json_build_object('id',e.id,'name',e.name,'nik',e.nik,'divisionId',e.division_id,'divisionName',d.name) ORDER BY e.name,e.id)
           FROM checklist_schedule_assignees sa JOIN employees e ON e.id=sa.employee_id
           LEFT JOIN divisions d ON d.id=e.division_id
           WHERE sa.schedule_id=s.id),'[]'::json) assignees
       FROM checklist_schedules s
       JOIN checklist_templates t ON t.id=s.template_id
       JOIN checklist_locations l ON l.id=s.location_id
       WHERE s.owner_id=$1 ORDER BY s.active DESC,s.created_at DESC,s.id`,
      [userId],
    ),
    query(
      `SELECT e.id,e.name,e.nik,e.active,e.division_id,d.name division_name
       FROM employees e LEFT JOIN divisions d ON d.id=e.division_id
       WHERE e.supervisor_id=$1 AND e.active AND e.access_mode='full'
       ORDER BY d.name NULLS LAST,e.name,e.id`,
      [userId],
    ),
  ]);

  const mappedTemplates = templates.map((row) => mapRow<ChecklistTemplate>(row));
  const mappedLocations = buildChecklistLocationOptions(
    locations.map((row) => mapRow<ChecklistLocation>(row)),
  );
  const locationPaths = new Map(
    mappedLocations.map((location) => [location.id, location.path]),
  );
  const templateIds = mappedTemplates.map((template) => template.id);
  let versions: Array<ChecklistTemplateVersion & { itemCount: number }> = [];
  let items: ChecklistTemplateItem[] = [];
  if (templateIds.length > 0) {
    const [versionRows, itemRows] = await Promise.all([
      query(
        `SELECT v.*,(SELECT count(*)::integer FROM checklist_template_items ti
           WHERE ti.version_id=v.id AND ti.item_type='item') item_count
         FROM checklist_template_versions v WHERE v.template_id=ANY($1::text[])
         ORDER BY v.template_id,v.version DESC`,
        [templateIds],
      ),
      query(
        `SELECT ti.* FROM checklist_template_items ti
         JOIN checklist_template_versions v ON v.id=ti.version_id
         WHERE v.template_id=ANY($1::text[])
         ORDER BY v.template_id,v.version DESC,ti.position,ti.id`,
        [templateIds],
      ),
    ]);
    versions = versionRows.map((row) => mapRow(row));
    items = itemRows.map((row) => mapRow<ChecklistTemplateItem>(row));
  }

  const today = todayLocal();
  const mappedSchedules = schedules.map((row) => {
    const schedule = mapRow<ChecklistSchedule>(row);
    const occurrences = scheduleOccurrences(schedule, today, shiftDate(today, 400));
    const result: ChecklistSetupSchedule = {
      ...schedule,
      templateName: row.template_name as string,
      locationName: row.location_name as string,
      locationPath:
        locationPaths.get(schedule.locationId) ??
        (row.location_name as string),
      assignees: (row.assignees as ChecklistSetupEmployee[]) ?? [],
      nextOccurrence: occurrences[0] ?? null,
    };
    return result;
  });

  const setupTemplates: ChecklistSetupTemplate[] = mappedTemplates.map((template) => ({
    ...template,
    versions: versions
      .filter((version) => version.templateId === template.id)
      .map((version) => ({
        ...version,
        items: items.filter((item) => item.versionId === version.id),
      })),
    usedBySchedules: mappedSchedules.filter((schedule) => schedule.templateId === template.id).length,
  }));

  return {
    locations: mappedLocations,
    templates: setupTemplates,
    schedules: mappedSchedules,
    employees: employees.map((row) => mapRow<ChecklistSetupEmployee>(row)),
  };
}

export async function getChecklistTemplateDetail(userId: string, templateId: string) {
  const [templateRow] = await query(
    `SELECT * FROM checklist_templates WHERE id=$1 AND owner_id=$2`,
    [templateId, userId],
  );
  if (!templateRow) return null;
  const template = mapRow<ChecklistTemplate>(templateRow);
  const [versionRows, itemRows] = await Promise.all([
    query(
      `SELECT * FROM checklist_template_versions WHERE template_id=$1 ORDER BY version DESC`,
      [templateId],
    ),
    query(
      `SELECT ti.* FROM checklist_template_items ti
       JOIN checklist_template_versions v ON v.id=ti.version_id
       WHERE v.template_id=$1 ORDER BY v.version DESC,ti.position,ti.id`,
      [templateId],
    ),
  ]);
  const items = itemRows.map((row) => mapRow<ChecklistTemplateItem>(row));
  return {
    template,
    versions: versionRows.map((row) => {
      const version = mapRow<ChecklistTemplateVersion>(row);
      return { ...version, items: items.filter((item) => item.versionId === version.id) };
    }),
  };
}

export async function getChecklistPhoto(
  userId: string,
  manager: boolean,
  photoId: string,
) {
  const [row] = await query(
    `SELECT p.*,i.owner_id inspection_owner_id
     FROM checklist_photos p
     JOIN checklist_inspections i ON i.id=p.inspection_id
     WHERE p.id=$1 AND (($3::boolean AND i.owner_id=$2) OR p.uploaded_by=$2
       OR EXISTS(SELECT 1 FROM checklist_inspection_assignees ia WHERE ia.inspection_id=i.id AND ia.employee_id=$2)
       OR EXISTS(SELECT 1 FROM checklist_follow_ups f WHERE f.inspection_id=i.id AND f.pic_id=$2))`,
    [photoId, userId, manager],
  );
  if (!row) return null;
  return {
    photo: mapRow<ChecklistPhoto>(row),
    inspectionOwnerId: row.inspection_owner_id as string,
  };
}

export type { ChecklistInspectionRow };
