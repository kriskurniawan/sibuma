import "server-only";

import { buildChecklistLocationOptions } from "./checklist-location-path";
import { query, type Connection } from "./db";
import type { ManualWorkLocationOption } from "./manual-work-types";

interface LocationRow {
  id: string;
  name: string;
  parent_id: string | null;
  active: boolean;
}

/**
 * Lokasi pekerjaan harian mengikuti lokasi checklist milik atasan pemilik.
 * Semua lokasi dimuat agar label path tetap lengkap walau salah satu induk
 * sudah nonaktif; form hanya menawarkan lokasi aktif.
 */
export async function listManualWorkLocations(
  ownerId: string,
): Promise<ManualWorkLocationOption[]> {
  const rows = await query<LocationRow>(
    `SELECT id,name,parent_id,active
     FROM checklist_locations
     WHERE owner_id=$1
     ORDER BY name,id`,
    [ownerId],
  );
  return buildChecklistLocationOptions(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      active: row.active,
    })),
  );
}

/**
 * Validasi lokasi milik atasan pemilik dan kembalikan snapshot path lengkap.
 * Lokasi nonaktif hanya boleh dipertahankan bila memang lokasi pekerjaan saat
 * ini, supaya edit rincian lain tidak memaksa memindahkan pekerjaan lama.
 */
export async function assertManualWorkLocation(
  connection: Connection,
  ownerId: string,
  locationId: string,
  currentLocationId?: string | null,
) {
  const rows = await query<{ id: string; name: string; active: boolean }>(
    `WITH RECURSIVE chain AS (
       SELECT id,name,parent_id,active,0 depth
       FROM checklist_locations
       WHERE id=$1 AND owner_id=$2
       UNION ALL
       SELECT l.id,l.name,l.parent_id,l.active,c.depth+1
       FROM checklist_locations l JOIN chain c ON l.id=c.parent_id
       WHERE l.owner_id=$2 AND c.depth<20
     )
     SELECT id,name,active FROM chain ORDER BY depth DESC`,
    [locationId, ownerId],
    connection,
  );
  const leaf = rows[rows.length - 1];
  if (
    !leaf ||
    leaf.id !== locationId ||
    (!leaf.active && leaf.id !== currentLocationId)
  ) {
    throw new Error(
      "Lokasi pekerjaan tidak tersedia. Pilih lokasi aktif dari daftar.",
    );
  }
  return {
    id: leaf.id,
    name: rows.map((row) => row.name).join(" / "),
  };
}
