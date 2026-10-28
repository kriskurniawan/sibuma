import "server-only";
import { decode } from "./db-model";
import { query } from "./db";
import { clampPage, type PageRequest } from "./pagination";
import { effectiveMinutesSql, finalizeScope } from "./relational-reads";

export interface TeamFilters {
  search?: string;
  division?: string;
  status?: string;
}

const monthWhere = `s.created_by=$1 AND s.date>=date_trunc('month',now() AT TIME ZONE 'Asia/Jakarta')::date
  AND s.date<(date_trunc('month',now() AT TIME ZONE 'Asia/Jakarta')+interval '1 month')::date`;
const teamWhere = `e.supervisor_id=$1
  AND ($2::text IS NULL OR position(lower($2) in lower(e.name||' '||e.nik||' '||e.phone||' '||coalesce(e.email,'')||' '||coalesce(d.name,'tanpa divisi')))>0)
  AND ($3::text IS NULL OR ($3='tanpa' AND e.division_id IS NULL) OR e.division_id=$3)
  AND ($4::text IS NULL OR e.active=($4='aktif'))`;
const teamStats = `LEFT JOIN LATERAL (
  SELECT sum(${effectiveMinutesSql}) minutes,count(*) FILTER(WHERE a.check_in_at IS NOT NULL) sessions,
  coalesce(sum((SELECT count(*) FROM documentations doc WHERE doc.attendance_id=a.id)),0) documents
  FROM attendances a JOIN spkls s ON s.id=a.spkl_id WHERE a.employee_id=e.id AND ${monthWhere}
) t ON true`;

export async function getTeamOverview(userId: string, filters: TeamFilters = {}, request?: PageRequest) {
  await finalizeScope(`s.created_by=$1 AND s.date>=date_trunc('month',now() AT TIME ZONE 'Asia/Jakarta')::date`, [userId]);
  const values = [userId, filters.search?.trim() || null, !filters.division || filters.division === "semua" ? null : filters.division,
    ["aktif", "nonaktif"].includes(filters.status ?? "") ? filters.status : null];
  const [count] = await query(`SELECT count(*)::integer total FROM employees e LEFT JOIN divisions d ON d.id=e.division_id WHERE ${teamWhere}`, values);
  const pagination = request ? clampPage(request, count.total) : undefined;
  const rows = await query(`SELECT e.*,coalesce(t.minutes,0)::integer monthly_minutes,coalesce(t.sessions,0)::integer sessions,
    coalesce(t.documents,0)::integer documentation_count FROM employees e LEFT JOIN divisions d ON d.id=e.division_id ${teamStats}
    WHERE ${teamWhere} ORDER BY e.active DESC,e.name,e.id ${pagination ? "LIMIT $5 OFFSET $6" : ""}`,
    pagination ? [...values, pagination.pageSize, pagination.pageIndex * pagination.pageSize] : values);
  return {
    rows: rows.map((row) => ({ employee: decode("employees", row), monthlyMinutes: row.monthly_minutes as number,
      sessions: row.sessions as number, documentationCount: row.documentation_count as number })),
    total: count.total as number,
    pagination,
  };
}

/** Global team KPIs and division counts, independent of the visible page/filter. */
export async function getTeamTotals(userId: string) {
  const [members, attendance, divisions] = await Promise.all([
    query(`SELECT count(*)::integer total,count(*) FILTER(WHERE active)::integer active,
      count(*) FILTER(WHERE division_id IS NULL)::integer unassigned FROM employees WHERE supervisor_id=$1`, [userId]),
    query(`SELECT coalesce(sum(${effectiveMinutesSql}),0)::integer minutes,count(*) FILTER(WHERE a.check_in_at IS NOT NULL)::integer sessions,
      coalesce(sum((SELECT count(*) FROM documentations doc WHERE doc.attendance_id=a.id)),0)::integer documents
      FROM attendances a JOIN spkls s ON s.id=a.spkl_id JOIN employees e ON e.id=a.employee_id
      WHERE e.supervisor_id=$1 AND ${monthWhere}`, [userId]),
    query(`SELECT division_id,count(*)::integer total,count(*) FILTER(WHERE active)::integer active FROM employees
      WHERE supervisor_id=$1 GROUP BY division_id`, [userId]),
  ]);
  return { total: Number(members[0].total), active: Number(members[0].active), unassigned: Number(members[0].unassigned),
    minutes: Number(attendance[0].minutes), sessions: Number(attendance[0].sessions), documents: Number(attendance[0].documents),
    divisions: divisions.map((row) => ({ id: row.division_id as string, total: Number(row.total), active: Number(row.active) })) };
}

export async function getTeamLoad(userId: string) {
  const rows = await query(`SELECT e.*,coalesce(t.minutes,0)::integer monthly_minutes,coalesce(t.sessions,0)::integer sessions,
    coalesce(t.documents,0)::integer documentation_count FROM employees e ${teamStats}
    WHERE e.supervisor_id=$1 AND e.active ORDER BY monthly_minutes DESC,e.name,e.id LIMIT 20`, [userId]);
  return rows.map((row) => ({ employee: decode("employees", row), minutes: Number(row.monthly_minutes),
    sessions: Number(row.sessions), documentationCount: Number(row.documentation_count) }));
}
