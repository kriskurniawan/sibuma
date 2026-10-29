import "server-only";
import type { ChecklistConditionOption } from "./checklist-types";
import { query, type Connection } from "./db";

interface ConditionRow {
  id: string;
  label: string;
  tone: string;
  is_issue: boolean;
  requires_note: boolean;
  active: boolean;
  position: number;
}

function toCondition(row: ConditionRow): ChecklistConditionOption {
  return {
    id: row.id,
    label: row.label,
    tone: row.tone as ChecklistConditionOption["tone"],
    isIssue: row.is_issue,
    requiresNote: row.requires_note,
    active: row.active,
    position: Number(row.position),
  };
}

export async function listChecklistConditions({
  includeInactive = false,
  connection,
}: {
  includeInactive?: boolean;
  connection?: Connection;
} = {}): Promise<ChecklistConditionOption[]> {
  const rows = await query<ConditionRow>(
    `SELECT id,label,tone,is_issue,requires_note,active,position
     FROM checklist_conditions
     ${includeInactive ? "" : "WHERE active=true"}
     ORDER BY position,label,id`,
    [],
    connection,
  );
  return rows.map(toCondition);
}

export async function loadChecklistConditionMap(connection: Connection) {
  const conditions = await listChecklistConditions({
    includeInactive: true,
    connection,
  });
  return new Map(conditions.map((condition) => [condition.id, condition]));
}
