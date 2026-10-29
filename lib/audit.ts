import "server-only";
import { query, type Connection } from "./db";
import type { AuditLog } from "./types";

export async function insertAudit(
  connection: Connection,
  input: {
    actorId: string;
    actorName: string;
    action: string;
    objectType: AuditLog["objectType"];
    objectId: string;
    summary: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await query(
    `INSERT INTO audit_logs (id,actor_id,actor_name,action,object_type,object_id,summary,"before","after",created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)`,
    [
      `audit_${crypto.randomUUID()}`,
      input.actorId,
      input.actorName,
      input.action,
      input.objectType,
      input.objectId,
      input.summary,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
      new Date().toISOString(),
    ],
    connection,
  );
}
