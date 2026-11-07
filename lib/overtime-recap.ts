import "server-only";

import { query } from "./db";
import { isRecapHoliday } from "./overtime-recap-days";
import { formatDateHuman } from "./time";
import type { Connection } from "./db";
import type {
  OvertimeRecapPreview,
  OvertimeRecapRow,
  OvertimeRecapSigners,
  OvertimeRecapTeam,
} from "./overtime-recap-types";

export interface EmployeePayrollRecord {
  jobTitle: string;
  basicSalary: number;
  /** Bulan efektif dalam format YYYY-MM. */
  effectiveMonth: string;
}

export interface PayrollInput {
  jobTitle: string;
  basicSalary: number;
  effectiveMonth: string;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function dateParts(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function isValidRecapDate(value: string) {
  return dateParts(value) !== null;
}

/**
 * Rentang rekap boleh mengikuti periode gaji yang tidak sama dengan bulan
 * kalender, mis. 26 Oktober sampai 25 November.
 */
export function recapDateRange(from: string, to: string) {
  const start = dateParts(from);
  const end = dateParts(to);
  if (!start || !end || from > to) return null;

  const years: number[] = [];
  for (let year = start.year; year <= end.year; year += 1) years.push(year);

  const sameMonth =
    start.year === end.year && start.month === end.month;
  const lastDay = new Date(
    Date.UTC(end.year, end.month, 0),
  ).getUTCDate();
  let periodLabel: string;
  if (sameMonth && start.day === 1 && end.day === lastDay) {
    periodLabel = `1–${lastDay} ${formatDateHuman(`${from}T12:00:00`, "MMMM yyyy")}`;
  } else if (sameMonth) {
    periodLabel = `${start.day}–${end.day} ${formatDateHuman(`${from}T12:00:00`, "MMMM yyyy")}`;
  } else if (start.year === end.year) {
    periodLabel = `${formatDateHuman(`${from}T12:00:00`, "d MMM")} – ${formatDateHuman(`${to}T12:00:00`, "d MMM yyyy")}`;
  } else {
    periodLabel = `${formatDateHuman(`${from}T12:00:00`, "d MMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMM yyyy")}`;
  }

  return {
    years,
    start: from,
    end: to,
    periodLabel,
  };
}

function toDateString(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

async function listHolidayDates(years: number[]) {
  const rows = await query<{ holiday_date: unknown; name: string }>(
    `SELECT holiday_date,name FROM national_holidays
     WHERE extract(year FROM holiday_date) = ANY($1::int[])
     ORDER BY holiday_date`,
    [years],
  );
  return rows.map((row) => ({
    date: toDateString(row.holiday_date),
    name: row.name,
  }));
}

export async function listRecapTeams(): Promise<OvertimeRecapTeam[]> {
  return query<OvertimeRecapTeam>(
    `SELECT e.id,e.name,e.active
     FROM employees e
     WHERE e.role='atasan'
       AND EXISTS (
         SELECT 1 FROM employees w
         WHERE w.supervisor_id=e.id AND w.role='pekerja'
       )
     ORDER BY e.active DESC,e.name,e.id`,
  );
}

export async function getRecapTeam(ownerId: string): Promise<OvertimeRecapTeam | null> {
  const [row] = await query<OvertimeRecapTeam>(
    `SELECT id,name,active FROM employees
     WHERE id=$1 AND role='atasan'`,
    [ownerId],
  );
  return row ?? null;
}

export async function getRecapSigners(ownerId: string): Promise<OvertimeRecapSigners> {
  const [row] = await query<{
    building_manager_name: string | null;
    manager_name: string | null;
  }>(
    `SELECT building_manager_name,manager_name FROM team_report_signers
     WHERE owner_id=$1`,
    [ownerId],
  );
  return {
    buildingManagerName: normalizeName(row?.building_manager_name),
    managerName: normalizeName(row?.manager_name),
  };
}

export async function saveRecapSigners(input: {
  ownerId: string;
  signers: OvertimeRecapSigners;
  actorId: string;
}) {
  const signers = {
    buildingManagerName: normalizeName(input.signers.buildingManagerName),
    managerName: normalizeName(input.signers.managerName),
  };
  await query(
    `INSERT INTO team_report_signers
       (owner_id,building_manager_name,manager_name,updated_by,updated_at)
     VALUES ($1,$2,$3,$4,now())
     ON CONFLICT (owner_id) DO UPDATE SET
       building_manager_name=EXCLUDED.building_manager_name,
       manager_name=EXCLUDED.manager_name,
       updated_by=EXCLUDED.updated_by,
       updated_at=EXCLUDED.updated_at`,
    [
      input.ownerId,
      signers.buildingManagerName,
      signers.managerName,
      input.actorId,
    ],
  );
  return signers;
}

export async function getEmployeePayroll(
  employeeId: string,
): Promise<EmployeePayrollRecord | null> {
  const [row] = await query<{
    job_title: string;
    basic_salary: unknown;
    effective_month: unknown;
  }>(
    `SELECT job_title,basic_salary,effective_month
     FROM employee_payrolls
     WHERE employee_id=$1
     ORDER BY effective_month DESC
     LIMIT 1`,
    [employeeId],
  );
  if (!row) return null;
  return {
    jobTitle: row.job_title,
    basicSalary: Number(row.basic_salary),
    effectiveMonth: toDateString(row.effective_month).slice(0, 7),
  };
}

export async function saveEmployeePayroll(input: {
  employeeId: string;
  payroll: PayrollInput;
  actorId: string;
  connection?: Connection;
}) {
  const month = MONTH_PATTERN.exec(input.payroll.effectiveMonth);
  if (!month) throw new Error("Bulan berlaku gaji tidak valid.");
  await query(
    `INSERT INTO employee_payrolls
       (employee_id,effective_month,job_title,basic_salary,updated_by,updated_at)
     VALUES ($1,$2::date,$3,$4,$5,now())
     ON CONFLICT (employee_id,effective_month) DO UPDATE SET
       job_title=EXCLUDED.job_title,
       basic_salary=EXCLUDED.basic_salary,
       updated_by=EXCLUDED.updated_by,
       updated_at=EXCLUDED.updated_at`,
    [
      input.employeeId,
      `${input.payroll.effectiveMonth}-01`,
      input.payroll.jobTitle.trim(),
      input.payroll.basicSalary,
      input.actorId,
    ],
    input.connection,
  );
}

interface EmployeePayrollInfo {
  id: string;
  name: string;
  jobTitle: string | null;
  basicSalary: number | null;
}

interface WorkedDayRow {
  employee_id: string;
  work_date: string;
  minutes: number;
}

interface RecapAccumulator {
  hkDays: number;
  hlDays: number;
  hkMinutes: number;
  hlMinutes: number;
}

/**
 * Rekap pembayaran lembur bulanan memakai:
 * - tanggal SPKL, bukan timestamp check-in, agar klasifikasi HK/HL konsisten;
 * - durasi final setelah kebijakan pembulatan, tanpa sesi berjalan;
 * - gaji terbaru yang berlaku pada awal bulan rekap, tanpa prorata harian;
 * - hari Sabtu, Minggu, dan libur nasional resmi sebagai HL.
 */
export async function buildOvertimeRecap(input: {
  ownerId: string;
  from: string;
  to: string;
  canManageSigners?: boolean;
}): Promise<OvertimeRecapPreview> {
  const range = recapDateRange(input.from, input.to);
  if (!range) throw new Error("Rentang tanggal rekap tidak valid.");

  const owner = await getRecapTeam(input.ownerId);
  if (!owner) throw new Error("Tim rekap tidak ditemukan.");

  const [holidays, signers] = await Promise.all([
    listHolidayDates(range.years),
    getRecapSigners(input.ownerId),
  ]);
  const holidayDates = new Set(holidays.map((holiday) => holiday.date));
  const coveredYears = new Set(
    holidays.map((holiday) => Number(holiday.date.slice(0, 4))),
  );
  const missingHolidayYears = range.years.filter(
    (year) => !coveredYears.has(year),
  );
  const holidayYearAvailable = missingHolidayYears.length === 0;

  const days = await query<WorkedDayRow>(
    `WITH scoped AS (
       SELECT a.employee_id, s.date AS work_date,
         overtime_payable_minutes(
           a.duration_minutes,a.status,a.check_in_at,a.check_out_at,a.piket_start_at,
           s.start_at,s.end_at,s.date,s.canceled_at,now()
         ) AS minutes
       FROM attendances a
       JOIN spkls s ON s.id=a.spkl_id
       WHERE s.created_by=$1
         AND s.date >= $2::date AND s.date <= $3::date
         AND a.status <> 'berjalan'
     )
     SELECT employee_id,work_date::text AS work_date,sum(minutes)::integer AS minutes
     FROM scoped
     GROUP BY employee_id,work_date
     HAVING sum(minutes)>0
     ORDER BY employee_id,work_date`,
    [input.ownerId, range.start, range.end],
  );

  const employeeIds = [...new Set(days.map((day) => day.employee_id))];
  const employees = employeeIds.length
    ? await query<{
        id: string;
        name: string;
        job_title: string | null;
        basic_salary: unknown;
        effective_month: unknown;
      }>(
        `SELECT e.id,e.name,pr.job_title,pr.basic_salary,pr.effective_month
         FROM employees e
         LEFT JOIN LATERAL (
           SELECT p.job_title,p.basic_salary,p.effective_month
           FROM employee_payrolls p
           WHERE p.employee_id=e.id AND p.effective_month <= $2::date
           ORDER BY p.effective_month DESC
           LIMIT 1
         ) pr ON true
         WHERE e.id=ANY($1::text[])
         ORDER BY e.name,e.id`,
        [employeeIds, range.start],
      )
    : [];

  const employeeMap = new Map<string, EmployeePayrollInfo>(
    employees.map((employee) => [
      employee.id,
      {
        id: employee.id,
        name: employee.name,
        jobTitle: employee.job_title,
        basicSalary:
          employee.basic_salary === null || employee.basic_salary === undefined
            ? null
            : Number(employee.basic_salary),
      },
    ]),
  );

  const accumulators = new Map<string, RecapAccumulator>();
  for (const day of days) {
    if (!employeeMap.has(day.employee_id)) continue;
    const accumulator = accumulators.get(day.employee_id) ?? {
      hkDays: 0,
      hlDays: 0,
      hkMinutes: 0,
      hlMinutes: 0,
    };
    if (isRecapHoliday(day.work_date, holidayDates)) {
      accumulator.hlDays += 1;
      accumulator.hlMinutes += Number(day.minutes);
    } else {
      accumulator.hkDays += 1;
      accumulator.hkMinutes += Number(day.minutes);
    }
    accumulators.set(day.employee_id, accumulator);
  }

  const rows: OvertimeRecapRow[] = [];
  const missingPayroll: string[] = [];

  for (const [employeeId, accumulator] of accumulators) {
    const employee = employeeMap.get(employeeId);
    if (!employee) continue;
    const salary =
      employee.basicSalary && employee.basicSalary > 0
        ? employee.basicSalary
        : null;
    const jobTitle = normalizeName(employee.jobTitle) || null;
    const complete = Boolean(salary && jobTitle);
    if (!complete) missingPayroll.push(employee.name);

    const hourlyRate = salary ? salary / 173 : 0;
    const hkPay = (accumulator.hkMinutes / 60) * hourlyRate * 1.5;
    const hlPay = (accumulator.hlMinutes / 60) * hourlyRate * 2;

    rows.push({
      employeeId,
      name: employee.name,
      jobTitle,
      basicSalary: salary,
      hourlyRate,
      hkDays: accumulator.hkDays,
      hlDays: accumulator.hlDays,
      hkMinutes: accumulator.hkMinutes,
      hlMinutes: accumulator.hlMinutes,
      hkPay,
      hlPay,
      totalPay: hkPay + hlPay,
    });
  }

  rows.sort((left, right) => left.name.localeCompare(right.name, "id"));
  missingPayroll.sort((left, right) => left.localeCompare(right, "id"));

  const totals = rows.reduce(
    (total, row) => ({
      employees: total.employees + 1,
      hkDays: total.hkDays + row.hkDays,
      hlDays: total.hlDays + row.hlDays,
      hkMinutes: total.hkMinutes + row.hkMinutes,
      hlMinutes: total.hlMinutes + row.hlMinutes,
      totalPay: total.totalPay + row.totalPay,
    }),
    {
      employees: 0,
      hkDays: 0,
      hlDays: 0,
      hkMinutes: 0,
      hlMinutes: 0,
      totalPay: 0,
    },
  );

  const blockers: OvertimeRecapPreview["blockers"] = [];
  if (rows.length === 0) {
    blockers.push({
      code: "empty",
      message: "Tidak ada lembur final pada periode ini.",
    });
  }
  if (!holidayYearAvailable) {
    blockers.push({
      code: "holiday_calendar",
      message: `Kalender libur nasional tahun ${missingHolidayYears.join(", ")} belum tersedia. Rekap tidak dapat dihitung sebagai HK/HL.`,
    });
  }
  if (missingPayroll.length > 0) {
    blockers.push({
      code: "missing_payroll",
      message: `Jabatan atau gaji pokok belum lengkap untuk ${missingPayroll.join(", ")}. Lengkapi melalui Tambah/Edit Pekerja.`,
    });
  }

  return {
    owner,
    from: range.start,
    to: range.end,
    periodLabel: range.periodLabel,
    rows,
    totals,
    signers,
    canManageSigners: input.canManageSigners ?? false,
    blockers,
    missingPayroll,
    holidayYearAvailable,
    generatedAt: new Date().toISOString(),
  };
}
