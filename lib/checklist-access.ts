import "server-only";
import { query, type Connection } from "./db";
import { rowToCamel } from "./db-model";
import type { SessionUser } from "./types";
import type {
  ChecklistAnswer,
  ChecklistFollowUp,
  ChecklistInspection,
} from "./checklist-types";

export function isChecklistManager(user: SessionUser) {
  return user.role === "atasan";
}

export function checklistOwnerFor(user: SessionUser) {
  return user.role === "atasan" ? user.id : user.supervisorId;
}

export async function loadInspection(
  connection: Connection,
  id: string,
): Promise<ChecklistInspection | null> {
  const [row] = await query(`SELECT * FROM checklist_inspections WHERE id=$1`, [id], connection);
  return row ? (rowToCamel(row) as unknown as ChecklistInspection) : null;
}

export async function canAccessInspection(
  connection: Connection,
  user: SessionUser,
  inspection: Pick<ChecklistInspection, "id" | "ownerId">,
) {
  if (user.role === "atasan" && inspection.ownerId === user.id) return true;
  const [row] = await query(
    `SELECT 1 FROM checklist_inspection_assignees WHERE inspection_id=$1 AND employee_id=$2`,
    [inspection.id, user.id],
    connection,
  );
  return Boolean(row);
}

export async function loadAnswer(
  connection: Connection,
  id: string,
): Promise<(ChecklistAnswer & { ownerId: string; inspectionStatus: string }) | null> {
  const [row] = await query(
    `SELECT a.*,i.owner_id,i.status inspection_status
     FROM checklist_answers a JOIN checklist_inspections i ON i.id=a.inspection_id
     WHERE a.id=$1 FOR UPDATE OF a`,
    [id],
    connection,
  );
  if (!row) return null;
  const answer = rowToCamel(row) as unknown as ChecklistAnswer & {
    ownerId: string;
    inspectionStatus: string;
  };
  return answer;
}

export async function loadFollowUp(
  connection: Connection,
  id: string,
): Promise<(ChecklistFollowUp & { inspectionOwnerId: string }) | null> {
  const [row] = await query(
    `SELECT f.*,i.owner_id inspection_owner_id
     FROM checklist_follow_ups f JOIN checklist_inspections i ON i.id=f.inspection_id
     WHERE f.id=$1 FOR UPDATE OF f`,
    [id],
    connection,
  );
  if (!row) return null;
  return rowToCamel(row) as unknown as ChecklistFollowUp & {
    inspectionOwnerId: string;
  };
}

export async function canManageFollowUp(
  connection: Connection,
  user: SessionUser,
  followUp: Pick<ChecklistFollowUp, "id" | "picId" | "inspectionId" | "ownerId">,
) {
  if (followUp.picId === user.id) return true;
  if (user.role === "atasan" && followUp.ownerId === user.id) return true;
  const [row] = await query(
    `SELECT 1 FROM checklist_inspection_assignees WHERE inspection_id=$1 AND employee_id=$2`,
    [followUp.inspectionId, user.id],
    connection,
  );
  return Boolean(row);
}

export async function assertTeamMember(
  connection: Connection,
  ownerId: string,
  employeeId: string | null | undefined,
) {
  if (!employeeId) return null;
  const [row] = await query(
    `SELECT id,name FROM employees
     WHERE id=$1 AND supervisor_id=$2 AND active AND access_mode='full'`,
    [employeeId, ownerId],
    connection,
  );
  return row ? (row as { id: string; name: string }) : null;
}
