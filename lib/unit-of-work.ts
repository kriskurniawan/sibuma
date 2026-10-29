import "server-only";
import { getPolicyRow, insert, query, select, transaction, update, type Connection } from "./db";
import { models, snake, type Model } from "./db-model";
import type { Database } from "./types";
import { finalizeExpired } from "./attendance-finalization";
import { listWorkLocationsByIds } from "./work-locations";

export type MutationScope =
  | { kind: "spkl"; id?: string; workerIds?: string[]; divisionId?: string; sequence?: boolean; startAt?: string; workLocationId?: string }
  | { kind: "attendance"; id: string }
  | { kind: "employee"; id?: string; supervisorId: string; phone?: string | null; email?: string; nik?: string }
  | { kind: "division"; supervisorId: string }
  | { kind: "otp"; identifier?: string; id?: string; employeeId?: string }
  | { kind: "login"; id: string }
  | { kind: "policy" }
  | { kind: "notification" };

export async function emptyData(connection: Connection): Promise<Database> {
  return { schemaVersion: 4, seededAt: "", meta: { nextSpklSequence: 0 }, policy: await getPolicyRow(connection), employees: [], divisions: [], spkls: [], spklWorkers: [], attendances: [], documentations: [], workLocations: [], otps: [], notifications: [], auditLogs: [] };
}
async function loadScope(scope: MutationScope, connection: Connection) {
  const db = await emptyData(connection);
  if (scope.kind === "spkl" || scope.kind === "attendance") {
    let id = scope.id;
    if (scope.kind === "attendance") {
      const [attendance] = await select("attendances", "id=$1", [id], connection);
      id = attendance?.spklId;
    }
    db.spkls = id ? await select("spkls", "id=$1", [id], connection, "FOR UPDATE") : [];
    const workerIds = scope.kind === "spkl" ? scope.workerIds ?? [] : [];
    if (workerIds.length) {
      // Schedule warnings need only the selected workers' schedules, not all SPKLs.
      const schedules = await select("spkls", "id IN (SELECT spkl_id FROM spkl_workers WHERE employee_id=ANY($1::text[])) AND end_at >= (date_trunc('week',$2::timestamptz AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta') - interval '1 day' AND start_at < (date_trunc('week',$2::timestamptz AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta') + interval '8 days'", [workerIds, scope.kind === "spkl" ? scope.startAt ?? new Date().toISOString() : new Date().toISOString()], connection);
      const map = new Map([...schedules, ...db.spkls].map((row) => [row.id, row]));
      db.spkls = [...map.values()];
    }
    const ids = db.spkls.map((row) => row.id);
    db.spklWorkers = await select("spklWorkers", "spkl_id=ANY($1::text[])", [ids], connection);
    db.attendances = await select("attendances", "spkl_id=$1", [id ?? ""], connection, "FOR UPDATE");
    db.documentations = await select("documentations", "spkl_id=$1", [id ?? ""], connection);
    const requestedLocationId = scope.kind === "spkl" ? scope.workLocationId : undefined;
    const locationIds = [...new Set([requestedLocationId, ...db.spkls.map((row) => row.workLocationId)].filter((value): value is string => Boolean(value)))];
    db.workLocations = await listWorkLocationsByIds(locationIds, connection);
    db.employees = await select("employees", "id=ANY($1::text[])", [[...new Set([...workerIds, ...db.spklWorkers.map((row) => row.employeeId)])]], connection);
    const divisionId = scope.kind === "spkl" ? scope.divisionId : undefined;
    db.divisions = await select("divisions", "id=ANY($1::text[])", [[...new Set([divisionId, ...db.spkls.map((row) => row.divisionId)].filter(Boolean))]], connection);
    if (scope.kind === "spkl" && scope.sequence) {
      const [row] = await query("SELECT nextval('spkl_number_sequence')::integer AS value", [], connection);
      db.meta.nextSpklSequence = row.value;
    }
  } else if (scope.kind === "employee") {
    // Unique constraints additionally protect contacts/NIK against concurrent inserts.
    db.employees = await select("employees", "id=$1 OR phone=$2 OR lower(nik)=lower($3) OR lower(email)=lower($4)", [scope.id ?? "", scope.phone ?? "", scope.nik ?? "", scope.email ?? ""], connection, "FOR UPDATE");
    db.divisions = await select("divisions", "supervisor_id=$1", [scope.supervisorId], connection);
    db.otps = await select("otps", "employee_id=$1", [scope.id ?? ""], connection, "ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE");
    db.spklWorkers = await select("spklWorkers", "employee_id=$1 AND spkl_id IN (SELECT id FROM spkls WHERE end_at>now() AND canceled_at IS NULL)", [scope.id ?? ""], connection);
    db.spkls = await select("spkls", "id=ANY($1::text[])", [db.spklWorkers.map((row) => row.spklId)], connection);
  } else if (scope.kind === "division") {
    db.divisions = await select("divisions", "supervisor_id=$1", [scope.supervisorId], connection, "FOR UPDATE");
    // Existence probe per division: do not load every worker to disable a division.
    const rows = await query("SELECT DISTINCT ON (division_id) * FROM employees WHERE division_id IN (SELECT id FROM divisions WHERE supervisor_id=$1)", [scope.supervisorId], connection);
    const { decode } = await import("./db-model");
    db.employees = rows.map((row) => decode("employees", row));
  } else if (scope.kind === "otp") {
    const [employee] = scope.employeeId
      ? await select("employees", "id=$1", [scope.employeeId], connection)
      : scope.identifier
        ? await select("employees", "phone=$1 OR lower(email)=$1", [scope.identifier], connection)
        : [];
    if (employee) {
      // Both identifiers share the employee row lock and one latest challenge.
      // Contact edits acquire this same row, preventing stale-contact verification.
      db.employees = await select("employees", "id=$1", [employee.id], connection, "FOR UPDATE");
      if (employee.supervisorId) db.employees.push(...await select("employees", "id=$1", [employee.supervisorId], connection));
      await query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`otp:employee:${employee.id}`], connection);
      db.otps = await select("otps", "employee_id=$1", [employee.id], connection, "ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE");
    }
  } else if (scope.kind === "login") {
    db.employees = await select("employees", "id=$1 OR id=(SELECT supervisor_id FROM employees WHERE id=$1)", [scope.id], connection);
  } else if (scope.kind === "policy") {
    db.policy = (await select("policy", "id='policy'", [], connection, "FOR UPDATE"))[0];
  }
  return db;
}
const collections = Object.keys(models).filter((name) => name !== "policy") as Exclude<Model, "policy">[];
const identity = (model: Model, row: unknown) => models[model].keys.map((key) => (row as Record<string, unknown>)[key]).join("/");
export async function persistChanges(before: Database, after: Database, connection: Connection) {
  // Delete children first, insert parents first; all changes share one transaction.
  for (const model of [...collections].reverse()) {
    const remaining = new Set(after[model].map((row) => identity(model, row)));
    for (const row of before[model]) if (!remaining.has(identity(model, row))) {
      const keys: readonly string[] = models[model].keys;
      await query(`DELETE FROM ${models[model].table} WHERE ${keys.map((key, i) => `${snake(key)}=$${i + 1}`).join(" AND ")}`, keys.map((key) => (row as unknown as Record<string, unknown>)[key]), connection);
    }
  }
  for (const model of collections) {
    const original = new Map(before[model].map((row) => [identity(model, row), row]));
    for (const row of after[model]) {
      const previous = original.get(identity(model, row));
      if (!previous) await insert(model, row, connection);
      else if (JSON.stringify(previous) !== JSON.stringify(row)) await update(model, row, connection);
    }
  }
  if (JSON.stringify(before.policy) !== JSON.stringify(after.policy)) await update("policy", after.policy, connection);
}
export async function mutateDb<T>(scope: MutationScope, operation: (db: Database) => T | Promise<T>): Promise<T> {
  return transaction(async (connection) => {
    const db = await loadScope(scope, connection);
    const before = structuredClone(db);
    // Finalize only the requested SPKL, not the worker's other warning schedules.
    if (scope.kind === "attendance" || (scope.kind === "spkl" && scope.id)) {
      const targetId = scope.kind === "spkl" ? scope.id : db.attendances.find((row) => row.id === scope.id)?.spklId;
      finalizeExpired(db, targetId);
    }
    const result = await operation(db);
    await persistChanges(before, db, connection);
    return result;
  });
}
