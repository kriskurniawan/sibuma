import "server-only";
import { decode } from "./db-model";
import { query } from "./db";
import { clampPage, type PageRequest } from "./pagination";
import { effectiveMinutesSql, finalizeScope } from "./relational-reads";
import type { ReportRow, ReportSummary } from "./types";

export interface ReportFilters {
  from: string;
  to: string;
  employeeId?: string;
  spklId?: string;
  search?: string;
}

const reportFrom = `FROM attendances a JOIN spkls s ON s.id=a.spkl_id JOIN employees e ON e.id=a.employee_id
  WHERE ($1::text IS NULL OR s.created_by=$1) AND s.date BETWEEN $2::date AND $3::date
  AND ($4::text IS NULL OR e.id=$4) AND ($5::text IS NULL OR s.id=$5)
  AND ($6::text IS NULL OR position(lower($6) in lower(e.name||' '||s.title||' '||s.number))>0)`;
const documents = `(SELECT count(*)::integer FROM documentations d WHERE d.attendance_id=a.id)`;

export async function getReportData(supervisorId: string | null, filters: ReportFilters, request?: PageRequest) {
  await finalizeScope("($1::text IS NULL OR s.created_by=$1) AND s.date BETWEEN $2::date AND $3::date", [supervisorId, filters.from, filters.to]);
  const values = [supervisorId, filters.from, filters.to, filters.employeeId || null, filters.spklId || null, filters.search || null];
  const [totals] = await query(`SELECT count(*)::integer sessions,count(*) FILTER(WHERE a.check_in_at IS NOT NULL)::integer present,
    count(*) FILTER(WHERE a.status='tidak_hadir')::integer absent,coalesce(sum(${effectiveMinutesSql}),0)::integer minutes,
    coalesce(sum(${documents}),0)::integer documentation,count(DISTINCT e.id)::integer employees ${reportFrom}`, values);
  const pagination = request ? clampPage(request, totals.sessions) : undefined;
  const [records, groups] = await Promise.all([
    query(`SELECT row_to_json(a) attendance,row_to_json(s) spkl,row_to_json(e) employee,${documents} documentation_count
      ${reportFrom} ORDER BY s.date DESC,e.name,a.id ${pagination ? "LIMIT $7 OFFSET $8" : ""}`,
      pagination ? [...values, pagination.pageSize, pagination.pageIndex * pagination.pageSize] : values),
    query(`SELECT row_to_json(e) employee,count(*)::integer sessions,count(*) FILTER(WHERE a.check_in_at IS NOT NULL)::integer present,
      count(*) FILTER(WHERE a.status='tidak_hadir')::integer absent,coalesce(sum(${effectiveMinutesSql}),0)::integer minutes,
      coalesce(sum(${documents}),0)::integer documentation ${reportFrom} GROUP BY e.id ORDER BY minutes DESC,e.name,e.id
      ${request ? "LIMIT 20" : ""}`, values),
  ]);
  const rows: ReportRow[] = records.map((row) => ({ attendance: decode("attendances", row.attendance), spkl: decode("spkls", row.spkl),
    employee: decode("employees", row.employee), documentationCount: Number(row.documentation_count) }));
  const summaries: ReportSummary[] = groups.map((row) => ({ employee: decode("employees", row.employee), sessionCount: Number(row.sessions),
    presentCount: Number(row.present), absentCount: Number(row.absent), totalMinutes: Number(row.minutes), documentationCount: Number(row.documentation) }));
  return { rows, summaries, pagination, totals: { sessions: Number(totals.sessions), present: Number(totals.present),
    absent: Number(totals.absent), minutes: Number(totals.minutes), documentation: Number(totals.documentation), employees: Number(totals.employees) } };
}
