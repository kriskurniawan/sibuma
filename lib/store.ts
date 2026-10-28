import "server-only";
import { query, insert, transaction } from "./db";
import { createSeedData } from "./seed";
import type { AuditLog, Database } from "./types";
export { mutateDb } from "./unit-of-work";

export function pushAudit(db: Database, input: Omit<AuditLog, "id" | "createdAt" | "before" | "after"> & { before?: unknown; after?: unknown }) {
  db.auditLogs.push({ ...input, id: crypto.randomUUID(), before: input.before ?? null, after: input.after ?? null, createdAt: new Date().toISOString() });
}

/** Explicit destructive demo operation only; never called by migrations/tests. */
export async function resetDb() {
  if (process.env.DEMO_MODE === "false") throw new Error("Reset data hanya tersedia dalam mode demo.");
  const seeded = createSeedData();
  const { assertObjectsExist, deleteObject } = await import("./storage");
  await assertObjectsExist(seeded.documentations.map((doc) => doc.storageKey));
  const oldKeys = await transaction(async (connection) => {
    // Exclude concurrent runtime writes during the explicit reset.
    await query("LOCK TABLE employees,divisions,spkls,spkl_workers,attendances,documentations,policies,otp_records,notification_logs,audit_logs IN ACCESS EXCLUSIVE MODE", [], connection);
    const keys = await query<{ storage_key: string }>("SELECT DISTINCT storage_key FROM documentations", [], connection);
    await query("TRUNCATE documentations,attendances,spkl_workers,spkls,otp_records,notification_logs,audit_logs,policies,employees,divisions", [], connection);
    for (const employee of seeded.employees) await insert("employees", employee, connection);
    for (const division of seeded.divisions) await insert("divisions", division, connection);
    await insert("policy", seeded.policy, connection);
    for (const spkl of seeded.spkls) await insert("spkls", spkl, connection);
    for (const assignment of seeded.spklWorkers) await insert("spklWorkers", assignment, connection);
    for (const attendance of seeded.attendances) await insert("attendances", attendance, connection);
    for (const doc of seeded.documentations) await insert("documentations", doc, connection);
    for (const log of seeded.auditLogs) await insert("auditLogs", log, connection);
    for (const log of seeded.notifications) await insert("notifications", log, connection);
    await query("SELECT setval('spkl_number_sequence',$1,false)", [seeded.meta.nextSpklSequence], connection);
    return keys.map((row) => row.storage_key);
  });
  const preserved = new Set(seeded.documentations.map((doc) => doc.storageKey));
  for (const key of oldKeys.filter((key) => !preserved.has(key))) await deleteObject(key, "s3").catch((error) => console.error("Gagal membersihkan unggahan demo:", error));
  return seeded;
}
