export type ChecklistIntervalUnit = "hari" | "minggu" | "bulan";
export type ChecklistPhotoPolicy =
  | "opsional"
  | "wajib"
  | "wajib_saat_masalah";
export type ChecklistCondition =
  | "baik"
  | "perlu_perhatian"
  | "tidak_baik"
  | "tidak_berlaku";
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
export type ChecklistPriority = "rendah" | "sedang" | "tinggi" | "mendesak";
export type ChecklistPhotoStage = "temuan" | "perbaikan";
export type ChecklistItemType = "grup" | "item";

export const CHECKLIST_CONDITION_LABEL: Record<ChecklistCondition, string> = {
  baik: "Baik",
  perlu_perhatian: "Perlu perhatian",
  tidak_baik: "Tidak baik",
  tidak_berlaku: "Tidak berlaku",
};

export const CHECKLIST_STATUS_LABEL: Record<
  ChecklistInspectionStatus,
  string
> = {
  belum_dimulai: "Belum dimulai",
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

export function isIssueCondition(condition: ChecklistCondition | null) {
  return condition === "perlu_perhatian" || condition === "tidak_baik";
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
}

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
}

export interface ChecklistSchedule {
  id: string;
  ownerId: string;
  templateId: string;
  locationId: string;
  intervalUnit: ChecklistIntervalUnit;
  intervalCount: number;
  anchorDate: string;
  dueDays: number;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistPerson {
  id: string;
  name: string;
  nik?: string;
  active?: boolean;
}

export interface ChecklistSetupEmployee extends ChecklistPerson {
  divisionId: string | null;
  divisionName: string | null;
}

export interface ChecklistInspection {
  id: string;
  scheduleId: string | null;
  ownerId: string;
  templateId: string;
  templateVersionId: string;
  locationId: string;
  occurrenceDate: string;
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
  overdue: boolean;
}

export interface ChecklistInspectionDetail {
  inspection: ChecklistInspection;
  overdue: boolean;
  assignees: ChecklistPerson[];
  answers: Array<{ answer: ChecklistAnswer; photos: ChecklistPhoto[] }>;
  photos: ChecklistPhoto[];
  followUps: ChecklistFollowUpRow[];
  schedule: ChecklistSchedule | null;
  team: ChecklistPerson[];
  ownerName: string | null;
  canManage: boolean;
  canFill: boolean;
  canComplete: boolean;
  canReopen: boolean;
  completedByName: string | null;
  reopenedByName: string | null;
}

export interface ChecklistInspectionRef {
  id: string;
  templateName: string;
  category: string;
  locationName: string;
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

export interface ChecklistSetupSchedule extends ChecklistSchedule {
  templateName: string;
  locationName: string;
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
}

export interface ChecklistPublicTimelineEntry {
  at: string;
  label: string;
}

export interface ChecklistPublicStaffTask {
  inspectionId: string;
  templateName: string;
  periodLabel: string;
  status: ChecklistInspectionStatus;
  dueAt: string;
  occurrenceDate: string;
}

export interface ChecklistPublicArea {
  location: ChecklistPublicLocation;
  latest: ChecklistPublicLatest | null;
  items: ChecklistPublicItem[];
  history: ChecklistPublicHistoryEntry[];
  followUps: { open: number; done: number };
  timeline: ChecklistPublicTimelineEntry[];
  lastUpdated: string | null;
  viewingHistory: boolean;
  staffTasks: ChecklistPublicStaffTask[];
}

export interface ChecklistReportFilters {
  from: string;
  to: string;
  locationId?: string;
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
  late: boolean;
  overdue: boolean;
}

export interface ChecklistReportOptions {
  locations: Array<{ id: string; name: string }>;
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
