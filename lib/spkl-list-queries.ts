import "server-only";

import { cache } from "react";
import { readOwnerId } from "./access";
import { currentOvertimePeriodLabel } from "./active-overtime-period";
import { query } from "./db";
import { effectiveMinutesSql, overviewData } from "./relational-reads";
import { sqlOvertimePeriod } from "./sql-overtime-period";
import { isCheckInOpen, spklStatus } from "./time";
import type {
  DashboardStats,
  Database,
  SessionUser,
  Spkl,
  SpklListItem,
  SpklStatus,
} from "./types";

export interface WorkerHistorySummary {
  stats: DashboardStats;
  periodLabel: string;
}

// Both route regions receive the same SessionUser instance. React's request cache
// shares overviewData's finalization + hydration promise, so no second region
// repeats finalization or reads metrics before those writes have completed.
const listDatabase = cache((user: SessionUser) => overviewData(user));

function listItem(db: Database, spkl: Spkl, userId: string): SpklListItem {
  const workerIds = new Set(
    db.spklWorkers
      .filter((assignment) => assignment.spklId === spkl.id)
      .map((assignment) => assignment.employeeId),
  );
  const workers = db.employees.filter((employee) => workerIds.has(employee.id));
  const myAttendance =
    db.attendances.find(
      (attendance) => attendance.spklId === spkl.id && attendance.employeeId === userId,
    ) ?? null;
  const divisionIds = new Set(workers.map((worker) => worker.divisionId));

  return {
    spkl,
    status: spklStatus(spkl),
    myAttendance,
    canCheckIn: workerIds.has(userId) && !myAttendance && isCheckInOpen(spkl),
    workerCount: workers.length,
    documentationCount: db.documentations.filter(
      (document) => document.spklId === spkl.id && (document.kind ?? "photo") === "photo",
    ).length,
    creator: db.employees.find((employee) => employee.id === spkl.createdBy) ?? null,
    division: db.divisions.find((division) => division.id === spkl.divisionId) ?? null,
    divisions: db.divisions
      .filter((division) => divisionIds.has(division.id))
      .sort((a, b) => a.name.localeCompare(b.name, "id")),
    workers,
  };
}

/** A list-only read: no dashboard metrics, team load, or team totals. */
export const getSpklListItems = cache(async (user: SessionUser): Promise<SpklListItem[]> => {
  const db = await listDatabase(user);
  const owner = readOwnerId(user);
  const assignedIds = new Set(
    db.spklWorkers
      .filter((assignment) => assignment.employeeId === user.id)
      .map((assignment) => assignment.spklId),
  );
  const visible = db.spkls.filter((spkl) =>
    user.role === "pekerja"
      ? assignedIds.has(spkl.id)
      : owner === null || spkl.createdBy === owner,
  );
  const rank: Record<SpklStatus, number> = {
    berlangsung: 0,
    terjadwal: 1,
    selesai: 2,
    dibatalkan: 3,
  };

  return visible
    .map((spkl) => listItem(db, spkl, user.id))
    .sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return new Date(b.spkl.startAt).getTime() - new Date(a.spkl.startAt).getTime();
    });
});

/** Preserve overview summary semantics without its unrelated dashboard reads. */
export const getWorkerHistorySummary = cache(
  async (user: SessionUser): Promise<WorkerHistorySummary> => {
    await listDatabase(user);
    const period = sqlOvertimePeriod();
    const visible = "EXISTS(SELECT 1 FROM spkl_workers w WHERE w.spkl_id=s.id AND w.employee_id=$1)";
    const [statsRows, documentRows] = await Promise.all([
      query<{
        monthly_minutes: number;
        monthly_sessions: number;
        completed_sessions: number;
      }>(`SELECT
        coalesce(sum(${effectiveMinutesSql}) FILTER (WHERE s.date>=${period.fromSql} AND s.date<=${period.toSql}),0)::integer monthly_minutes,
        count(*) FILTER(WHERE a.check_in_at IS NOT NULL AND s.date>=${period.fromSql} AND s.date<=${period.toSql})::integer monthly_sessions,
        count(*) FILTER(WHERE (a.status IN ('selesai','dikoreksi') OR (a.status='ditutup_otomatis' AND a.check_out_at IS NOT NULL)) AND s.date>=${period.fromSql} AND s.date<=${period.toSql})::integer completed_sessions
        FROM attendances a JOIN spkls s ON s.id=a.spkl_id WHERE ${visible} AND a.employee_id=$1`, [user.id]),
      query<{ monthly: number }>(`SELECT
        count(*) FILTER(WHERE s.date>=${period.fromSql} AND s.date<=${period.toSql})::integer monthly
        FROM documentations d JOIN spkls s ON s.id=d.spkl_id WHERE ${visible} AND d.kind='photo'`, [user.id]),
    ]);
    const stats = statsRows[0];

    return {
      stats: {
        monthlyMinutes: Number(stats.monthly_minutes),
        monthlySessions: Number(stats.monthly_sessions),
        completedSessions: Number(stats.completed_sessions),
        documentationCount: Number(documentRows[0].monthly),
      },
      periodLabel: currentOvertimePeriodLabel(),
    };
  },
);
