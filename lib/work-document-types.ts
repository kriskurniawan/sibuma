import type { PageRequest } from "./pagination";

export const WORK_DOCUMENT_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "docx",
  "xlsx",
  "pptx",
  "mp4",
  "webm",
  "mov",
] as const;

export type WorkDocumentExtension = (typeof WORK_DOCUMENT_EXTENSIONS)[number];

export const WORK_DOCUMENT_MIME: Record<WorkDocumentExtension, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export const WORK_DOCUMENT_ACCEPT = WORK_DOCUMENT_EXTENSIONS.map(
  (extension) => `.${extension}`,
).join(",");

/** Pratinjau di browser untuk PDF, gambar, dan video. */
export const WORK_DOCUMENT_PREVIEW_EXTENSIONS = new Set<string>([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "mp4",
  "webm",
  "mov",
]);

export const WORK_DOCUMENT_VIDEO_EXTENSIONS = new Set<string>([
  "mp4",
  "webm",
  "mov",
]);

export function isWorkDocumentVideo(extension: string) {
  return WORK_DOCUMENT_VIDEO_EXTENSIONS.has(extension.toLowerCase());
}

export const WORK_DOCUMENT_DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
export const WORK_DOCUMENT_DEFAULT_QUOTA_BYTES = 1024 * 1024 * 1024;
export const WORK_DOCUMENT_DEFAULT_MAX_VIDEO_BYTES = 100 * 1024 * 1024;
/** Batas keras ukuran berkas, terlepas dari pengaturan super admin. */
export const WORK_DOCUMENT_HARD_MAX_BYTES = 100 * 1024 * 1024;

export type WorkDocumentAudience = "division" | "supervisor";

export interface WorkDocumentSettings {
  uploadsEnabled: boolean;
  maxFileBytes: number;
  maxVideoBytes: number;
  quotaBytes: number;
  allowedExtensions: WorkDocumentExtension[];
  trashRetentionDays: number;
  shareToDivision: boolean;
  shareToSupervisor: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

export interface WorkDocument {
  id: string;
  ownerId: string;
  folderId: string | null;
  title: string;
  description: string;
  storageKey: string;
  fileName: string;
  extension: WorkDocumentExtension;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  purgeAfter: string | null;
}

export interface WorkDocumentFolder {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  documentCount: number;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkDocumentFolderDetail extends WorkDocumentFolder {
  shares: WorkDocumentShares;
  shareTargets: WorkDocumentShareTarget[];
  canManage: boolean;
  ownerDivisionId: string | null;
  ownerDivisionName: string | null;
  ownerSupervisorName: string | null;
}

export interface WorkDocumentShares {
  division: boolean;
  supervisor: boolean;
}

/** Penerima akses hanya-baca yang dipilih secara eksplisit. */
export interface WorkDocumentShareTarget {
  audience: WorkDocumentAudience;
  targetId: string;
  name: string;
  description: string | null;
  /** Diwarisi dari sakelar berbagi lama sebelum target eksplisit ada. */
  legacy: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface WorkDocumentShareOption {
  id: string;
  name: string;
  description: string | null;
}

export interface WorkDocumentShareOptions {
  divisions: WorkDocumentShareOption[];
  supervisors: WorkDocumentShareOption[];
}

export interface WorkDocumentShareSelection {
  divisionIds: string[];
  supervisorIds: string[];
}

export interface WorkDocumentRow extends WorkDocument {
  ownerName: string;
  ownerDivisionName: string | null;
  folderName: string | null;
  shares: WorkDocumentShares;
  canManage: boolean;
}

export interface WorkDocumentDetail extends WorkDocumentRow {
  ownerDivisionId: string | null;
  ownerSupervisorName: string | null;
  shareTargets: WorkDocumentShareTarget[];
  isOwner: boolean;
}

export interface WorkDocumentUsage {
  activeCount: number;
  activeBytes: number;
  trashCount: number;
  trashBytes: number;
  sharedCount: number;
  usedBytes: number;
  quotaBytes: number;
  maxFileBytes: number;
  maxVideoBytes: number;
}

export interface WorkDocumentPage {
  rows: WorkDocumentRow[];
  total: number;
  page: PageRequest;
}

export type WorkDocumentTab = "saya" | "dibagikan" | "sampah";

export function workDocumentKind(extension: string) {
  if (extension === "pdf") return "pdf" as const;
  if (extension === "jpg" || extension === "jpeg" || extension === "png") {
    return "image" as const;
  }
  if (isWorkDocumentVideo(extension)) return "video" as const;
  if (extension === "docx") return "document" as const;
  if (extension === "xlsx") return "spreadsheet" as const;
  if (extension === "pptx") return "presentation" as const;
  return "file" as const;
}

export function workDocumentExtensionLabel(extension: string) {
  if (extension === "jpg" || extension === "jpeg") return "JPG";
  return extension.toUpperCase();
}

export function formatDocumentBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** exponent;
  const digits = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toLocaleString("id-ID", {
    maximumFractionDigits: digits,
  })} ${units[exponent]}`;
}
