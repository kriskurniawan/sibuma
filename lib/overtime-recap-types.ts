/** Tipe rekap lembur bulanan; tidak pernah memuat data gaji pada tipe Employee. */

export interface OvertimeRecapTeam {
  id: string;
  name: string;
  active: boolean;
}

export interface OvertimeRecapRow {
  employeeId: string;
  name: string;
  jobTitle: string | null;
  basicSalary: number | null;
  /** Tarif penuh (tanpa pembulatan) agar nominal dapat dihitung ulang. */
  hourlyRate: number;
  hkDays: number;
  hlDays: number;
  hkMinutes: number;
  hlMinutes: number;
  hkPay: number;
  hlPay: number;
  totalPay: number;
}

export interface OvertimeRecapTotals {
  employees: number;
  hkDays: number;
  hlDays: number;
  hkMinutes: number;
  hlMinutes: number;
  totalPay: number;
}

export interface OvertimeRecapSigners {
  buildingManagerName: string;
  managerName: string;
}

export type OvertimeRecapBlockerCode =
  | "empty"
  | "holiday_calendar"
  | "missing_payroll";

export interface OvertimeRecapBlocker {
  code: OvertimeRecapBlockerCode;
  message: string;
}

export interface OvertimeRecapPreview {
  owner: OvertimeRecapTeam;
  /** Tanggal awal periode, inklusif (yyyy-MM-dd). */
  from: string;
  /** Tanggal akhir periode, inklusif (yyyy-MM-dd). */
  to: string;
  periodLabel: string;
  rows: OvertimeRecapRow[];
  totals: OvertimeRecapTotals;
  signers: OvertimeRecapSigners;
  canManageSigners: boolean;
  blockers: OvertimeRecapBlocker[];
  missingPayroll: string[];
  holidayYearAvailable: boolean;
  generatedAt: string;
}

export interface OvertimeRecapPreviewResponse {
  teams?: OvertimeRecapTeam[];
  preview?: OvertimeRecapPreview | null;
  /** Pengguna lintas tim (super admin/observer) wajib memilih tim. */
  canSelectTeam?: boolean;
}

export type OvertimeRecapFormat = "pdf" | "xlsx";
