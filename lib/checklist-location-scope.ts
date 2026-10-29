import "server-only";

import {
  buildChecklistLocationOptions,
  type ChecklistLocationHierarchyNode,
  type ChecklistLocationOption,
} from "./checklist-location-path";
import { query } from "./db";

/**
 * Semua id lokasi dalam cakupan root, termasuk root itu sendiri.
 * `ownerId` null berarti lintas pemilik (dipakai super admin).
 */
export async function getChecklistLocationScope(
  ownerId: string | null,
  rootId?: string | null,
) {
  const rows = await query<{ id: string }>(
    `WITH RECURSIVE scope AS (
       SELECT id FROM checklist_locations
       WHERE ($2::text IS NULL OR id=$2)
         AND ($1::text IS NULL OR owner_id=$1)
       UNION ALL
       SELECT l.id FROM checklist_locations l JOIN scope s ON l.parent_id=s.id
       WHERE ($1::text IS NULL OR l.owner_id=$1)
     )
     SELECT id FROM scope`,
    [ownerId, rootId ?? null],
  );
  return rows.map((row) => row.id);
}

/**
 * Id lokasi untuk filter. Bila root tidak ditemukan, kembalikan root apa
 * adanya supaya filter tetap mempersempit ke lokasi yang dipilih.
 */
export async function getChecklistLocationScopeIds(
  ownerId: string | null,
  rootId: string,
) {
  const ids = await getChecklistLocationScope(ownerId, rootId);
  return ids.length > 0 ? ids : [rootId];
}

/** Peta id lokasi ke label path lengkap, termasuk lokasi nonaktif. */
export async function getChecklistLocationPathMap(ownerId: string | null) {
  const rows = await query<ChecklistLocationHierarchyNode>(
    `SELECT id,name,parent_id AS "parentId"
     FROM checklist_locations
     WHERE ($1::text IS NULL OR owner_id=$1)`,
    [ownerId],
  );
  return new Map(
    buildChecklistLocationOptions(rows).map((location) => [
      location.id,
      location.path,
    ]),
  );
}

/** Opsi lokasi aktif berurutan hierarkis untuk dropdown filter. */
export async function listChecklistLocationOptions(
  ownerId: string | null,
): Promise<ChecklistLocationOption[]> {
  const rows = await query<ChecklistLocationHierarchyNode>(
    `SELECT id,name,parent_id AS "parentId"
     FROM checklist_locations
     WHERE ($1::text IS NULL OR owner_id=$1) AND active
     ORDER BY name,id`,
    [ownerId],
  );
  return buildChecklistLocationOptions(rows);
}
