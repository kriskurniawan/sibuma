import type { Database, Division } from "./types";

export const SCHEMA_VERSION = 3;
export const DEFAULT_DIVISION_NAME = "Umum";

/**
 * Menambahkan struktur divisi ke database lama tanpa menghapus data.
 * Pekerja dan SPKL yang belum punya divisi ditempatkan ke divisi default
 * milik atasannya masing-masing.
 */
export function migrateDatabase(db: Database, now = new Date()): boolean {
  let changed = false;
  const nowIso = now.toISOString();

  if (!Array.isArray(db.divisions)) {
    db.divisions = [];
    changed = true;
  }

  if (!Array.isArray(db.documentations)) {
    db.documentations = [];
    changed = true;
  }

  for (const documentation of db.documentations) {
    if (
      documentation.storageProvider !== "local" &&
      documentation.storageProvider !== "s3"
    ) {
      documentation.storageProvider = "local";
      changed = true;
    }
  }

  for (const division of db.divisions) {
    if (typeof division.active !== "boolean") {
      division.active = true;
      changed = true;
    }
    if (typeof division.description !== "string") {
      division.description = "";
      changed = true;
    }
  }

  const supervisorIds = new Set<string>();
  for (const employee of db.employees) {
    if (employee.role === "atasan") supervisorIds.add(employee.id);
    if (employee.supervisorId) supervisorIds.add(employee.supervisorId);
  }
  for (const spkl of db.spkls) {
    if (spkl.createdBy) supervisorIds.add(spkl.createdBy);
  }

  const fallbackBySupervisor = new Map<string, Division>();
  for (const supervisorId of supervisorIds) {
    const owned = db.divisions.filter(
      (division) => division.supervisorId === supervisorId,
    );
    if (owned.length === 0) {
      const created: Division = {
        id: `div_umum_${supervisorId}`,
        name: DEFAULT_DIVISION_NAME,
        description: "Divisi default untuk pekerja dan SPKL lama.",
        supervisorId,
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.divisions.push(created);
      fallbackBySupervisor.set(supervisorId, created);
      changed = true;
      continue;
    }
    fallbackBySupervisor.set(
      supervisorId,
      owned.find(
        (division) =>
          division.name.toLowerCase() === DEFAULT_DIVISION_NAME.toLowerCase(),
      ) ??
        owned.find((division) => division.active) ??
        owned[0],
    );
  }

  for (const employee of db.employees) {
    if (employee.role === "atasan") continue;
    const current = db.divisions.find(
      (division) => division.id === employee.divisionId,
    );
    const valid =
      current && current.supervisorId === employee.supervisorId
        ? current
        : null;
    if (valid) continue;

    const fallback = employee.supervisorId
      ? fallbackBySupervisor.get(employee.supervisorId)
      : null;
    if (fallback) {
      employee.divisionId = fallback.id;
      changed = true;
    }
  }

  for (const spkl of db.spkls) {
    const current = db.divisions.find(
      (division) => division.id === spkl.divisionId,
    );
    const valid =
      current && current.supervisorId === spkl.createdBy ? current : null;
    if (valid) continue;

    const fallback = fallbackBySupervisor.get(spkl.createdBy);
    if (fallback) {
      spkl.divisionId = fallback.id;
      changed = true;
    }
  }

  if (db.schemaVersion !== SCHEMA_VERSION) {
    db.schemaVersion = SCHEMA_VERSION;
    changed = true;
  }

  return changed;
}
