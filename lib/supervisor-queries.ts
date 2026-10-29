import "server-only";
import { query } from "./db";
import { decode } from "./db-model";
import type { Employee } from "./types";

export interface SupervisorRow {
  employee: Employee;
  teamCount: number;
  activeTeamCount: number;
  divisionCount: number;
}

export interface OrganizationOverview {
  supervisors: number;
  activeSupervisors: number;
  workers: number;
  activeWorkers: number;
  divisions: number;
  activeDivisions: number;
  runningSpkls: number;
  todaySpkls: number;
  openChecklists: number;
  overdueChecklists: number;
  openFollowUps: number;
}

const OPEN_INSPECTIONS = `('belum_dimulai','berlangsung')`;
const OPEN_FOLLOW_UPS = `('terbuka','diproses','tertunda')`;

export async function getSupervisors(): Promise<SupervisorRow[]> {
  const rows = await query(
    `SELECT e.*,
       (SELECT count(*) FROM employees w WHERE w.supervisor_id=e.id)::integer team_count,
       (SELECT count(*) FROM employees w WHERE w.supervisor_id=e.id AND w.active)::integer active_team_count,
       (SELECT count(*) FROM divisions d WHERE d.supervisor_id=e.id)::integer division_count
     FROM employees e
     WHERE e.role='atasan'
     ORDER BY e.active DESC, e.name, e.id`,
  );
  return rows.map((row) => ({
    employee: decode("employees", row),
    teamCount: Number(row.team_count),
    activeTeamCount: Number(row.active_team_count),
    divisionCount: Number(row.division_count),
  }));
}

export async function getOrganizationOverview(): Promise<OrganizationOverview> {
  const [row] = await query<Record<string, number>>(
    `SELECT
       (SELECT count(*) FROM employees WHERE role='atasan')::integer supervisors,
       (SELECT count(*) FROM employees WHERE role='atasan' AND active)::integer active_supervisors,
       (SELECT count(*) FROM employees WHERE role='pekerja')::integer workers,
       (SELECT count(*) FROM employees WHERE role='pekerja' AND active)::integer active_workers,
       (SELECT count(*) FROM divisions)::integer divisions,
       (SELECT count(*) FROM divisions WHERE active)::integer active_divisions,
       (SELECT count(*) FROM spkls WHERE canceled_at IS NULL AND start_at<=now() AND end_at>=now())::integer running_spkls,
       (SELECT count(*) FROM spkls WHERE canceled_at IS NULL
         AND date=(now() AT TIME ZONE 'Asia/Jakarta')::date)::integer today_spkls,
       (SELECT count(*) FROM checklist_inspections WHERE status IN ${OPEN_INSPECTIONS})::integer open_checklists,
       (SELECT count(*) FROM checklist_inspections WHERE status IN ${OPEN_INSPECTIONS} AND due_at<now())::integer overdue_checklists,
       (SELECT count(*) FROM checklist_follow_ups WHERE status IN ${OPEN_FOLLOW_UPS})::integer open_follow_ups`,
  );
  return {
    supervisors: Number(row.supervisors),
    activeSupervisors: Number(row.active_supervisors),
    workers: Number(row.workers),
    activeWorkers: Number(row.active_workers),
    divisions: Number(row.divisions),
    activeDivisions: Number(row.active_divisions),
    runningSpkls: Number(row.running_spkls),
    todaySpkls: Number(row.today_spkls),
    openChecklists: Number(row.open_checklists),
    overdueChecklists: Number(row.overdue_checklists),
    openFollowUps: Number(row.open_follow_ups),
  };
}
