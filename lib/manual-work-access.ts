import "server-only";
import { query, type Connection } from "./db";
import { rowToCamel } from "./db-model";
import type { ManualWork } from "./manual-work-types";
import type { SessionUser } from "./types";

export async function loadManualWork(
  connection: Connection,
  id: string,
  lock = false,
): Promise<ManualWork | null> {
  const [row] = await query(
    `SELECT * FROM manual_works WHERE id=$1${lock ? " FOR UPDATE" : ""}`,
    [id],
    connection,
  );
  return row ? (rowToCamel(row) as unknown as ManualWork) : null;
}

export async function isManualWorkAssignee(
  connection: Connection,
  workId: string,
  employeeId: string,
) {
  const [row] = await query(
    `SELECT 1 FROM manual_work_assignees WHERE work_id=$1 AND employee_id=$2`,
    [workId, employeeId],
    connection,
  );
  return Boolean(row);
}

export async function canAccessManualWork(
  connection: Connection,
  user: SessionUser,
  work: Pick<ManualWork, "id" | "ownerId" | "createdBy">,
) {
  if (user.role === "atasan" && work.ownerId === user.id) return true;
  // Pelapor tetap dapat melihat laporan sendiri walau atasan sudah
  // menyesuaikan tim pelaksana.
  if (user.role === "pekerja" && work.createdBy === user.id) return true;
  return isManualWorkAssignee(connection, work.id, user.id);
}

/**
 * Atasan pemilik dan pelapor boleh mengelola pekerjaan. Pelapor hanya untuk
 * catatan yang ia buat sendiri; tautan tindak lanjut tetap milik atasan.
 */
export function canManageManualWork(
  user: SessionUser,
  work: Pick<ManualWork, "ownerId" | "createdBy">,
) {
  if (user.role === "atasan") return work.ownerId === user.id;
  if (user.role === "pekerja") return work.createdBy === user.id;
  return false;
}

/**
 * Pekerja hanya boleh melapor bila atasan penanggung jawabnya masih aktif.
 * Session bisa saja lebih lama dari perubahan data kepegawaian, jadi sumber
 * kebenaran tetap tabel employees.
 */
export async function assertManualWorkSupervisor(
  connection: Connection,
  employeeId: string,
) {
  const [row] = await query(
    `SELECT s.id,s.name
     FROM employees e
     JOIN employees s ON s.id=e.supervisor_id
     WHERE e.id=$1 AND e.role='pekerja' AND e.active
       AND s.role='atasan' AND s.active`,
    [employeeId],
    connection,
  );
  return row ? (row as { id: string; name: string }) : null;
}

export async function assertManualWorkAssignee(
  connection: Connection,
  ownerId: string,
  employeeId: string,
) {
  const [row] = await query(
    `SELECT id,name FROM employees
     WHERE id=$1 AND supervisor_id=$2 AND active AND access_mode='full'`,
    [employeeId, ownerId],
    connection,
  );
  return row ? (row as { id: string; name: string }) : null;
}
