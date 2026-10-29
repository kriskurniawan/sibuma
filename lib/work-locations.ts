import "server-only";
import { query, type Connection } from "./db";
import type { WorkLocation } from "./types";

interface WorkLocationRow {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toWorkLocation(row: WorkLocationRow): WorkLocation {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? "",
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMeters: Number(row.radius_meters),
    active: row.active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const FIELDS =
  "id,name,address,latitude,longitude,radius_meters,active,created_by,updated_by,created_at,updated_at";

export async function listWorkLocations({
  includeInactive = false,
  connection,
}: {
  includeInactive?: boolean;
  connection?: Connection;
} = {}): Promise<WorkLocation[]> {
  const rows = await query<WorkLocationRow>(
    `SELECT ${FIELDS} FROM work_locations
     ${includeInactive ? "" : "WHERE active=true"}
     ORDER BY active DESC,lower(name),id`,
    [],
    connection,
  );
  return rows.map(toWorkLocation);
}

export async function listWorkLocationsByIds(
  ids: string[],
  connection?: Connection,
): Promise<WorkLocation[]> {
  if (ids.length === 0) return [];
  const rows = await query<WorkLocationRow>(
    `SELECT ${FIELDS} FROM work_locations WHERE id=ANY($1::text[])`,
    [ids],
    connection,
  );
  return rows.map(toWorkLocation);
}

export async function getWorkLocation(
  id: string,
  connection?: Connection,
): Promise<WorkLocation | null> {
  const [row] = await query<WorkLocationRow>(
    `SELECT ${FIELDS} FROM work_locations WHERE id=$1`,
    [id],
    connection,
  );
  return row ? toWorkLocation(row) : null;
}

/** Alamat snapshot SPKL: nama titik tetap terbaca meski alamat kosong. */
export function workLocationAddress(location: WorkLocation) {
  const address = location.address.trim();
  return address ? `${location.name} — ${address}` : location.name;
}
