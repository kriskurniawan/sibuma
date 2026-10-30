export type EmployeeRole = "pekerja" | "atasan" | "super_admin";

/**
 * Atasan "read_only" hanya dapat melihat data timnya sendiri. Nilai ini tidak
 * mengubah cakupan data, hanya menghapus seluruh kemampuan menulis.
 */
export type AccessMode = "full" | "read_only";

export interface Division {
  id: string;
  name: string;
  description: string;
  supervisorId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  nik: string;
  name: string;
  phone: string;
  email: string | null;
  avatarKey?: string | null;
  role: EmployeeRole;
  accessMode: AccessMode;
  supervisorId: string | null;
  divisionId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface AttendanceLocation extends GeoPoint {
  accuracy: number;
  distanceFromSite: number;
  capturedAt: string;
}

/** Titik absensi resmi yang dikelola super admin. */
export interface WorkLocation extends GeoPoint {
  id: string;
  name: string;
  address: string;
  radiusMeters: number;
  active: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SpklStatus = "terjadwal" | "berlangsung" | "selesai" | "dibatalkan";

export interface Spkl {
  id: string;
  number: string;
  title: string;
  description: string;
  date: string;
  startAt: string;
  endAt: string;
  location: GeoPoint;
  workLocationId: string | null;
  radiusMeters: number;
  createdBy: string;
  divisionId: string | null;
  requiresDocumentation: boolean;
  canceledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpklWorker {
  spklId: string;
  employeeId: string;
  assignedAt: string;
}

export type AttendanceStatus =
  | "berjalan"
  | "selesai"
  | "ditutup_otomatis"
  | "tidak_hadir"
  | "dikoreksi";

export interface Attendance {
  id: string;
  spklId: string;
  employeeId: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  durationMinutes: number | null;
  checkInLocation: AttendanceLocation | null;
  checkOutLocation: AttendanceLocation | null;
  status: AttendanceStatus;
  correctionReason: string | null;
  correctedBy: string | null;
  correctedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StorageProvider = "local" | "s3";

export interface Documentation {
  id: string;
  spklId: string;
  attendanceId: string;
  employeeId: string;
  storageProvider: StorageProvider;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  description: string;
  takenAt: string;
  location: GeoPoint | null;
  kind?: "photo" | "video";
  durationSeconds?: number | null;
  posterKey?: string | null;
  storageEtag?: string | null;
  createdAt: string;
}

export interface Policy {
  id: "policy";
  roundingMinutes: number;
  dailyLimitMinutes: number;
  weeklyLimitMinutes: number;
  docGraceMinutes: number;
  requireDocumentation: boolean;
  defaultRadiusMeters: number;
  maxGpsAccuracyMeters: number;
  defaultLocation: GeoPoint;
  timezone: string;
  updatedAt: string;
  updatedBy: string;
}

export interface OtpRecord {
  id: string;
  phone: string;
  employeeId: string;
  codeSalt: string;
  codeHash: string;
  createdAt: string;
  expiresAt: string;
  attempts: number;
  status: "menunggu" | "terkirim" | "gagal" | "terpakai";
  identifier?: string | null;
  channel?: "whatsapp" | "email" | null;
  destination?: string | null;
  email?: string | null;
  attemptsResetAt?: string | null;
  usedAt: string | null;
  lockedUntil: string | null;
}

export type NotificationStatus = "terkirim" | "gagal";

export interface NotificationLog {
  id: string;
  recipientId: string | null;
  recipientPhone: string;
  type:
    | "otp"
    | "spkl_baru"
    | "spkl_diubah"
    | "spkl_dibatalkan"
    | "pengingat";
  message: string;
  status: NotificationStatus;
  providerMessageId?: string;
  error?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  objectType:
    | "spkl"
    | "absensi"
    | "karyawan"
    | "divisi"
    | "kebijakan"
    | "autentikasi"
    | "checklist"
    | "tindak_lanjut"
    | "pekerjaan"
    | "dokumen";
  objectId: string;
  summary: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface Database {
  schemaVersion: number;
  seededAt: string;
  meta: {
    nextSpklSequence: number;
  };
  divisions: Division[];
  employees: Employee[];
  spkls: Spkl[];
  spklWorkers: SpklWorker[];
  attendances: Attendance[];
  documentations: Documentation[];
  workLocations: WorkLocation[];
  policy: Policy;
  otps: OtpRecord[];
  notifications: NotificationLog[];
  auditLogs: AuditLog[];
}

export interface SessionPayload {
  employeeId: string;
  exp: number;
}

export interface SessionUser {
  id: string;
  name: string;
  nik: string;
  phone: string;
  email: string | null;
  avatarKey?: string | null;
  role: EmployeeRole;
  accessMode: AccessMode;
  supervisorId: string | null;
  supervisorName: string | null;
}

export interface EmployeeAttendanceView {
  employee: Employee;
  attendance: Attendance | null;
}

export interface SpklListItem {
  spkl: Spkl;
  status: SpklStatus;
  myAttendance: Attendance | null;
  canCheckIn: boolean;
  workerCount: number;
  documentationCount: number;
  creator: Employee | null;
  division: Division | null;
  divisions: Division[];
  workers: Employee[];
}

export interface SpklDetail extends SpklListItem {
  attendances: EmployeeAttendanceView[];
  documentation: Array<Documentation & { employee: Employee | null }>;
  canManage: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  canUpload: boolean;
  isAssigned: boolean;
  myAttendance: Attendance | null;
}

export interface DashboardStats {
  monthlyMinutes: number;
  monthlySessions: number;
  completedSessions: number;
  documentationCount: number;
}

export interface ReportRow {
  attendance: Attendance;
  spkl: Spkl;
  employee: Employee;
  documentationCount: number;
}

export interface ReportSummary {
  employee: Employee;
  sessionCount: number;
  presentCount: number;
  absentCount: number;
  totalMinutes: number;
  documentationCount: number;
}
