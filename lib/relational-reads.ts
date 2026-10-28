import "server-only";
import { decode } from "./db-model";
import { getPolicyRow, query, select, transaction, type Connection } from "./db";
import { emptyData, persistChanges } from "./unit-of-work";
import { finalizeExpired } from "./attendance-finalization";
import type { Database, SessionUser, Spkl } from "./types";

/** Finalize a bounded relevant set with locks; repeat calls are idempotent. */
export async function finalizeScope(where: string, values: unknown[]) {
  const pending = await query(`SELECT s.id FROM spkls s WHERE ${where} AND s.canceled_at IS NULL AND s.end_at<now()
    AND (EXISTS(SELECT 1 FROM attendances a WHERE a.spkl_id=s.id AND a.status='berjalan')
      OR EXISTS(SELECT 1 FROM spkl_workers w WHERE w.spkl_id=s.id AND NOT EXISTS(SELECT 1 FROM attendances a WHERE a.spkl_id=w.spkl_id AND a.employee_id=w.employee_id)))
    ORDER BY s.end_at LIMIT 100`, values);
  for (const row of pending) await transaction(async (connection) => {
    const db = await emptyData(connection);
    db.spkls = await select("spkls", "id=$1", [row.id], connection, "FOR UPDATE");
    db.spklWorkers = await select("spklWorkers", "spkl_id=$1", [row.id], connection);
    db.attendances = await select("attendances", "spkl_id=$1", [row.id], connection, "FOR UPDATE");
    const before = structuredClone(db);
    finalizeExpired(db, row.id);
    await persistChanges(before, db, connection);
  });
}

export async function hydrateSpkls(spkls: Spkl[], connection?: Connection): Promise<Database> {
  const ids = spkls.map((row) => row.id);
  const [spklWorkers, attendances, documentations, policy, divisions] = await Promise.all([
    select("spklWorkers", "spkl_id=ANY($1::text[])", [ids], connection),
    select("attendances", "spkl_id=ANY($1::text[])", [ids], connection),
    select("documentations", "spkl_id=ANY($1::text[])", [ids], connection),
    getPolicyRow(connection),
    select("divisions", "id=ANY($1::text[])", [spkls.map((row) => row.divisionId).filter(Boolean)], connection),
  ]);
  const employeeIds = [...new Set([...spklWorkers.map((row) => row.employeeId), ...spkls.map((row) => row.createdBy)])];
  const employees = await select("employees", "id=ANY($1::text[])", [employeeIds], connection);
  return { schemaVersion: 4, seededAt: "", meta: { nextSpklSequence: 0 }, spkls, spklWorkers, attendances, documentations, policy, divisions, employees, otps: [], notifications: [], auditLogs: [] };
}

export async function overviewData(user: SessionUser) {
  const visible = user.role === "atasan" ? "s.created_by=$1" : "EXISTS(SELECT 1 FROM spkl_workers w WHERE w.spkl_id=s.id AND w.employee_id=$1)";
  await finalizeScope(visible, [user.id]);
  // Current month + future schedules + a bounded history, never all application state.
  const rows = await query(`SELECT s.* FROM spkls s WHERE ${visible}
    ORDER BY (s.canceled_at IS NULL AND s.end_at>=now()) DESC,
    CASE WHEN s.end_at>=now() THEN s.start_at END ASC, s.date DESC,s.id LIMIT 200`, [user.id]);
  return hydrateSpkls(rows.map((row) => decode("spkls", row)));
}

// Same rounding semantics as attendanceMinutes; fixed duration already includes policy rounding.
export const effectiveMinutesSql = `CASE WHEN a.duration_minutes IS NOT NULL THEN greatest(0,a.duration_minutes)
 WHEN a.check_in_at IS NULL OR a.status='tidak_hadir' THEN 0
 ELSE greatest(0,floor(extract(epoch FROM (least(coalesce(a.check_out_at,now()),s.end_at)-greatest(a.check_in_at,s.start_at)))/60+0.5))::integer END`;

export async function overviewMetrics(user: SessionUser) {
  const owner = user.role === "atasan" ? "s.created_by=$1" : "EXISTS(SELECT 1 FROM spkl_workers w WHERE w.spkl_id=s.id AND w.employee_id=$1)";
  const employee = user.role === "pekerja" ? "AND a.employee_id=$1" : "";
  const [stats] = await query(`SELECT
    coalesce(sum(${effectiveMinutesSql}) FILTER (WHERE s.date>=date_trunc('month',now() AT TIME ZONE 'Asia/Jakarta')::date AND s.date<(date_trunc('month',now() AT TIME ZONE 'Asia/Jakarta')+interval '1 month')::date),0)::integer monthly_minutes,
    count(*) FILTER(WHERE a.check_in_at IS NOT NULL AND to_char(s.date,'YYYY-MM')=to_char(now() AT TIME ZONE 'Asia/Jakarta','YYYY-MM'))::integer monthly_sessions,
    count(*) FILTER(WHERE a.status IN ('selesai','ditutup_otomatis','dikoreksi') AND to_char(s.date,'YYYY-MM')=to_char(now() AT TIME ZONE 'Asia/Jakarta','YYYY-MM'))::integer completed_sessions
    FROM attendances a JOIN spkls s ON s.id=a.spkl_id WHERE ${owner} ${employee}`, [user.id]);
  const [documents] = await query(`SELECT count(*) FILTER(WHERE to_char(s.date,'YYYY-MM')=to_char(now() AT TIME ZONE 'Asia/Jakarta','YYYY-MM'))::integer monthly,
    count(*) FILTER(WHERE (d.taken_at AT TIME ZONE 'Asia/Jakarta')::date=(now() AT TIME ZONE 'Asia/Jakarta')::date)::integer today,
    count(*) FILTER(WHERE (d.taken_at AT TIME ZONE 'Asia/Jakarta')::date=(now() AT TIME ZONE 'Asia/Jakarta')::date-1)::integer yesterday
    FROM documentations d JOIN spkls s ON s.id=d.spkl_id WHERE ${owner}`, [user.id]);
  const weekly = await query<{ date: string; minutes: number }>(`SELECT s.date::text date, sum(${effectiveMinutesSql})::integer minutes FROM attendances a JOIN spkls s ON s.id=a.spkl_id
    WHERE ${owner} ${employee} AND s.date BETWEEN (now() AT TIME ZONE 'Asia/Jakarta')::date-6 AND (now() AT TIME ZONE 'Asia/Jakarta')::date GROUP BY s.date`, [user.id]);
  const recent = await query(`SELECT row_to_json(d) documentation,row_to_json(e) employee,row_to_json(s) spkl FROM documentations d
    JOIN spkls s ON s.id=d.spkl_id JOIN employees e ON e.id=d.employee_id WHERE ${owner} ORDER BY d.taken_at DESC,d.id DESC LIMIT 6`, [user.id]);
  const [activity] = await query(`WITH active AS (
    SELECT s.id,s.start_at FROM spkls s WHERE ${owner} AND s.canceled_at IS NULL
      AND ((s.start_at<=now() AND s.end_at>now()) OR EXISTS(SELECT 1 FROM attendances a WHERE a.spkl_id=s.id AND a.status='berjalan'))
    ) SELECT (SELECT count(*)::integer FROM active) spkls,
      (SELECT count(*)::integer FROM attendances a JOIN active ON active.id=a.spkl_id WHERE a.status='berjalan') workers,
      (SELECT count(*)::integer FROM spkl_workers w JOIN active ON active.id=w.spkl_id WHERE active.start_at<=now()
        AND NOT EXISTS(SELECT 1 FROM attendances a WHERE a.spkl_id=w.spkl_id AND a.employee_id=w.employee_id)) needs_attention`, [user.id]);
  return { stats, documents, weekly, activity, recent: recent.map((row) => ({ ...decode("documentations", row.documentation), employee: decode("employees", row.employee), spkl: decode("spkls", row.spkl) })) };
}
