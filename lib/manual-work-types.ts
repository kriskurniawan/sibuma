export const MANUAL_WORK_MAX_ASSIGNEES = 20;

export type ManualWorkStatus =
  | "terbuka"
  | "dikerjakan"
  | "selesai"
  | "dibatalkan";

export const MANUAL_WORK_STATUS_LABEL: Record<ManualWorkStatus, string> = {
  terbuka: "Terbuka",
  dikerjakan: "Dikerjakan",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

export const MANUAL_WORK_ACTIVE_STATUSES: ManualWorkStatus[] = [
  "terbuka",
  "dikerjakan",
];

export const MANUAL_WORK_EVENT_LABEL: Record<string, string> = {
  dibuat: "Dibuat",
  dilaporkan: "Dilaporkan",
  diubah: "Diperbarui",
  dimulai: "Dimulai",
  diselesaikan: "Diselesaikan",
  dibatalkan: "Dibatalkan",
  dibuka_kembali: "Dibuka kembali",
};

export interface ManualWork {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  locationId: string | null;
  /** Snapshot path lokasi saat disimpan; tetap tampil bila lokasi dihapus. */
  locationName: string;
  /** Nama petugas safety yang mendampingi, diisi manual. */
  safetyName: string;
  startDate: string;
  targetDate: string | null;
  requiresDocumentation: boolean;
  status: ManualWorkStatus;
  sourceFollowUpId: string | null;
  resultNote: string;
  cancelReason: string | null;
  createdBy: string;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManualWorkPerson {
  id: string;
  name: string;
  nik: string;
}

export interface ManualWorkTeamMember extends ManualWorkPerson {
  phone: string;
  divisionId: string | null;
  divisionName: string | null;
}

export interface ManualWorkFollowUpOption {
  id: string;
  title: string;
  inspectionId: string;
  dueDate: string | null;
}

export interface ManualWorkLocationOption {
  id: string;
  name: string;
  parentId: string | null;
  active: boolean;
  /** Nama lengkap dari akar hierarki, mis. "Gedung A / Lantai 3". */
  path: string;
}

export interface ManualWorkPhoto {
  id: string;
  workId: string;
  uploadedBy: string;
  storageProvider: "s3";
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string;
  /** Waktu foto diambil; null untuk foto lama sebelum cap waktu wajib. */
  takenAt: string | null;
  captureSource: "exif" | "device" | null;
  /** `video` hanya tambahan; foto tetap wajib untuk dokumentasi. */
  kind?: "photo" | "video";
  durationSeconds?: number | null;
  createdAt: string;
}

export interface ManualWorkEvent {
  id: string;
  workId: string;
  actorId: string;
  actorName: string;
  action: string;
  status: ManualWorkStatus;
  note: string;
  createdAt: string;
}

export interface ManualWorkSource {
  id: string;
  title: string;
  inspectionId: string;
}

export interface ManualWorkRow {
  work: ManualWork;
  assignees: ManualWorkPerson[];
  photoCount: number;
  overdue: boolean;
  ownerName: string;
  createdByName: string;
  selfReported: boolean;
  sourceFollowUp: ManualWorkSource | null;
}

export interface ManualWorkDetail extends ManualWorkRow {
  photos: ManualWorkPhoto[];
  events: ManualWorkEvent[];
  completedByName: string | null;
  reopenedByName: string | null;
  readOnly: boolean;
  canEdit: boolean;
  canStart: boolean;
  canComplete: boolean;
  canCancel: boolean;
  canReopen: boolean;
  canUpload: boolean;
}

export interface ManualWorkTotals {
  active: number;
  overdue: number;
  notStarted: number;
  completedThisMonth: number;
}

export interface ManualWorkFilters {
  status?: string;
  search?: string;
  divisionId?: string;
  employeeId?: string;
}

export interface ManualWorkFilterDivision {
  id: string;
  name: string;
  active: boolean;
}

export interface ManualWorkFilterWorker extends ManualWorkPerson {
  divisionId: string | null;
  divisionName: string | null;
}

export interface ManualWorkFilterOptions {
  divisions: ManualWorkFilterDivision[];
  workers: ManualWorkFilterWorker[];
}

export interface ManualWorkFormData {
  team: ManualWorkTeamMember[];
  followUps: ManualWorkFollowUpOption[];
  locations: ManualWorkLocationOption[];
}

export interface ManualWorkReportFilters {
  from: string;
  to: string;
  status?: string;
  locationId?: string;
  includeSubLocations?: boolean;
  employeeId?: string;
  search?: string;
}

export interface ManualWorkReportOptions {
  locations: ManualWorkLocationOption[];
  employees: ManualWorkPerson[];
}

export interface ManualWorkReportTotals {
  total: number;
  active: number;
  overdue: number;
  inProgress: number;
  notStarted: number;
  completed: number;
  cancelled: number;
  photos: number;
  workers: number;
}

export interface ManualWorkReportRow extends ManualWorkRow {
  /** Path lokasi lengkap dari hierarki checklist; kosong bila lokasi dihapus. */
  locationPath?: string;
}
