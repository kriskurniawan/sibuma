import "server-only";
import { isObserver } from "./access";
import { CHECKOUT_GRACE_MINUTES } from "./constants";
import { decode } from "./db-model";
import { getPolicyRow, query, select, transaction, type Connection } from "./db";
import { sqlOvertimePeriod } from "./sql-overtime-period";
import { sqlTimeZone } from "./sql-time-zone";
import { emptyData, persistChanges } from "./unit-of-work";
import { finalizeExpired } from "./attendance-finalization";
import { overtimePayableMinutes } from "./time";
import type { Database, SessionUser, Spkl } from "./types";

/** Finalize a bounded relevant set with locks; repeat calls are idempotent. */
export async function finalizeScope(where: string, values: unknown[], limit = 100) {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const pending = await query(`SELECT s.id FROM spkls s WHERE ${where} AND s.canceled_at IS NULL AND s.end_at<now()
    AND (EXISTS(SELECT 1 FROM attendances a WHERE a.spkl_id=s.id AND a.status='berjalan'
        AND s.end_at + (${CHECKOUT_GRACE_MINUTES} * interval '1 minute') < now())
      OR EXISTS(SELECT 1 FROM spkl_workers w WHERE w.spkl_id=s.id AND NOT EXISTS(SELECT 1 FROM attendances a WHERE a.spkl_id=w.spkl_id AND a.employee_id=w.employee_id)))
    ORDER BY s.end_at LIMIT $${values.length + 1}`, [...values, safeLimit]);
  for (const row of pending) await transaction(async (connection) => {
    const db = await emptyData(connection);
    db.spkls = await select("spkls", "id=$1", [row.id], connection, "FOR UPDATE");
    db.spklWorkers = await select("spklWorkers", "spkl_id=$1", [row.id], connection);
    db.attendances = await select("attendances", "spkl_id=$1", [row.id], connection, "FOR UPDATE");
    const before = structuredClone(db);
    finalizeExpired(db, row.id);
    await persistChanges(before, db, connection);
  });
  return { processed: pending.length };
}

export async function hydrateSpkls(spkls: Spkl[], connection?: Connection): Promise<Database> {
  const ids = spkls.map((row) => row.id);
  const [spklWorkers, attendances, documentations, policy] = await Promise.all([
    select("spklWorkers", "spkl_id=ANY($1::text[])", [ids], connection),
    select("attendances", "spkl_id=ANY($1::text[])", [ids], connection),
    select("documentations", "spkl_id=ANY($1::text[])", [ids], connection),
    getPolicyRow(connection),
  ]);
  const employeeIds = [...new Set([...spklWorkers.map((row) => row.employeeId), ...spkls.map((row) => row.createdBy)])];
  const employees = await select("employees", "id=ANY($1::text[])", [employeeIds], connection);
  const divisionIds = [...new Set([...spkls.map((row) => row.divisionId), ...employees.map((row) => row.divisionId)].filter((id): id is string => Boolean(id)))];
  const divisions = await select("divisions", "id=ANY($1::text[])", [divisionIds], connection);
  const spklById = new Map(spkls.map((row) => [row.id, row]));
  const payableAttendances = attendances.map((attendance) => {
    const spkl = spklById.get(attendance.spklId);
    if (!spkl || !attendance.checkOutAt) return attendance;
    return {
      ...attendance,
      durationMinutes: overtimePayableMinutes({
        checkInAt: attendance.checkInAt,
        checkOutAt: attendance.checkOutAt,
        status: attendance.status,
        storedMinutes: attendance.durationMinutes,
        spklStartAt: spkl.startAt,
        spklEndAt: spkl.endAt,
        spklDate: spkl.date,
        spklCanceledAt: spkl.canceledAt,
        piketStartAt: attendance.piketStartAt,
        policy,
      }),
    };
  });
  return { schemaVersion: 4, seededAt: "", meta: { nextSpklSequence: 0 }, spkls, spklWorkers, attendances: payableAttendances, documentations, workLocations: [], policy, divisions, employees, otps: [], notifications: [], auditLogs: [] };
}

export async function overviewData(user: SessionUser) {
  const all = isObserver(user);
  const visible = all
    ? "TRUE"
    : user.role === "atasan"
      ? "s.created_by=$1"
      : "EXISTS(SELECT 1 FROM spkl_workers w WHERE w.spkl_id=s.id AND w.employee_id=$1)";
  const values = all ? [] : [user.id];
  await finalizeScope(visible, values);
  // Current month + future schedules + a bounded history, never all application state.
  const rows = await query(`SELECT s.* FROM spkls s WHERE ${visible}
    ORDER BY (s.canceled_at IS NULL AND s.end_at>=now()) DESC,
    CASE WHEN s.end_at>=now() THEN s.start_at END ASC, s.date DESC,s.id LIMIT 200`, values);
  return hydrateSpkls(rows.map((row) => decode("spkls", row)));
}

// Jam yang diperhitungkan mengikuti kebijakan pembulatan aktif. Waktu aktual
// tetap disimpan pada attendance; fungsi SQL memakai jadwal SPKL dan tanggal
// SPKL agar bulan sebelum kebijakan berlaku tidak berubah.
export const effectiveMinutesSql = `overtime_payable_minutes(
  a.duration_minutes,a.status,a.check_in_at,a.check_out_at,a.piket_start_at,
  s.start_at,s.end_at,s.date,s.canceled_at,now()
)`;

export async function overviewMetrics(user: SessionUser) {
  const all = isObserver(user);
  const owner = all
    ? "TRUE"
    : user.role === "atasan"
      ? "s.created_by=$1"
      : "EXISTS(SELECT 1 FROM spkl_workers w WHERE w.spkl_id=s.id AND w.employee_id=$1)";
  const employee = user.role === "pekerja" ? "AND a.employee_id=$1" : "";
  const values = all ? [] : [user.id];
  const period = sqlOvertimePeriod();
  const [stats] = await query(`SELECT
    coalesce(sum(${effectiveMinutesSql}) FILTER (WHERE s.date>=${period.fromSql} AND s.date<=${period.toSql}),0)::integer monthly_minutes,
    count(*) FILTER(WHERE a.check_in_at IS NOT NULL AND s.date>=${period.fromSql} AND s.date<=${period.toSql})::integer monthly_sessions,
    count(*) FILTER(WHERE (a.status IN ('selesai','dikoreksi') OR (a.status='ditutup_otomatis' AND a.check_out_at IS NOT NULL)) AND s.date>=${period.fromSql} AND s.date<=${period.toSql})::integer completed_sessions
    FROM attendances a JOIN spkls s ON s.id=a.spkl_id WHERE ${owner} ${employee}`, values);
  const [documents] = await query(`SELECT count(*) FILTER(WHERE s.date>=${period.fromSql} AND s.date<=${period.toSql})::integer monthly,
    count(*) FILTER(WHERE (d.taken_at AT TIME ZONE ${sqlTimeZone()})::date=(now() AT TIME ZONE ${sqlTimeZone()})::date)::integer today,
    count(*) FILTER(WHERE (d.taken_at AT TIME ZONE ${sqlTimeZone()})::date=(now() AT TIME ZONE ${sqlTimeZone()})::date-1)::integer yesterday
    FROM documentations d JOIN spkls s ON s.id=d.spkl_id WHERE ${owner} AND d.kind='photo'`, values);
  const weekly = await query<{ date: string; minutes: number }>(`SELECT s.date::text date, sum(${effectiveMinutesSql})::integer minutes FROM attendances a JOIN spkls s ON s.id=a.spkl_id
    WHERE ${owner} ${employee} AND s.date BETWEEN (now() AT TIME ZONE ${sqlTimeZone()})::date-6 AND (now() AT TIME ZONE ${sqlTimeZone()})::date GROUP BY s.date`, values);
  const recent = await query(`SELECT row_to_json(d) documentation,row_to_json(e) employee,row_to_json(s) spkl FROM documentations d
    JOIN spkls s ON s.id=d.spkl_id JOIN employees e ON e.id=d.employee_id WHERE ${owner} ORDER BY d.taken_at DESC,d.id DESC LIMIT 6`, values);
  const [activity] = await query(`WITH active AS (
    SELECT s.id,s.start_at FROM spkls s WHERE ${owner} AND s.canceled_at IS NULL
      AND ((s.start_at<=now() AND s.end_at>now()) OR EXISTS(SELECT 1 FROM attendances a WHERE a.spkl_id=s.id AND a.status='berjalan'))
    ) SELECT (SELECT count(*)::integer FROM active) spkls,
      (SELECT count(*)::integer FROM attendances a JOIN active ON active.id=a.spkl_id WHERE a.status='berjalan') workers,
      (SELECT count(*)::integer FROM spkl_workers w JOIN active ON active.id=w.spkl_id WHERE active.start_at<=now()
        AND NOT EXISTS(SELECT 1 FROM attendances a WHERE a.spkl_id=w.spkl_id AND a.employee_id=w.employee_id)) needs_attention`, values);
  return { stats, documents, weekly, activity, recent: recent.map((row) => ({ ...decode("documentations", row.documentation), employee: decode("employees", row.employee), spkl: decode("spkls", row.spkl) })) };
}
