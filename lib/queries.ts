import "server-only";

import { addDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "./constants";
import { getPolicyRow, query, select } from "./db";
import { getTeamLoad, getTeamTotals } from "./team-queries";
export { getTeamOverview, getTeamTotals } from "./team-queries";
export { getReportData, type ReportFilters } from "./report-queries";
import { finalizeScope, hydrateSpkls, overviewData, overviewMetrics, effectiveMinutesSql } from "./relational-reads";
import {
  attendanceMinutes,
  isCheckInOpen,
  spklStatus,
  todayLocal,
  toLocalDateInput,
} from "./time";
import type {
  AuditLog,
  Database,
  Documentation,
  Division,
  Employee,
  EmployeeAttendanceView,
  Policy,
  ReportRow,
  SessionUser,
  Spkl,
  SpklDetail,
  SpklListItem,
  SpklStatus,
} from "./types";

export interface WorkerOverview {
  items: SpklListItem[];
  activeItem: SpklListItem | null;
  nextItem: SpklListItem | null;
  stats: {
    monthlyMinutes: number;
    monthlySessions: number;
    completedSessions: number;
    documentationCount: number;
  };
  recentDocuments: Array<Documentation & { employee: Employee; spkl: Spkl }>;
  monthlyTargetMinutes: number;
}

export interface SupervisorSpotlight {
  spkl: Spkl;
  status: SpklStatus;
  workers: EmployeeAttendanceView[];
  documentationCount: number;
  checkedIn: number;
  expected: number;
}

export interface SupervisorOverview {
  items: SpklListItem[];
  activeSpkls: SupervisorSpotlight[];
  upcoming: SpklListItem[];
  stats: {
    activeSpklCount: number;
    activeWorkers: number;
    monthlyMinutes: number;
    weeklyMinutes: number;
    docsToday: number;
    docsYesterday: number;
    teamCount: number;
    needsAttention: number;
  };
  weekly: Array<{ date: string; label: string; minutes: number; today: boolean }>;
  recentDocuments: Array<Documentation & { employee: Employee; spkl: Spkl }>;
  teamLoad: Array<{
    employee: Employee;
    minutes: number;
    sessions: number;
    documentationCount: number;
  }>;
}

function employeeMap(db: Database) {
  return new Map(db.employees.map((employee) => [employee.id, employee]));
}

function docsForSpkl(db: Database, spklId: string) {
  return db.documentations.filter((doc) => doc.spklId === spklId);
}

function buildListItem(
  db: Database,
  spkl: Spkl,
  currentUserId: string,
): SpklListItem {
  const workers = db.spklWorkers
    .filter((item) => item.spklId === spkl.id)
    .map((item) => db.employees.find((employee) => employee.id === item.employeeId))
    .filter((employee): employee is Employee => Boolean(employee));

  const attendance = db.attendances.find(
    (item) =>
      item.spklId === spkl.id && item.employeeId === currentUserId,
  );
  const assigned = db.spklWorkers.some(
    (item) =>
      item.spklId === spkl.id && item.employeeId === currentUserId,
  );
  const creator =
    db.employees.find((employee) => employee.id === spkl.createdBy) ?? null;
  const division =
    db.divisions.find((item) => item.id === spkl.divisionId) ?? null;

  return {
    spkl,
    status: spklStatus(spkl),
    myAttendance: attendance ?? null,
    canCheckIn: assigned && !attendance && isCheckInOpen(spkl),
    workerCount: workers.length,
    documentationCount: docsForSpkl(db, spkl.id).length,
    creator,
    division,
    workers,
  };
}

function visibleSpklsForWorker(db: Database, employeeId: string) {
  const ids = new Set(
    db.spklWorkers
      .filter((worker) => worker.employeeId === employeeId)
      .map((worker) => worker.spklId),
  );
  return db.spkls.filter((spkl) => ids.has(spkl.id));
}

function ownSpkls(db: Database, supervisorId: string) {
  return db.spkls.filter((spkl) => spkl.createdBy === supervisorId);
}

function sortForWorker(items: SpklListItem[]) {
  const rank: Record<SpklStatus, number> = {
    berlangsung: 0,
    terjadwal: 1,
    selesai: 2,
    dibatalkan: 3,
  };
  return items.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) {
      return rank[a.status] - rank[b.status];
    }
    if (a.status === "terjadwal") {
      return (
        new Date(a.spkl.startAt).getTime() - new Date(b.spkl.startAt).getTime()
      );
    }
    return (
      new Date(b.spkl.startAt).getTime() - new Date(a.spkl.startAt).getTime()
    );
  });
}

function sortOwned(items: SpklListItem[]) {
  const rank: Record<SpklStatus, number> = {
    berlangsung: 0,
    terjadwal: 1,
    selesai: 2,
    dibatalkan: 3,
  };
  return items.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) {
      return rank[a.status] - rank[b.status];
    }
    return (
      new Date(b.spkl.startAt).getTime() - new Date(a.spkl.startAt).getTime()
    );
  });
}

export async function getWorkerOverview(user: SessionUser): Promise<WorkerOverview> {
  const db = await overviewData(user);
  const metrics = await overviewMetrics(user);
  const items = sortForWorker(
    visibleSpklsForWorker(db, user.id).map((spkl) =>
      buildListItem(db, spkl, user.id),
    ),
  );

  const activeItem =
    items.find(
      (item) =>
        item.status === "berlangsung" ||
        item.myAttendance?.status === "berjalan",
    ) ?? null;
  const nextItem =
    items
      .filter((item) => item.status === "terjadwal")
      .sort(
        (a, b) =>
          new Date(a.spkl.startAt).getTime() -
          new Date(b.spkl.startAt).getTime(),
      )[0] ?? null;

  return {
    items,
    activeItem,
    nextItem,
    stats: {
      monthlyMinutes: metrics.stats.monthly_minutes,
      monthlySessions: metrics.stats.monthly_sessions,
      completedSessions: metrics.stats.completed_sessions,
      documentationCount: metrics.documents.monthly,
    },
    recentDocuments: metrics.recent,
    monthlyTargetMinutes: 20 * 60,
  };
}

function calculateWeekly(
  metrics: Array<{ date: string; minutes: number }>,
): SupervisorOverview["weekly"] {
  const today = todayLocal();
  const result: SupervisorOverview["weekly"] = [];

  for (let offset = -6; offset <= 0; offset += 1) {
    const day = formatInTimeZone(
      addDays(new Date(`${today}T12:00:00`), offset),
      APP_TIMEZONE,
      "yyyy-MM-dd",
    );
    result.push({
      date: day,
      label: formatInTimeZone(
        new Date(`${day}T12:00:00`),
        APP_TIMEZONE,
        "EEEE",
        { locale: localeId },
      ),
      minutes: Number(metrics.find((row) => row.date === day)?.minutes ?? 0),
      today: day === today,
    });
  }
  return result;
}

export async function getSupervisorOverview(
  user: SessionUser,
): Promise<SupervisorOverview> {
  const db = await overviewData(user);
  const [metrics, teamLoad, teamTotals] = await Promise.all([overviewMetrics(user), getTeamLoad(user.id), getTeamTotals(user.id)]);
  const map = employeeMap(db);
  const owned = ownSpkls(db, user.id);
  const items = sortOwned(
    owned.map((spkl) => buildListItem(db, spkl, user.id)),
  );
  const runningSpklIds = new Set(
    db.attendances
      .filter((attendance) => attendance.status === "berjalan")
      .map((attendance) => attendance.spklId),
  );

  const activeSpkls: SupervisorSpotlight[] = owned
    .filter(
      (spkl) =>
        spklStatus(spkl) === "berlangsung" || runningSpklIds.has(spkl.id),
    )
    .map((spkl) => {
      const workerRows = db.spklWorkers
        .filter((item) => item.spklId === spkl.id)
        .map((assignment) => {
          const employee = map.get(assignment.employeeId);
          if (!employee) return null;
          return {
            employee,
            attendance:
              db.attendances.find(
                (item) =>
                  item.spklId === spkl.id &&
                  item.employeeId === assignment.employeeId,
              ) ?? null,
          };
        })
        .filter((item): item is EmployeeAttendanceView => Boolean(item));

      return {
        spkl,
        status: spklStatus(spkl),
        workers: workerRows,
        documentationCount: docsForSpkl(db, spkl.id).length,
        checkedIn: workerRows.filter(
          (item) => item.attendance?.status === "berjalan",
        ).length,
        expected: workerRows.length,
      };
    });

  const weekly = calculateWeekly(metrics.weekly);
  const weeklyMinutes = weekly.reduce((sum, day) => sum + day.minutes, 0);

  return {
    items,
    activeSpkls,
    upcoming: items.filter((item) => item.status === "terjadwal").slice(0, 4),
    stats: {
      activeSpklCount: Number(metrics.activity.spkls),
      activeWorkers: Number(metrics.activity.workers),
      monthlyMinutes: metrics.stats.monthly_minutes,
      weeklyMinutes,
      docsToday: metrics.documents.today,
      docsYesterday: metrics.documents.yesterday,
      teamCount: teamTotals.active,
      needsAttention: Number(metrics.activity.needs_attention),
    },
    weekly,
    recentDocuments: metrics.recent,
    teamLoad,
  };
}

export async function getSpklDetail(
  spklId: string,
  user: SessionUser,
): Promise<SpklDetail | null> {
  const [spkl] =
    user.role === "super_admin"
      ? await select("spkls", "id=$1", [spklId])
      : await select("spkls", "id=$1 AND (created_by=$2 OR EXISTS(SELECT 1 FROM spkl_workers w WHERE w.spkl_id=spkls.id AND w.employee_id=$2))", [spklId,user.id]);
  if (!spkl) return null;
  await finalizeScope("s.id=$1",[spkl.id]);
  const db=await hydrateSpkls([spkl]);

  const assigned = db.spklWorkers.some(
    (item) => item.spklId === spkl.id && item.employeeId === user.id,
  );
  const isCreator = user.role === "atasan" && spkl.createdBy === user.id;
  if (user.role !== "super_admin" && !assigned && !isCreator) return null;

  const base = buildListItem(db, spkl, user.id);
  const map = employeeMap(db);

  const attendances: EmployeeAttendanceView[] = db.spklWorkers
    .filter((worker) => worker.spklId === spkl.id)
    .map((worker) => {
      const employee = map.get(worker.employeeId);
      if (!employee) return null;
      return {
        employee,
        attendance:
          db.attendances.find(
            (item) =>
              item.spklId === spkl.id &&
              item.employeeId === worker.employeeId,
          ) ?? null,
      };
    })
    .filter((item): item is EmployeeAttendanceView => Boolean(item))
    .sort((a, b) => a.employee.name.localeCompare(b.employee.name, "id"));

  const status = spklStatus(spkl);
  const now = new Date();
  const docs = docsForSpkl(db, spkl.id)
    .map((doc) => ({
      ...doc,
      employee: map.get(doc.employeeId) ?? null,
    }))
    .sort(
      (a, b) =>
        new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
    );

  const myAttendance =
    db.attendances.find(
      (item) => item.spklId === spkl.id && item.employeeId === user.id,
    ) ?? null;
  const graceEnd = new Date(
    new Date(spkl.endAt).getTime() + db.policy.docGraceMinutes * 60_000,
  );
  const myDocCount = myAttendance
    ? db.documentations.filter(
        (doc) => doc.attendanceId === myAttendance.id,
      ).length
    : 0;

  return {
    ...base,
    attendances,
    documentation: docs,
    canManage: isCreator && user.accessMode !== "read_only",
    canCheckIn:
      user.role === "pekerja" &&
      assigned &&
      !myAttendance &&
      isCheckInOpen(spkl, now),
    canCheckOut:
      user.role === "pekerja" &&
      myAttendance?.status === "berjalan",
    canUpload:
      user.role === "pekerja" &&
      Boolean(myAttendance?.checkInAt) &&
      myAttendance?.status !== "tidak_hadir" &&
      now.getTime() <= graceEnd.getTime() &&
      myDocCount < 12,
    isAssigned: assigned,
    myAttendance,
    status,
  } satisfies SpklDetail;
}

export async function getTeam(userId: string) {
 return select("employees", "supervisor_id=$1", [userId], undefined, "ORDER BY name,id");
}

export async function getDivisions(userId: string): Promise<Division[]> {
 return select("divisions", "supervisor_id=$1", [userId], undefined, "ORDER BY active DESC,name,id");
}

export async function getPolicy(): Promise<Policy> { return getPolicyRow(); }

/**
 * Audit rows are scoped to the supervisor's own team and owned records.
 * A supervisor must never receive another supervisor's audit payload.
 */
export async function getAuditLogs(userId: string, limit = 80): Promise<AuditLog[]> { const safeLimit = Math.max(1, Math.min(limit, 500));
 return select(
  "auditLogs",
  `(actor_id=$1
    OR actor_id IN (SELECT id FROM employees WHERE supervisor_id=$1)
    OR (object_type='spkl' AND object_id IN (SELECT id FROM spkls WHERE created_by=$1))
    OR (object_type='checklist' AND object_id IN (SELECT id FROM checklist_inspections WHERE owner_id=$1)))`,
  [userId],
  undefined,
  `ORDER BY created_at DESC,id DESC LIMIT ${safeLimit}`,
 );
}

/** Organization-wide audit trail; only call after a super-admin guard. */
export async function getAllAuditLogs(limit = 80): Promise<AuditLog[]> {
 const safeLimit = Math.max(1, Math.min(limit, 500));
 return select(
  "auditLogs",
  "true",
  [],
  undefined,
  `ORDER BY created_at DESC,id DESC LIMIT ${safeLimit}`,
 );
}

export async function getAssignmentSchedules(userId: string) {
 const rows=await query(`SELECT w.employee_id,w.spkl_id,s.title,s.start_at,s.end_at,s.canceled_at FROM spkl_workers w JOIN spkls s ON s.id=w.spkl_id
 WHERE s.created_by=$1 AND s.end_at>=date_trunc('week',now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta' - interval '7 days'`,[userId]);
 return rows.map(row=>({employeeId:row.employee_id,spklId:row.spkl_id,title:row.title,startAt:row.start_at.toISOString(),endAt:row.end_at.toISOString(),canceled:Boolean(row.canceled_at)}));
}

export async function getReportOptions(supervisorId: string | null) {
 if (!supervisorId) {
  return {
   employees: await select("employees", "role='pekerja' AND active", [], undefined, "ORDER BY name,id"),
   spkls: await select("spkls", "true", [], undefined, "ORDER BY date DESC,id LIMIT 60"),
  };
 }
 const [employees,spkls]=await Promise.all([
 select("employees","supervisor_id=$1",[supervisorId],undefined,"ORDER BY name,id"),
 select("spkls","created_by=$1",[supervisorId],undefined,"ORDER BY date DESC,id LIMIT 60")]);
 return {employees,spkls};
}

/** Notification rows are scoped to the supervisor and their own team. */
export async function getNotifications(userId: string, limit = 30) {
 const safeLimit = Math.max(1, Math.min(limit, 500));
 return select(
  "notifications",
  `(recipient_id=$1 OR recipient_id IN (SELECT id FROM employees WHERE supervisor_id=$1))`,
  [userId],
  undefined,
  `ORDER BY created_at DESC,id DESC LIMIT ${safeLimit}`,
 );
}

export function toDateInput(iso: string) {
  return toLocalDateInput(iso);
}

export function reportDuration(row: ReportRow) {
  if (
    row.attendance.status === "tidak_hadir" ||
    !row.attendance.checkInAt
  ) {
    return 0;
  }
  return attendanceMinutes({
    checkInAt: row.attendance.checkInAt,
    checkOutAt: row.attendance.checkOutAt,
    spklStartAt: row.spkl.startAt,
    spklEndAt: row.spkl.endAt,
  });
}
