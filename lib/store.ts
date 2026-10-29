import "server-only";
import type { AuditLog, Database } from "./types";
export { mutateDb } from "./unit-of-work";

export function pushAudit(db: Database, input: Omit<AuditLog, "id" | "createdAt" | "before" | "after"> & { before?: unknown; after?: unknown }) {
  db.auditLogs.push({ ...input, id: crypto.randomUUID(), before: input.before ?? null, after: input.after ?? null, createdAt: new Date().toISOString() });
}
