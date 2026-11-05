import type { ChecklistLocationOption } from "./checklist-location-path";
import type { ManualWorkStatus } from "./manual-work-types";

export type ChecklistIntervalUnit = "hari" | "minggu" | "bulan";
export type ChecklistPhotoPolicy =
  | "opsional"
  | "wajib"
  | "wajib_saat_masalah";
export type ChecklistInspectionStatus =
  | "belum_dimulai"
  | "berlangsung"
  | "selesai"
  | "dilewati";
export type ChecklistFollowUpStatus =
  | "terbuka"
  | "diproses"
  | "tertunda"
  | "selesai"
  | "dibatalkan";
/** Kunci status checklist; daftar dan labelnya diatur di Pengaturan. */
export type ChecklistCondition = string;
export type ChecklistConditionTone =
  | "success"
  | "warning"
  | "danger"
  | "neutral";
export type ChecklistPriority = "rendah" | "sedang" | "tinggi" | "mendesak";
export type ChecklistPhotoStage = "temuan" | "perbaikan";
export type ChecklistItemType = "grup" | "item";
export type ChecklistDistributionMode = "tunggal" | "per_lokasi";

/** 1 = Senin, 7 = Minggu; mengikuti ISO weekday. */
export type ChecklistWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ChecklistScheduleDay {
  weekday: ChecklistWeekday;
  enabled: boolean;
  /** Jam mulai pengisian, format HH:mm. */
  startTime: string;
  /** Jam batas pengisian pada hari tenggat, format HH:mm. */
  endTime: string;
}

export const CHECKLIST_WEEKDAY_LABEL: Record<ChecklistWeekday, string> = {
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
  7: "Minggu",
};

export const CHECKLIST_WEEKDAYS: ChecklistWeekday[] = [1, 2, 3, 4, 5, 6, 7];

export function defaultChecklistScheduleDays(): ChecklistScheduleDay[] {
  return CHECKLIST_WEEKDAYS.map((weekday) => ({
    weekday,
    enabled: true,
    startTime: "00:00",
    endTime: "23:59",
  }));
}

export const CHECKLIST_CONDITION_TONE_LABEL: Record<
  ChecklistConditionTone,
  string
> = {
  success: "Positif",
  warning: "Peringatan",
  danger: "Masalah",
  neutral: "Netral",
};

export interface ChecklistConditionOption {
  id: string;
  label: string;
  tone: ChecklistConditionTone;
  isIssue: boolean;
  requiresNote: boolean;
  active: boolean;
  position: number;
}

export function findChecklistCondition(
  conditions: ChecklistConditionOption[],
  id: string | null | undefined,
) {
  if (!id) return null;
  return conditions.find((condition) => condition.id === id) ?? null;
}

export const CHECKLIST_STATUS_LABEL: Record<
  ChecklistInspectionStatus,
  string
> = {
  belum_dimulai: "Belum diisi",
  berlangsung: "Berlangsung",
  selesai: "Selesai",
  dilewati: "Dilewati",
};

export const CHECKLIST_PHOTO_POLICY_LABEL: Record<
  ChecklistPhotoPolicy,
  string
> = {
  opsional: "Foto opsional",
  wajib: "Foto wajib",
  wajib_saat_masalah: "Foto wajib saat bermasalah",
};

export const CHECKLIST_PRIORITY_LABEL: Record<ChecklistPriority, string> = {
  rendah: "Rendah",
  sedang: "Sedang",
  tinggi: "Tinggi",
  mendesak: "Mendesak",
};

export type ChecklistEquipmentActivity =
  | "penggantian"
  | "perbaikan"
  | "pengisian"
  | "servis";

export const CHECKLIST_EQUIPMENT_ACTIVITY_LABEL: Record<
  ChecklistEquipmentActivity,
  string
> = {
  penggantian: "Penggantian",
  perbaikan: "Perbaikan",
  pengisian: "Penambahan",
  servis: "Servis",
};

/** Urutan tampilan komponen yang paling sering dipantau. */
const EQUIPMENT_COMPONENT_ORDER = ["aki", "oli", "coolant", "bbm"];

export function equipmentComponentRank(component: string) {
  const index = EQUIPMENT_COMPONENT_ORDER.indexOf(
    component.trim().toLowerCase(),
  );
  return index === -1 ? EQUIPMENT_COMPONENT_ORDER.length : index;
}

export function formatEquipmentQuantity(
  quantity: number | null,
  unit: string,
) {
  if (quantity === null) return unit.trim();
  const formatted = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(quantity);
  return unit.trim() ? `${formatted} ${unit.trim()}` : formatted;
}

export function formatEquipmentHourMeter(hourMeter: number | null) {
  if (hourMeter === null) return null;
  return `${new Intl.NumberFormat("id-ID").format(hourMeter)} HM`;
}

export const CHECKLIST_FOLLOW_UP_LABEL: Record<
  ChecklistFollowUpStatus,
  string
> = {
  terbuka: "Terbuka",
  diproses: "Diproses",
  tertunda: "Tertunda",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

export const CHECKLIST_INTERVAL_UNIT_LABEL: Record<
  ChecklistIntervalUnit,
  string
> = {
  hari: "hari",
  minggu: "minggu",
  bulan: "bulan",
};

export const CHECKLIST_MAX_ASSIGNEES = 500;
export const CHECKLIST_MAX_ITEMS = 100;
export const CHECKLIST_MAX_GROUPS = 30;

export function isIssueCondition(
  condition: ChecklistCondition | null,
  conditions: ChecklistConditionOption[],
) {
  return Boolean(findChecklistCondition(conditions, condition)?.isIssue);
}

export function conditionRequiresNote(
  condition: ChecklistCondition | null,
  conditions: ChecklistConditionOption[],
) {
  return Boolean(findChecklistCondition(conditions, condition)?.requiresNote);
}

export interface ChecklistLocation {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  publicDescription: string;
  publicEnabled: boolean;
  parentId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Label hierarki dari akar, diisi saat data lokasi dimuat untuk UI. */
  path?: string;
  /** Nama atasan pemilik, diisi saat lokasi ditampilkan lintas pemilik. */
  ownerName?: string | null;
}

export interface ChecklistEquipment {
  id: string;
  ownerId: string;
  locationId: string;
  code: string;
  name: string;
  category: string;
  publicEnabled: boolean;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistEquipmentMaintenance {
  id: string;
  equipmentId: string;
  ownerId: string;
  activity: ChecklistEquipmentActivity;
  component: string;
  quantity: number | null;
  unit: string;
  hourMeter: number | null;
  performedDate: string;
  performedBy: string | null;
  /** Nama pelaksana/pencatat, hanya untuk halaman internal. */
  performedByName: string | null;
  description: string;
  publicVisible: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistEquipmentSummaryEntry {
  component: string;
  activity: ChecklistEquipmentActivity;
  performedDate: string;
  quantity: number | null;
  unit: string;
  hourMeter: number | null;
}

export interface ChecklistEquipmentListItem extends ChecklistEquipment {
  locationName: string;
  locationPath: string;
  locationPublicEnabled: boolean;
  maintenanceCount: number;
  lastMaintenance: ChecklistEquipmentMaintenance | null;
}

export interface ChecklistEquipmentSetup {
  equipment: ChecklistEquipmentListItem[];
  locations: ChecklistLocationOption[];
}

export interface ChecklistEquipmentDetail {
  equipment: ChecklistEquipmentListItem;
  locations: ChecklistLocationOption[];
  maintenance: ChecklistEquipmentMaintenance[];
  summary: ChecklistEquipmentSummaryEntry[];
}

export interface ChecklistEquipmentInput {
  locationId: string;
  code: string;
  name: string;
  category: string;
  publicEnabled: boolean;
}

export type ChecklistEquipmentUpdateInput = Partial<
  Omit<ChecklistEquipmentInput, "locationId">
> & { locationId?: string; active?: boolean };

export interface ChecklistEquipmentMaintenanceInput {
  activity: ChecklistEquipmentActivity;
  component: string;
  quantity: number | null;
  unit: string;
  hourMeter: number | null;
  performedDate: string;
  description: string;
  publicVisible: boolean;
}

export type ChecklistEquipmentMaintenanceUpdateInput = Partial<ChecklistEquipmentMaintenanceInput>;

export interface ChecklistTemplate {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  description: string;
  active: boolean;
  currentVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistTemplateVersion {
  id: string;
  templateId: string;
  version: number;
  notes: string;
  createdBy: string;
  createdAt: string;
}

export interface ChecklistTemplateItem {
  id: string;
  versionId: string;
  position: number;
  itemType: ChecklistItemType;
  parentItemId: string | null;
  groupPath: string;
  prompt: string;
  guidance: string;
  required: boolean;
  photoPolicy: ChecklistPhotoPolicy;
  requireNoteOnIssue: boolean;
  publicVisible: boolean;
  /** Default lokasi grup atau lokasi fisik item; kosong berarti ikut jadwal. */
  locationId: string | null;
}

export interface ChecklistSchedule {
  id: string;
  ownerId: string;
  templateId: string;
  /** Lokasi pemeriksaan tunggal atau lokasi default untuk item tanpa lokasi. */
  locationId: string;
  distributionMode: ChecklistDistributionMode;
  intervalUnit: ChecklistIntervalUnit;
  intervalCount: number;
  anchorDate: string;
  dueDays: number;
  /** Tujuh pengaturan hari; selalu lengkap setelah migrasi 028. */
  days: ChecklistScheduleDay[];
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistPerson {
  id: string;
  name: string;
  nik?: string;
  avatarKey?: string | null;
  active?: boolean;
}

export interface ChecklistSetupEmployee extends ChecklistPerson {
  divisionId: string | null;
  divisionName: string | null;
}

export interface ChecklistInspection {
  id: string;
  scheduleId: string | null;
  packageId: string | null;
  ownerId: string;
  templateId: string;
  templateVersionId: string;
  locationId: string;
  occurrenceDate: string;
  /** Waktu pengisian dibuka; snapshot dari jam mulai jadwal. */
  opensAt: string;
  dueAt: string;
  templateName: string;
  category: string;
  locationName: string;
  periodLabel: string;
  status: ChecklistInspectionStatus;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistAnswer {
  id: string;
  inspectionId: string;
  itemId: string;
  position: number;
  groupPath: string;
  prompt: string;
  guidance: string;
  required: boolean;
  photoPolicy: ChecklistPhotoPolicy;
  requireNoteOnIssue: boolean;
  publicVisible: boolean;
  condition: ChecklistCondition | null;
  note: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface ChecklistPhoto {
  id: string;
  inspectionId: string;
  answerId: string | null;
  followUpId: string | null;
  uploadedBy: string;
  storageProvider: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string;
  stage: ChecklistPhotoStage;
  /** `video` hanya tambahan; foto tetap wajib untuk dokumentasi. */
  kind?: "photo" | "video";
  durationSeconds?: number | null;
  createdAt: string;
}

export interface ChecklistFollowUp {
  id: string;
  inspectionId: string;
  answerId: string | null;
  ownerId: string;
  title: string;
  description: string;
  picId: string | null;
  safetyName: string;
  priority: ChecklistPriority;
  dueDate: string | null;
  status: ChecklistFollowUpStatus;
  progressNote: string;
  cancelReason: string | null;
  resultNote: string;
  createdBy: string;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistFollowUpEvent {
  id: string;
  followUpId: string;
  actorId: string;
  actorName: string;
  action: string;
  status: ChecklistFollowUpStatus;
  note: string;
  createdAt: string;
}

export interface ChecklistInspectionRow {
  inspection: ChecklistInspection;
  assignees: ChecklistPerson[];
  answeredCount: number;
  totalItems: number;
  openFollowUps: number;
  /** Tanggal jadwal atau deadline sudah lewat. */
  overdue: boolean;
  /** Deadline sudah lewat dan pengisian dikunci sampai atasan membukanya. */
  locked: boolean;
  /** Label hierarki lokasi saat ini; fallback ke snapshot locationName. */
  locationPath?: string;
}

export interface ChecklistPackageLocation {
  inspectionId: string;
  locationId: string;
  locationName: string;
  locationPath?: string;
  status: ChecklistInspectionStatus;
  answeredCount: number;
  totalItems: number;
  /** Pemeriksaan yang sedang dibuka. */
  current: boolean;
}

export interface ChecklistInspectionPackage {
  id: string;
  templateName: string;
  periodLabel: string;
  occurrenceDate: string;
  dueAt: string;
  completedLocations: number;
  totalLocations: number;
  locations: ChecklistPackageLocation[];
}

export interface ChecklistInspectionDetail {
  inspection: ChecklistInspection;
  package: ChecklistInspectionPackage | null;
  /** Tanggal jadwal atau deadline sudah lewat. */
  overdue: boolean;
  /** Deadline sudah lewat dan pengisian dikunci sampai atasan membukanya. */
  deadlineLocked: boolean;
  assignees: ChecklistPerson[];
  answers: Array<{ answer: ChecklistAnswer; photos: ChecklistPhoto[] }>;
  photos: ChecklistPhoto[];
  followUps: ChecklistFollowUpRow[];
  schedule: ChecklistSchedule | null;
  team: ChecklistPerson[];
  ownerName: string | null;
  /** Atasan pemilik checklist berstatus "Hanya lihat" sehingga tidak dapat menjadi PIC. */
  ownerReadOnly: boolean;
  readOnly: boolean;
  canManage: boolean;
  /** Tanggal jadwal sudah tiba sehingga item boleh diisi. */
  hasStarted: boolean;
  canFill: boolean;
  canComplete: boolean;
  canReopen: boolean;
  /** Atasan pemilik dapat membuka kunci deadline. */
  canUnlock: boolean;
  completedByName: string | null;
  reopenedByName: string | null;
}

export interface ChecklistInspectionRef {
  id: string;
  templateName: string;
  category: string;
  locationName: string;
  locationPath?: string;
  occurrenceDate: string;
  dueAt: string;
  status: ChecklistInspectionStatus;
  periodLabel: string;
}

export interface ChecklistFollowUpRow {
  followUp: ChecklistFollowUp;
  inspection: ChecklistInspectionRef;
  prompt: string | null;
  pic: ChecklistPerson | null;
  creatorName: string | null;
  events: ChecklistFollowUpEvent[];
  overdue: boolean;
}

export interface ChecklistTotals {
  todo: number;
  /** Checklist hari ini yang belum terlambat dan belum selesai. */
  todayTodo: number;
  overdue: number;
  completedThisMonth: number;
  openFollowUps: number;
}

export interface ChecklistFollowUpTotals {
  open: number;
  inProgress: number;
  overdue: number;
  doneThisMonth: number;
}

export interface ChecklistSetupTemplate extends ChecklistTemplate {
  versions: Array<
    ChecklistTemplateVersion & { itemCount: number; items: ChecklistTemplateItem[] }
  >;
  usedBySchedules: number;
}

export interface ChecklistScheduleDistribution {
  locationId: string;
  locationName: string;
  locationPath: string;
  itemCount: number;
}

export interface ChecklistSetupSchedule extends ChecklistSchedule {
  templateName: string;
  locationName: string;
  locationPath: string;
  distribution: ChecklistScheduleDistribution[];
  assignees: ChecklistSetupEmployee[];
  nextOccurrence: string | null;
}

export interface ChecklistSetup {
  locations: ChecklistLocation[];
  templates: ChecklistSetupTemplate[];
  schedules: ChecklistSetupSchedule[];
  employees: ChecklistSetupEmployee[];
}

export type ChecklistQrMode = "pilih_area" | "langsung";

export interface ChecklistQrCode {
  id: string;
  ownerId: string;
  token: string;
  name: string;
  mode: ChecklistQrMode;
  locationId: string | null;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistQrSetup {
  codes: Array<ChecklistQrCode & { locationName: string | null }>;
  locations: ChecklistLocation[];
}

export function checklistQrPath(code: {
  token: string;
  mode: ChecklistQrMode;
  locationId: string | null;
}) {
  return code.mode === "langsung" && code.locationId
    ? `/p/${code.token}/area/${code.locationId}`
    : `/p/${code.token}`;
}

export interface ChecklistPublicLatest {
  inspectionId: string;
  status: ChecklistInspectionStatus;
  occurrenceDate: string;
  dueAt: string;
  completedAt: string | null;
  periodLabel: string;
  templateName: string;
  category: string;
  answeredCount: number;
  totalItems: number;
  issueCount: number;
  openFollowUps: number;
}

export interface ChecklistPublicLocation {
  id: string;
  name: string;
  description: string;
  parentName: string | null;
  latest: ChecklistPublicLatest | null;
}

export interface ChecklistPublicItem {
  prompt: string;
  groupPath: string;
  condition: ChecklistCondition | null;
  updatedAt: string | null;
}

export interface ChecklistPublicHistoryEntry {
  id: string;
  occurrenceDate: string;
  status: ChecklistInspectionStatus;
  completedAt: string | null;
  periodLabel: string;
  templateName: string;
  answeredCount: number;
  totalItems: number;
  issueCount: number;
}

export interface ChecklistPublicTimelineEntry {
  at: string;
  label: string;
}

export interface ChecklistPublicManualWork {
  id: string;
  title: string;
  description: string;
  status: ManualWorkStatus;
  startDate: string;
  targetDate: string | null;
  completedAt: string | null;
}

export interface ChecklistPublicEquipmentMaintenance {
  id: string;
  activity: ChecklistEquipmentActivity;
  component: string;
  quantity: number | null;
  unit: string;
  hourMeter: number | null;
  performedDate: string;
  description: string;
}

export interface ChecklistPublicEquipmentSummaryEntry {
  component: string;
  activity: ChecklistEquipmentActivity;
  performedDate: string;
  quantity: number | null;
  unit: string;
  hourMeter: number | null;
}

export interface ChecklistPublicEquipment {
  id: string;
  code: string;
  name: string;
  category: string;
  maintenanceCount: number;
  lastMaintenance: ChecklistPublicEquipmentMaintenance | null;
  /** Riwayat terbaru untuk ringkasan di halaman QR area. */
  history: ChecklistPublicEquipmentMaintenance[];
  /** Catatan terakhir per komponen/bahan. */
  summary: ChecklistPublicEquipmentSummaryEntry[];
}

export interface ChecklistPublicEquipmentDetail {
  equipment: {
    id: string;
    code: string;
    name: string;
    category: string;
    locationName: string;
  };
  maintenance: ChecklistPublicEquipmentMaintenance[];
  summary: ChecklistPublicEquipmentSummaryEntry[];
}

export interface ChecklistPublicArea {
  location: ChecklistPublicLocation;
  latest: ChecklistPublicLatest | null;
  items: ChecklistPublicItem[];
  history: ChecklistPublicHistoryEntry[];
  followUps: { open: number; done: number };
  timeline: ChecklistPublicTimelineEntry[];
  manualWorks: ChecklistPublicManualWork[];
  equipment: ChecklistPublicEquipment[];
  lastUpdated: string | null;
  viewingHistory: boolean;
}

export interface ChecklistReportFilters {
  from: string;
  to: string;
  locationId?: string;
  /** Default true: area yang dipilih mencakup seluruh sub-lokasinya. */
  includeSubLocations?: boolean;
  templateId?: string;
  status?: string;
  search?: string;
}

export interface ChecklistReportTotals {
  total: number;
  completed: number;
  onTime: number;
  late: number;
  pending: number;
  overdue: number;
  findings: number;
  openFollowUps: number;
}

export interface ChecklistReportRow {
  inspection: ChecklistInspection;
  assignees: ChecklistPerson[];
  answeredCount: number;
  totalItems: number;
  issueCount: number;
  openFollowUps: number;
  /** Selesai setelah tanggal jadwal atau deadline. */
  late: boolean;
  /** Tanggal jadwal atau deadline sudah lewat dan belum selesai. */
  overdue: boolean;
  locationPath?: string;
}

export interface ChecklistReportOptions {
  locations: ChecklistLocationOption[];
  templates: Array<{ id: string; name: string }>;
  employees: ChecklistPerson[];
}

export interface ChecklistFollowUpReportTotals {
  total: number;
  open: number;
  inProgress: number;
  overdue: number;
  done: number;
  cancelled: number;
}
