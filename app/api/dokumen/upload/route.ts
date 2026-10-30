import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { pool } from "@/lib/db";
import {
  documentStorageConfigMessage,
  isDocumentStorageConfigured,
} from "@/lib/document-storage-config";
import {
  documentStorageKey,
  presignDocumentUpload,
} from "@/lib/document-storage";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { getWorkDocumentSettings } from "@/lib/work-document-settings";
import { workDocumentUsedBytes } from "@/lib/work-document-queries";
import {
  safeWorkDocumentFileName,
  workDocumentFileExtension,
} from "@/lib/work-document-file";
import { workDocumentUploadPrepareSchema } from "@/lib/work-document-validation";
import {
  formatDocumentBytes,
  isWorkDocumentVideo,
  WORK_DOCUMENT_HARD_MAX_BYTES,
  WORK_DOCUMENT_MIME,
  type WorkDocumentExtension,
} from "@/lib/work-document-types";

export const maxDuration = 30;

/**
 * Langkah pertama unggahan: periksa batas, lalu terbitkan URL PUT sementara.
 * Berkas dikirim langsung dari browser ke object storage agar tidak melewati
 * batas payload fungsi serverless. Baris dokumen baru dibuat setelah berkas
 * diverifikasi pada langkah penyelesaian.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  if (!isDocumentStorageConfigured()) {
    return apiError(documentStorageConfigMessage(), 503);
  }

  const body = await request.json().catch(() => null);
  const parsed = workDocumentUploadPrepareSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const settings = await getWorkDocumentSettings();
  if (!settings.uploadsEnabled) {
    return apiError(
      "Unggahan dokumen kerja sedang dinonaktifkan oleh super admin.",
      403,
    );
  }

  const fileName = safeWorkDocumentFileName(parsed.data.fileName);
  const extension = workDocumentFileExtension(fileName);
  const allowed = settings.allowedExtensions as string[];
  if (!extension || !allowed.includes(extension)) {
    return apiError(
      `Jenis berkas tidak didukung. Gunakan ${allowed
        .map((value) => value.toUpperCase())
        .join(", ")}.`,
    );
  }
  const isVideo = isWorkDocumentVideo(extension);
  const maxBytes = isVideo
    ? Math.min(settings.maxVideoBytes, WORK_DOCUMENT_HARD_MAX_BYTES)
    : Math.min(settings.maxFileBytes, WORK_DOCUMENT_HARD_MAX_BYTES);
  if (parsed.data.sizeBytes > maxBytes) {
    return apiError(
      `Ukuran ${isVideo ? "video" : "berkas"} ${formatDocumentBytes(parsed.data.sizeBytes)} melebihi batas ${formatDocumentBytes(maxBytes)}.`,
      413,
    );
  }
  if (parsed.data.sizeBytes > WORK_DOCUMENT_HARD_MAX_BYTES) {
    return apiError(
      `Ukuran berkas melebihi batas keras ${formatDocumentBytes(WORK_DOCUMENT_HARD_MAX_BYTES)}.`,
      413,
    );
  }

  const used = await workDocumentUsedBytes(pool(), user.id);
  if (used + parsed.data.sizeBytes > settings.quotaBytes) {
    return apiError(
      `Kuota dokumen tidak cukup. Terpakai ${formatDocumentBytes(used)} dari ${formatDocumentBytes(settings.quotaBytes)}.`,
      413,
    );
  }

  const mimeType = WORK_DOCUMENT_MIME[extension as WorkDocumentExtension];
  const storageKey = documentStorageKey(user.id, extension);
  try {
    const upload = await presignDocumentUpload(
      storageKey,
      mimeType,
      parsed.data.sizeBytes,
    );
    return apiOk({
      upload: {
        key: storageKey,
        url: upload.uploadUrl,
        method: "PUT",
        headers: { "Content-Type": mimeType },
        expiresIn: upload.expiresIn,
      },
    });
  } catch (error) {
    console.error("Gagal membuat URL unggah dokumen:", error);
    return apiError("URL unggah dokumen gagal dibuat. Silakan coba lagi.", 500);
  }
}
