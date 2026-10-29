import "server-only";
import { query, type Connection } from "./db";
import type { ManualWorkStatus } from "./manual-work-types";

export async function insertManualWorkEvent(
  connection: Connection,
  input: {
    workId: string;
    actorId: string;
    actorName: string;
    action: string;
    status: ManualWorkStatus;
    note?: string;
  },
) {
  await query(
    `INSERT INTO manual_work_events
      (id,work_id,actor_id,actor_name,action,status,note,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      `mwe_${crypto.randomUUID()}`,
      input.workId,
      input.actorId,
      input.actorName,
      input.action,
      input.status,
      input.note?.trim() ?? "",
      new Date().toISOString(),
    ],
    connection,
  );
}
