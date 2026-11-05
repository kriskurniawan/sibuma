import "server-only";

import { insertChecklistAudit } from "./checklist-audit";
import {
  getChecklistLocationPathMap,
  listChecklistLocationOptions,
} from "./checklist-location-scope";
import type {
  ChecklistEquipment,
  ChecklistEquipmentActivity,
  ChecklistEquipmentDetail,
  ChecklistEquipmentInput,
  ChecklistEquipmentListItem,
  ChecklistEquipmentMaintenance,
  ChecklistEquipmentMaintenanceInput,
  ChecklistEquipmentMaintenanceUpdateInput,
  ChecklistEquipmentSetup,
  ChecklistEquipmentSummaryEntry,
  ChecklistEquipmentUpdateInput,
  ChecklistPublicEquipment,
  ChecklistPublicEquipmentDetail,
  ChecklistPublicEquipmentMaintenance,
  ChecklistPublicEquipmentSummaryEntry,
} from "./checklist-types";
import { equipmentComponentRank } from "./checklist-types";
import { query, transaction } from "./db";
import { rowToCamel } from "./db-model";
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

function mapEquipment(row: Record<string, unknown>): ChecklistEquipment {
  return mapRow<ChecklistEquipment>(row);
}

/**
 * `date` dipetakan pg menjadi objek Date, lalu bergeser satu hari saat
 * diubah ke ISO. Selalu ambil sebagai teks `YYYY-MM-DD`.
 */
const MAINTENANCE_COLUMNS = `m.id,m.equipment_id,m.owner_id,m.activity,
  m.component,m.quantity,m.unit,m.hour_meter,
  m.performed_date::text performed_date,m.performed_by,m.description,
  m.public_visible,m.created_by,m.created_at,m.updated_at`;

function mapMaintenance(
  row: Record<string, unknown>,
): ChecklistEquipmentMaintenance {
  return {
    id: row.id as string,
    equipmentId: row.equipment_id as string,
    ownerId: row.owner_id as string,
    activity: row.activity as ChecklistEquipmentActivity,
    component: row.component as string,
    quantity: row.quantity == null ? null : Number(row.quantity),
    unit: (row.unit as string) ?? "",
    hourMeter: row.hour_meter == null ? null : Number(row.hour_meter),
    performedDate: toPlain(row.performed_date) as string,
    performedBy: (row.performed_by as string | null) ?? null,
    performedByName: (row.performed_by_name as string | null) ?? null,
    description: (row.description as string) ?? "",
    publicVisible: Boolean(row.public_visible),
    createdBy: row.created_by as string,
    createdAt: toPlain(row.created_at) as string,
    updatedAt: toPlain(row.updated_at) as string,
  };
}

function mapPublicMaintenance(
  row: Record<string, unknown>,
): ChecklistPublicEquipmentMaintenance {
  return {
    id: row.id as string,
    activity: row.activity as ChecklistEquipmentActivity,
    component: row.component as string,
    quantity: row.quantity == null ? null : Number(row.quantity),
    unit: (row.unit as string) ?? "",
    hourMeter: row.hour_meter == null ? null : Number(row.hour_meter),
    performedDate: toPlain(row.performed_date) as string,
    description: (row.description as string) ?? "",
  };
}

function mapPublicSummary(
  row: Record<string, unknown>,
): ChecklistPublicEquipmentSummaryEntry {
  return {
    component: row.component as string,
    activity: row.activity as ChecklistEquipmentActivity,
    performedDate: toPlain(row.performed_date) as string,
    quantity: row.quantity == null ? null : Number(row.quantity),
    unit: (row.unit as string) ?? "",
    hourMeter: row.hour_meter == null ? null : Number(row.hour_meter),
  };
}

function objectArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object",
      )
    : [];
}

function sortSummary<T extends ChecklistEquipmentSummaryEntry>(entries: T[]) {
  return entries.sort(
    (left, right) =>
      equipmentComponentRank(left.component) -
        equipmentComponentRank(right.component) ||
      left.component.localeCompare(right.component, "id"),
  );
}

/**
 * Catatan terakhir per komponen. Input harus terurut dari yang terbaru agar
 * kemunculan pertama setiap komponen adalah perawatan terakhirnya.
 */
export function summarizeEquipmentMaintenance<
  T extends Pick<
    ChecklistEquipmentSummaryEntry,
    | "component"
    | "activity"
    | "performedDate"
    | "quantity"
    | "unit"
    | "hourMeter"
  >,
>(maintenance: T[]): ChecklistEquipmentSummaryEntry[] {
  const seen = new Set<string>();
  const summary: ChecklistEquipmentSummaryEntry[] = [];
  for (const item of maintenance) {
    const key = item.component.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    summary.push({
      component: item.component,
      activity: item.activity,
      performedDate: item.performedDate,
      quantity: item.quantity,
      unit: item.unit,
      hourMeter: item.hourMeter,
    });
  }
  return sortSummary(summary);
}

function mapEquipmentListItem(
  row: Record<string, unknown>,
  pathMap: Map<string, string>,
): ChecklistEquipmentListItem {
  const equipment = mapEquipment(row);
  const locationName = (row.location_name as string) ?? "";
  return {
    ...equipment,
    locationName,
    locationPath: pathMap.get(equipment.locationId) ?? locationName,
    locationPublicEnabled: Boolean(row.location_public_enabled),
    maintenanceCount: Number(row.maintenance_count ?? 0),
    lastMaintenance: row.last_maintenance
      ? mapMaintenance(row.last_maintenance as Record<string, unknown>)
      : null,
  };
}

export async function getChecklistEquipmentSetup(
  ownerId: string | null,
): Promise<ChecklistEquipmentSetup> {
  const [rows, locations, pathMap] = await Promise.all([
    query(
      `SELECT e.*,l.name location_name,l.public_enabled location_public_enabled,
         (SELECT count(*)::integer FROM checklist_equipment_maintenance m
           WHERE m.equipment_id=e.id) maintenance_count,
         (SELECT row_to_json(x) FROM (
            SELECT ${MAINTENANCE_COLUMNS} FROM checklist_equipment_maintenance m
            WHERE m.equipment_id=e.id
            ORDER BY m.performed_date DESC,m.created_at DESC,m.id DESC
            LIMIT 1
          ) x) last_maintenance
       FROM checklist_equipment e
       JOIN checklist_locations l ON l.id=e.location_id
       WHERE ($1::text IS NULL OR e.owner_id=$1)
       ORDER BY l.name,e.active DESC,e.name,e.id`,
      [ownerId],
    ),
    listChecklistLocationOptions(ownerId),
    getChecklistLocationPathMap(ownerId),
  ]);

  return {
    equipment: rows.map((row) => mapEquipmentListItem(row, pathMap)),
    locations,
  };
}

export async function getChecklistEquipmentDetail(
  ownerId: string | null,
  equipmentId: string,
): Promise<ChecklistEquipmentDetail | null> {
  const [row] = await query(
    `SELECT e.*,l.name location_name,l.public_enabled location_public_enabled,
       (SELECT count(*)::integer FROM checklist_equipment_maintenance m
         WHERE m.equipment_id=e.id) maintenance_count
     FROM checklist_equipment e
     JOIN checklist_locations l ON l.id=e.location_id
     WHERE e.id=$1 AND ($2::text IS NULL OR e.owner_id=$2)
     LIMIT 1`,
    [equipmentId, ownerId],
  );
  if (!row) return null;

  const [maintenanceRows, locations, pathMap] = await Promise.all([
    query(
      `SELECT ${MAINTENANCE_COLUMNS},emp.name performed_by_name
       FROM checklist_equipment_maintenance m
       LEFT JOIN employees emp ON emp.id=m.performed_by
       WHERE m.equipment_id=$1
       ORDER BY m.performed_date DESC,m.created_at DESC,m.id DESC
       LIMIT 500`,
      [equipmentId],
    ),
    listChecklistLocationOptions(ownerId),
    getChecklistLocationPathMap(ownerId),
  ]);
  const maintenance = maintenanceRows.map(mapMaintenance);
  const equipment = mapEquipmentListItem(row, pathMap);

  return {
    equipment: {
      ...equipment,
      lastMaintenance: maintenance[0] ?? null,
    },
    locations,
    maintenance,
    summary: summarizeEquipmentMaintenance(maintenance),
  };
}

export async function createChecklistEquipment(
  user: SessionUser,
  input: ChecklistEquipmentInput,
) {
  return transaction(async (connection) => {
    const [location] = await query(
      `SELECT id FROM checklist_locations
       WHERE id=$1 AND owner_id=$2 AND active`,
      [input.locationId, user.id],
      connection,
    );
    if (!location) {
      throw new Error("Lokasi peralatan tidak ditemukan atau sudah nonaktif.");
    }

    const id = `eq_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await query(
      `INSERT INTO checklist_equipment
        (id,owner_id,location_id,code,name,category,public_enabled,active,
         created_by,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9,$10)`,
      [
        id,
        user.id,
        input.locationId,
        input.code,
        input.name,
        input.category,
        input.publicEnabled,
        user.id,
        now,
        now,
      ],
      connection,
    );
    await insertChecklistAudit(connection, {
      actorId: user.id,
      actorName: user.name,
      action: "checklist.equipment.create",
      objectType: "checklist",
      objectId: id,
      summary: `${user.name} menambahkan peralatan ${input.name} (${input.code}).`,
      after: input,
    });
    return {
      id,
      ownerId: user.id,
      locationId: input.locationId,
      code: input.code,
      name: input.name,
      category: input.category,
      publicEnabled: input.publicEnabled,
      active: true,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    } satisfies ChecklistEquipment;
  });
}

export async function updateChecklistEquipment(
  user: SessionUser,
  equipmentId: string,
  input: ChecklistEquipmentUpdateInput,
) {
  return transaction(async (connection) => {
    const [current] = await query(
      `SELECT * FROM checklist_equipment
       WHERE id=$1 AND owner_id=$2 FOR UPDATE`,
      [equipmentId, user.id],
      connection,
    );
    if (!current) throw new Error("Peralatan tidak ditemukan.");

    const locationId =
      input.locationId ?? (current.location_id as string);
    if (
      input.locationId !== undefined &&
      input.locationId !== (current.location_id as string)
    ) {
      const [location] = await query(
        `SELECT id FROM checklist_locations
         WHERE id=$1 AND owner_id=$2 AND active`,
        [input.locationId, user.id],
        connection,
      );
      if (!location) {
        throw new Error("Lokasi peralatan tidak ditemukan atau sudah nonaktif.");
      }
    }

    const next = {
      locationId,
      code: input.code ?? (current.code as string),
      name: input.name ?? (current.name as string),
      category: input.category ?? (current.category as string),
      publicEnabled:
        input.publicEnabled ?? (current.public_enabled as boolean),
      active: input.active ?? (current.active as boolean),
    };
    const now = new Date().toISOString();
    await query(
      `UPDATE checklist_equipment
       SET location_id=$3,code=$4,name=$5,category=$6,public_enabled=$7,
           active=$8,updated_at=$9
       WHERE id=$1 AND owner_id=$2`,
      [
        equipmentId,
        user.id,
        next.locationId,
        next.code,
        next.name,
        next.category,
        next.publicEnabled,
        next.active,
        now,
      ],
      connection,
    );
    await insertChecklistAudit(connection, {
      actorId: user.id,
      actorName: user.name,
      action: "checklist.equipment.update",
      objectType: "checklist",
      objectId: equipmentId,
      summary: `${user.name} memperbarui peralatan ${next.name} (${next.code}).`,
      before: {
        locationId: current.location_id,
        code: current.code,
        name: current.name,
        category: current.category,
        publicEnabled: current.public_enabled,
        active: current.active,
      },
      after: next,
    });
    return {
      id: equipmentId,
      ownerId: user.id,
      ...next,
      createdBy: current.created_by as string,
      createdAt: toPlain(current.created_at) as string,
      updatedAt: now,
    } satisfies ChecklistEquipment;
  });
}

export async function createChecklistEquipmentMaintenance(
  user: SessionUser,
  equipmentId: string,
  input: ChecklistEquipmentMaintenanceInput,
) {
  return transaction(async (connection) => {
    const [equipment] = await query(
      `SELECT id,name FROM checklist_equipment
       WHERE id=$1 AND owner_id=$2 FOR UPDATE`,
      [equipmentId, user.id],
      connection,
    );
    if (!equipment) throw new Error("Peralatan tidak ditemukan.");

    const id = `eqm_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await query(
      `INSERT INTO checklist_equipment_maintenance
        (id,equipment_id,owner_id,activity,component,quantity,unit,hour_meter,
         performed_date,performed_by,description,public_visible,
         created_by,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id,
        equipmentId,
        user.id,
        input.activity,
        input.component,
        input.quantity,
        input.unit,
        input.hourMeter,
        input.performedDate,
        user.id,
        input.description,
        input.publicVisible,
        user.id,
        now,
        now,
      ],
      connection,
    );
    await insertChecklistAudit(connection, {
      actorId: user.id,
      actorName: user.name,
      action: "checklist.equipment.maintenance.create",
      objectType: "checklist",
      objectId: id,
      summary: `${user.name} mencatat ${input.activity} ${input.component} untuk ${equipment.name}.`,
      after: { equipmentId, ...input },
    });
    return {
      id,
      equipmentId,
      ownerId: user.id,
      activity: input.activity,
      component: input.component,
      quantity: input.quantity,
      unit: input.unit,
      hourMeter: input.hourMeter,
      performedDate: input.performedDate,
      performedBy: user.id,
      performedByName: user.name,
      description: input.description,
      publicVisible: input.publicVisible,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    } satisfies ChecklistEquipmentMaintenance;
  });
}

export async function updateChecklistEquipmentMaintenance(
  user: SessionUser,
  equipmentId: string,
  maintenanceId: string,
  input: ChecklistEquipmentMaintenanceUpdateInput,
) {
  return transaction(async (connection) => {
    const [currentRow] = await query(
      `SELECT ${MAINTENANCE_COLUMNS},emp.name performed_by_name
       FROM checklist_equipment_maintenance m
       JOIN checklist_equipment e ON e.id=m.equipment_id
       LEFT JOIN employees emp ON emp.id=m.performed_by
       WHERE m.id=$1 AND m.equipment_id=$2 AND e.owner_id=$3
       FOR UPDATE OF m`,
      [maintenanceId, equipmentId, user.id],
      connection,
    );
    if (!currentRow) throw new Error("Catatan perawatan tidak ditemukan.");
    const current = mapMaintenance(currentRow);

    const next = {
      activity: input.activity ?? current.activity,
      component: input.component ?? current.component,
      quantity:
        input.quantity === undefined ? current.quantity : input.quantity,
      unit: input.unit ?? current.unit,
      hourMeter:
        input.hourMeter === undefined ? current.hourMeter : input.hourMeter,
      performedDate: input.performedDate ?? current.performedDate,
      description: input.description ?? current.description,
      publicVisible: input.publicVisible ?? current.publicVisible,
    };
    const now = new Date().toISOString();
    await query(
      `UPDATE checklist_equipment_maintenance
       SET activity=$3,component=$4,quantity=$5,unit=$6,hour_meter=$7,
           performed_date=$8,description=$9,public_visible=$10,updated_at=$11
       WHERE id=$1 AND equipment_id=$2`,
      [
        maintenanceId,
        equipmentId,
        next.activity,
        next.component,
        next.quantity,
        next.unit,
        next.hourMeter,
        next.performedDate,
        next.description,
        next.publicVisible,
        now,
      ],
      connection,
    );
    await insertChecklistAudit(connection, {
      actorId: user.id,
      actorName: user.name,
      action: "checklist.equipment.maintenance.update",
      objectType: "checklist",
      objectId: maintenanceId,
      summary: `${user.name} memperbarui riwayat ${next.activity} ${next.component}.`,
      before: current,
      after: next,
    });
    return {
      ...current,
      ...next,
      updatedAt: now,
    } satisfies ChecklistEquipmentMaintenance;
  });
}

/**
 * Riwayat publik hanya memuat catatan yang ditandai publik pada peralatan dan
 * area yang sama-sama dipublikasikan. Identitas petugas tidak pernah dipilih.
 */
export async function listChecklistPublicEquipment(
  ownerId: string | null,
  locationId: string,
): Promise<ChecklistPublicEquipment[]> {
  const rows = await query(
    `SELECT e.id,e.code,e.name,e.category,
       coalesce(mc.total,0)::integer maintenance_count,
       coalesce(latest.entries,'[]'::json) latest_entries,
       coalesce(summary.entries,'[]'::json) summary_entries
     FROM checklist_equipment e
     JOIN checklist_locations l ON l.id=e.location_id AND l.owner_id=e.owner_id
     LEFT JOIN LATERAL (
       SELECT count(*)::integer total
       FROM checklist_equipment_maintenance m
       WHERE m.equipment_id=e.id AND m.public_visible
     ) mc ON true
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'id',m.id,
         'activity',m.activity,
         'component',m.component,
         'quantity',m.quantity,
         'unit',m.unit,
         'hour_meter',m.hour_meter,
         'performed_date',m.performed_date::text,
         'description',m.description
       ) ORDER BY m.performed_date DESC,m.created_at DESC,m.id DESC) entries
       FROM (
         SELECT * FROM checklist_equipment_maintenance m
         WHERE m.equipment_id=e.id AND m.public_visible
         ORDER BY m.performed_date DESC,m.created_at DESC,m.id DESC
         LIMIT 6
       ) m
     ) latest ON true
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'component',s.component,
         'activity',s.activity,
         'quantity',s.quantity,
         'unit',s.unit,
         'hour_meter',s.hour_meter,
         'performed_date',s.performed_date::text
       ) ORDER BY lower(s.component)) entries
       FROM (
         SELECT DISTINCT ON (lower(m.component))
           m.component,m.activity,m.quantity,m.unit,m.hour_meter,
           m.performed_date,m.id,m.created_at
         FROM checklist_equipment_maintenance m
         WHERE m.equipment_id=e.id AND m.public_visible
         ORDER BY lower(m.component),m.performed_date DESC,
                  m.created_at DESC,m.id DESC
       ) s
     ) summary ON true
     WHERE ($1::text IS NULL OR e.owner_id=$1) AND e.location_id=$2
       AND e.active AND e.public_enabled
       AND l.active AND l.public_enabled
     ORDER BY e.name,e.id`,
    [ownerId, locationId],
  );

  return rows.map((row) => {
    const history = objectArray(row.latest_entries).map(mapPublicMaintenance);
    const summary = sortSummary(
      objectArray(row.summary_entries).map(mapPublicSummary),
    );
    return {
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      category: (row.category as string) ?? "",
      maintenanceCount: Number(row.maintenance_count ?? 0),
      lastMaintenance: history[0] ?? null,
      history,
      summary,
    } satisfies ChecklistPublicEquipment;
  });
}

export async function getChecklistPublicEquipmentDetail(
  ownerId: string | null,
  locationId: string,
  equipmentId: string,
): Promise<ChecklistPublicEquipmentDetail | null> {
  const [row] = await query(
    `SELECT e.id,e.code,e.name,e.category,l.name location_name
     FROM checklist_equipment e
     JOIN checklist_locations l ON l.id=e.location_id AND l.owner_id=e.owner_id
     WHERE ($1::text IS NULL OR e.owner_id=$1)
       AND e.location_id=$2 AND e.id=$3
       AND e.active AND e.public_enabled
       AND l.active AND l.public_enabled
     LIMIT 1`,
    [ownerId, locationId, equipmentId],
  );
  if (!row) return null;

  const maintenanceRows = await query(
    `SELECT m.id,m.activity,m.component,m.quantity,m.unit,m.hour_meter,
            m.performed_date::text performed_date,m.description
     FROM checklist_equipment_maintenance m
     WHERE m.equipment_id=$1 AND m.public_visible
     ORDER BY m.performed_date DESC,m.created_at DESC,m.id DESC
     LIMIT 200`,
    [equipmentId],
  );
  const maintenance = maintenanceRows.map(mapPublicMaintenance);

  return {
    equipment: {
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      category: (row.category as string) ?? "",
      locationName: row.location_name as string,
    },
    maintenance,
    summary: summarizeEquipmentMaintenance(maintenance),
  };
}
