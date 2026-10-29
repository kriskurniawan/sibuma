import "server-only";

import { randomBytes } from "node:crypto";
import { query, transaction } from "./db";
import { rowToCamel } from "./db-model";
import { insertChecklistAudit } from "./checklist-audit";
import { getChecklistLocationScope } from "./checklist-location-scope";
import type {
  ChecklistLocation,
  ChecklistPublicArea,
  ChecklistPublicHistoryEntry,
  ChecklistPublicItem,
  ChecklistPublicLatest,
  ChecklistPublicLocation,
  ChecklistPublicStaffTask,
  ChecklistPublicTimelineEntry,
  ChecklistQrCode,
  ChecklistQrMode,
  ChecklistQrSetup,
} from "./checklist-types";
import { checklistQrPath } from "./checklist-types";
import type { SessionUser } from "./types";

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

function qrTargetPath(code: Pick<ChecklistQrCode, "token" | "mode" | "locationId">) {
  return checklistQrPath(code);
}

export { qrTargetPath };

export async function getChecklistQrSetup(
  userId: string,
): Promise<ChecklistQrSetup> {
  const [codes, locations] = await Promise.all([
    query(
      `SELECT q.*,l.name location_name
       FROM checklist_qr_codes q
       LEFT JOIN checklist_locations l ON l.id=q.location_id
       WHERE q.owner_id=$1
       ORDER BY q.active DESC,q.created_at DESC,q.id`,
      [userId],
    ),
    query(
      `SELECT * FROM checklist_locations WHERE owner_id=$1 ORDER BY active DESC,name,id`,
      [userId],
    ),
  ]);
  return {
    codes: codes.map((row) => ({
      ...mapRow<ChecklistQrCode>(row),
      locationName: (row.location_name as string | null) ?? null,
    })),
    locations: locations.map((row) => mapRow<ChecklistLocation>(row)),
  };
}

export interface ResolvedChecklistQr extends ChecklistQrCode {
  locationName: string | null;
  locationPublicEnabled: boolean | null;
  locationActive: boolean | null;
}

export async function resolveChecklistQrToken(
  token: string,
): Promise<ResolvedChecklistQr | null> {
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(token)) return null;
  const [row] = await query(
    `SELECT q.*,l.name location_name,l.public_enabled location_public_enabled,l.active location_active
     FROM checklist_qr_codes q
     LEFT JOIN checklist_locations l ON l.id=q.location_id
     WHERE q.token=$1`,
    [token],
  );
  if (!row) return null;
  return {
    ...mapRow<ChecklistQrCode>(row),
    locationName: (row.location_name as string | null) ?? null,
    locationPublicEnabled:
      row.location_public_enabled === null
        ? null
        : Boolean(row.location_public_enabled),
    locationActive:
      row.location_active === null ? null : Boolean(row.location_active),
  };
}

function publicLocationSelect(scopeFilter: string) {
  return `SELECT l.id,l.name,l.public_description,l.parent_id,p.name parent_name,
       li.inspection_id,li.status,li.occurrence_date,li.due_at,li.completed_at,
       li.started_at,li.period_label,li.template_name,li.category,
       coalesce(li.answered_count,0)::integer answered_count,
       coalesce(li.total_items,0)::integer total_items,
       coalesce(li.issue_count,0)::integer issue_count,
       coalesce(li.open_follow_ups,0)::integer open_follow_ups
     FROM checklist_locations l
     LEFT JOIN checklist_locations p ON p.id=l.parent_id
     LEFT JOIN LATERAL (
       SELECT i.id inspection_id,i.status,i.occurrence_date,i.due_at,i.completed_at,
         i.started_at,i.period_label,i.template_name,i.category,
         (SELECT count(*)::integer FROM checklist_answers a
           WHERE a.inspection_id=i.id AND a.condition IS NOT NULL) answered_count,
         (SELECT count(*)::integer FROM checklist_answers a
           WHERE a.inspection_id=i.id) total_items,
         (SELECT count(*)::integer FROM checklist_answers a
           WHERE a.inspection_id=i.id AND a.condition IN (SELECT id FROM checklist_conditions WHERE is_issue)) issue_count,
         (SELECT count(*)::integer FROM checklist_follow_ups f
           WHERE f.inspection_id=i.id AND f.status NOT IN ('selesai','dibatalkan')) open_follow_ups
       FROM checklist_inspections i
       WHERE i.location_id=l.id AND i.owner_id=l.owner_id
       ORDER BY (i.status='selesai') DESC,i.occurrence_date DESC,i.due_at DESC,i.id DESC
       LIMIT 1
     ) li ON true
     WHERE l.owner_id=$1 AND l.active AND l.public_enabled
       ${scopeFilter}
     ORDER BY (li.occurrence_date IS NULL),li.occurrence_date DESC,l.name,l.id`;
}

async function getChecklistPublicInspection(
  ownerId: string,
  locationId: string,
  inspectionId: string,
) {
  const [row] = await query(
    `SELECT l.id,l.name,l.public_description,l.parent_id,p.name parent_name,
       i.id inspection_id,i.status,i.occurrence_date,i.due_at,i.completed_at,
       i.started_at,i.period_label,i.template_name,i.category,
       (SELECT count(*)::integer FROM checklist_answers a
         WHERE a.inspection_id=i.id AND a.condition IS NOT NULL) answered_count,
       (SELECT count(*)::integer FROM checklist_answers a
         WHERE a.inspection_id=i.id) total_items,
       (SELECT count(*)::integer FROM checklist_answers a
         WHERE a.inspection_id=i.id AND a.condition IN (SELECT id FROM checklist_conditions WHERE is_issue)) issue_count,
       (SELECT count(*)::integer FROM checklist_follow_ups f
         WHERE f.inspection_id=i.id AND f.status NOT IN ('selesai','dibatalkan')) open_follow_ups
     FROM checklist_inspections i
     JOIN checklist_locations l ON l.id=i.location_id AND l.owner_id=i.owner_id
     LEFT JOIN checklist_locations p ON p.id=l.parent_id
     WHERE i.owner_id=$1 AND i.location_id=$2 AND i.id=$3
       AND l.active AND l.public_enabled
     LIMIT 1`,
    [ownerId, locationId, inspectionId],
  );
  return row ?? null;
}

function mapPublicLocation(row: Record<string, unknown>): ChecklistPublicLocation {
  const hasInspection = Boolean(row.inspection_id);
  const latest: ChecklistPublicLatest | null = hasInspection
    ? {
        inspectionId: row.inspection_id as string,
        status: row.status as ChecklistPublicLatest["status"],
        occurrenceDate: toPlain(row.occurrence_date) as string,
        dueAt: toPlain(row.due_at) as string,
        completedAt: (toPlain(row.completed_at) as string | null) ?? null,
        periodLabel: row.period_label as string,
        templateName: row.template_name as string,
        category: row.category as string,
        answeredCount: Number(row.answered_count),
        totalItems: Number(row.total_items),
        issueCount: Number(row.issue_count),
        openFollowUps: Number(row.open_follow_ups),
      }
    : null;
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.public_description as string) ?? "",
    parentName: (row.parent_name as string | null) ?? null,
    latest,
  };
}

export async function listChecklistPublicLocations(
  ownerId: string,
  rootId?: string | null,
) {
  const scope = rootId ? await getChecklistLocationScope(ownerId, rootId) : null;
  const scoped = Boolean(scope && scope.length > 0);
  const rows = await query(
    publicLocationSelect(scoped ? `AND l.id=ANY($2::text[])` : scope ? `AND false` : ""),
    scoped ? [ownerId, scope] : [ownerId],
  );
  return rows.map(mapPublicLocation);
}

const TIMELINE_LABEL: Record<string, string> = {
  terbuka: "Tindak lanjut dibuka",
  diproses: "Tindak lanjut mulai diproses",
  tertunda: "Tindak lanjut ditunda",
  selesai: "Tindak lanjut selesai",
  dibatalkan: "Tindak lanjut dibatalkan",
};

export async function getChecklistPublicArea(
  ownerId: string,
  locationId: string,
  inspectionId?: string | null,
): Promise<ChecklistPublicArea | null> {
  const [row] = await query(
    publicLocationSelect(`AND l.id=$2`),
    [ownerId, locationId],
  );
  if (!row) return null;

  let displayRow = row;
  if (inspectionId && inspectionId !== row.inspection_id) {
    const selected = await getChecklistPublicInspection(
      ownerId,
      locationId,
      inspectionId,
    );
    if (!selected) return null;
    displayRow = selected;
  }
  const location = mapPublicLocation(displayRow);
  const displayedInspectionId =
    (displayRow.inspection_id as string | null) ?? null;

  const [itemRows, historyRows, followUpRow, eventRows] = await Promise.all([
    displayedInspectionId
      ? query(
          `SELECT a.prompt,a.group_path,a.condition,a.updated_at
           FROM checklist_answers a
           WHERE a.inspection_id=$1 AND a.public_visible
           ORDER BY a.position,a.id`,
          [displayedInspectionId],
        )
      : Promise.resolve([]),
    query(
      `SELECT id,occurrence_date,status,completed_at,period_label,template_name
       FROM checklist_inspections
       WHERE owner_id=$1 AND location_id=$2
       ORDER BY occurrence_date DESC,due_at DESC,id DESC
       LIMIT 24`,
      [ownerId, locationId],
    ),
    query(
      `SELECT count(*) FILTER (WHERE f.status NOT IN ('selesai','dibatalkan'))::integer open,
         count(*) FILTER (WHERE f.status='selesai')::integer done
       FROM checklist_follow_ups f
       JOIN checklist_inspections i ON i.id=f.inspection_id
       WHERE i.owner_id=$1 AND i.location_id=$2`,
      [ownerId, locationId],
    ),
    displayedInspectionId
      ? query(
          `SELECT e.created_at,e.status FROM checklist_follow_up_events e
           JOIN checklist_follow_ups f ON f.id=e.follow_up_id
           WHERE f.inspection_id=$1
           ORDER BY e.created_at DESC,e.id DESC
           LIMIT 20`,
          [displayedInspectionId],
        )
      : Promise.resolve([]),
  ]);

  const items: ChecklistPublicItem[] = itemRows.map((item) => ({
    prompt: item.prompt as string,
    groupPath: (item.group_path as string) ?? "",
    condition: (item.condition as ChecklistPublicItem["condition"]) ?? null,
    updatedAt: (toPlain(item.updated_at) as string | null) ?? null,
  }));

  const history: ChecklistPublicHistoryEntry[] = historyRows.map((item) => ({
    id: item.id as string,
    occurrenceDate: toPlain(item.occurrence_date) as string,
    status: item.status as ChecklistPublicHistoryEntry["status"],
    completedAt: (toPlain(item.completed_at) as string | null) ?? null,
    periodLabel: item.period_label as string,
    templateName: item.template_name as string,
  }));

  const timeline: ChecklistPublicTimelineEntry[] = [];
  if (displayedInspectionId) {
    if (displayRow.started_at) {
      timeline.push({
        at: toPlain(displayRow.started_at) as string,
        label: "Pemeriksaan dimulai",
      });
    }
    for (const event of eventRows) {
      timeline.push({
        at: toPlain(event.created_at) as string,
        label: TIMELINE_LABEL[event.status as string] ?? "Tindak lanjut diperbarui",
      });
    }
    if (location.latest?.completedAt) {
      timeline.push({
        at: location.latest.completedAt,
        label: "Pemeriksaan selesai",
      });
    }
  }
  timeline.sort((a, b) => b.at.localeCompare(a.at));

  const latestItemUpdate = items.reduce<string | null>(
    (latest, item) =>
      item.updatedAt && (!latest || item.updatedAt > latest)
        ? item.updatedAt
        : latest,
    null,
  );

  return {
    location,
    latest: location.latest,
    items,
    history,
    followUps: {
      open: Number(followUpRow[0]?.open ?? 0),
      done: Number(followUpRow[0]?.done ?? 0),
    },
    timeline: timeline.slice(0, 20),
    lastUpdated: latestItemUpdate,
    viewingHistory: displayRow !== row,
    staffTasks: [],
  };
}

export async function getChecklistPublicStaff(
  user: SessionUser | null,
  ownerId: string,
  locationId: string,
): Promise<{
  loggedIn: boolean;
  name: string | null;
  canFill: boolean;
  tasks: ChecklistPublicStaffTask[];
}> {
  if (!user) return { loggedIn: false, name: null, canFill: false, tasks: [] };
  const manager = user.role === "atasan";
  const rows = await query(
    `SELECT i.id,i.template_name,i.period_label,i.status,i.due_at,i.occurrence_date
     FROM checklist_inspections i
     WHERE i.owner_id=$1 AND i.location_id=$2
       AND i.status IN ('belum_dimulai','berlangsung')
       AND i.occurrence_date<=(now() AT TIME ZONE 'Asia/Jakarta')::date
       AND (($3::boolean AND i.owner_id=$4) OR EXISTS(
         SELECT 1 FROM checklist_inspection_assignees ia
         WHERE ia.inspection_id=i.id AND ia.employee_id=$4))
     ORDER BY i.due_at,i.id`,
    [ownerId, locationId, manager, user.id],
  );
  return {
    loggedIn: true,
    name: user.name,
    canFill: rows.length > 0,
    tasks: rows.map((row) => ({
      inspectionId: row.id as string,
      templateName: row.template_name as string,
      periodLabel: row.period_label as string,
      status: row.status as ChecklistPublicStaffTask["status"],
      dueAt: toPlain(row.due_at) as string,
      occurrenceDate: toPlain(row.occurrence_date) as string,
    })),
  };
}

export interface ChecklistQrInput {
  name: string;
  mode: ChecklistQrMode;
  locationId: string | null;
  active: boolean;
}

async function assertLocation(ownerId: string, locationId: string | null) {
  if (!locationId) return;
  const [row] = await query(
    `SELECT id FROM checklist_locations WHERE id=$1 AND owner_id=$2`,
    [locationId, ownerId],
  );
  if (!row) throw new Error("Lokasi tujuan tidak ditemukan.");
}

export async function createChecklistQr(
  user: Pick<SessionUser, "id" | "name">,
  input: ChecklistQrInput,
) {
  const id = `qr_${crypto.randomUUID()}`;
  const token = randomBytes(18).toString("base64url");
  const now = new Date().toISOString();
  await transaction(async (connection) => {
    await assertLocation(user.id, input.mode === "langsung" ? input.locationId : null);
    await query(
      `INSERT INTO checklist_qr_codes
        (id,owner_id,token,name,mode,location_id,active,created_by,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        user.id,
        token,
        input.name,
        input.mode,
        input.mode === "langsung" ? input.locationId : null,
        input.active,
        user.id,
        now,
        now,
      ],
      connection,
    );
    await insertChecklistAudit(connection, {
      actorId: user.id,
      actorName: user.name,
      action: "checklist.qr.create",
      objectType: "checklist",
      objectId: id,
      summary: `Membuat QR checklist "${input.name}".`,
      after: { name: input.name, mode: input.mode, locationId: input.locationId, active: input.active },
    });
  });
  return {
    id,
    ownerId: user.id,
    token,
    name: input.name,
    mode: input.mode,
    locationId: input.mode === "langsung" ? input.locationId : null,
    active: input.active,
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
  } satisfies ChecklistQrCode;
}

export async function updateChecklistQr(
  user: Pick<SessionUser, "id" | "name">,
  id: string,
  input: Partial<ChecklistQrInput>,
) {
  const updated = await transaction(async (connection) => {
    const [current] = await query(
      `SELECT * FROM checklist_qr_codes WHERE id=$1 AND owner_id=$2 FOR UPDATE`,
      [id, user.id],
      connection,
    );
    if (!current) throw new Error("QR tidak ditemukan.");
    const mode = (input.mode ?? current.mode) as ChecklistQrMode;
    const locationId =
      input.locationId === undefined
        ? (current.location_id as string | null)
        : input.locationId;
    if (mode === "langsung" && !locationId) {
      throw new Error("Pilih area tujuan untuk QR langsung.");
    }
    if (input.locationId !== undefined || input.mode !== undefined) {
      await assertLocation(user.id, mode === "langsung" ? locationId : null);
    }
    const nextLocation = mode === "langsung" ? locationId : null;
    const now = new Date().toISOString();
    await query(
      `UPDATE checklist_qr_codes SET name=$3,mode=$4,location_id=$5,active=$6,updated_at=$7
       WHERE id=$1 AND owner_id=$2`,
      [
        id,
        user.id,
        input.name ?? (current.name as string),
        mode,
        nextLocation,
        input.active ?? (current.active as boolean),
        now,
      ],
      connection,
    );
    await insertChecklistAudit(connection, {
      actorId: user.id,
      actorName: user.name,
      action: "checklist.qr.update",
      objectType: "checklist",
      objectId: id,
      summary: `Memperbarui QR checklist "${input.name ?? (current.name as string)}".`,
      before: {
        name: current.name,
        mode: current.mode,
        locationId: current.location_id,
        active: current.active,
      },
      after: {
        name: input.name ?? current.name,
        mode,
        locationId: nextLocation,
        active: input.active ?? current.active,
      },
    });
    return {
      id,
      ownerId: user.id,
      token: current.token as string,
      name: (input.name ?? current.name) as string,
      mode,
      locationId: nextLocation,
      active: (input.active ?? current.active) as boolean,
      createdBy: current.created_by as string,
      createdAt: toPlain(current.created_at) as string,
      updatedAt: now,
    } satisfies ChecklistQrCode;
  });
  return updated;
}
