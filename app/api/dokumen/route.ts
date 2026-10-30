import path from "node:path";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertAudit } from "@/lib/audit";
import { pool, query, transaction } from "@/lib/db";
import {
  documentStorageConfigMessage,
  isDocumentStorageConfigured,
} from "@/lib/document-storage-config";
import {
  deleteDocumentObject,
  readDocumentObjectPrefix,
  statDocumentObject,
} from "@/lib/document-storage";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { getWorkDocumentSettings } from "@/lib/work-document-settings";
import { workDocumentUsedBytes } from "@/lib/work-document-queries";
import { WorkDocumentError } from "@/lib/work-document-errors";
import { toWorkDocument } from "@/lib/work-document-record";
import {
  hasValidWorkDocumentMagic,
  safeWorkDocumentFileName,
  workDocumentFileExtension,
} from "@/lib/work-document-file";
import { workDocumentUploadCompleteSchema } from "@/lib/work-document-validation";
import { assertOwnedFolder } from "@/lib/work-document-folders";
import {
  formatDocumentBytes,
  isWorkDocumentVideo,
  WORK_DOCUMENT_HARD_MAX_BYTES,
  WORK_DOCUMENT_MIME,
  type WorkDocument,
  type WorkDocumentExtension,
} from "@/lib/work-document-types";

export const maxDuration = 30;

function uploadedDocument(document: WorkDocument) {
  return {
    id: document.id,
    title: document.title,
    description: document.description,
    fileName: document.fileName,
    extension: document.extension,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

/**
 * Langkah kedua unggahan: berkas sudah dikirim langsung ke storage. Ukuran,
 * magic bytes, dan kuota diverifikasi ulang sebelum metadata disimpan, lalu
 * objek yang gagal diselesaikan dibersihkan agar tidak menjadi yatim.
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
  const parsed = workDocumentUploadCompleteSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const fileName = safeWorkDocumentFileName(parsed.data.fileName);
  const extension = workDocumentFileExtension(fileName);
  const keyExtension = workDocumentFileExtension(parsed.data.key);
  if (extension !== keyExtension) {
    return apiError("Nama berkas tidak sesuai dengan jenis berkas yang diunggah.");
  }

  const ownerSegment = user.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!parsed.data.key.startsWith(`documents/${ownerSegment}/`)) {
    return apiError("Kunci unggahan bukan milik akun ini.", 403);
  }

  const key = parsed.data.key;
  let uploadedObject = false;
  try {
    // Pengulangan penyelesaian (mis. retry jaringan) mengembalikan dokumen
    // yang sudah tersimpan tanpa memeriksa ulang kuota atau menghapus objeknya.
    const [alreadySaved] = await query(
      "SELECT * FROM work_documents WHERE storage_key=$1 AND owner_id=$2",
      [key, user.id],
    );
    if (alreadySaved) {
      return apiOk({
        document: uploadedDocument(toWorkDocument(alreadySaved)),
      });
    }

    const settings = await getWorkDocumentSettings();
    if (!settings.uploadsEnabled) {
      throw new WorkDocumentError(
        "Unggahan dokumen kerja sedang dinonaktifkan oleh super admin.",
        403,
      );
    }
    if (!(settings.allowedExtensions as string[]).includes(extension)) {
      throw new WorkDocumentError(
        "Jenis berkas ini tidak lagi diizinkan oleh pengaturan.",
      );
    }

    const object = await statDocumentObject(key);
    if (!object) {
      throw new WorkDocumentError(
        "Berkas belum selesai diunggah. Silakan unggah ulang.",
        400,
      );
    }
    uploadedObject = true;

    const sizeBytes = object.contentLength;
    if (!sizeBytes || sizeBytes <= 0) {
      throw new WorkDocumentError("Berkas kosong tidak dapat disimpan.");
    }
    if (sizeBytes !== parsed.data.sizeBytes) {
      throw new WorkDocumentError(
        "Ukuran berkas tidak sesuai dengan data unggahan. Silakan unggah ulang.",
      );
    }
    const isVideo = isWorkDocumentVideo(extension);
    const maxBytes = isVideo
      ? Math.min(settings.maxVideoBytes, WORK_DOCUMENT_HARD_MAX_BYTES)
      : Math.min(settings.maxFileBytes, WORK_DOCUMENT_HARD_MAX_BYTES);
    if (sizeBytes > maxBytes) {
      throw new WorkDocumentError(
        `Ukuran ${isVideo ? "video" : "berkas"} melebihi batas ${formatDocumentBytes(maxBytes)}.`,
        413,
      );
    }

    const prefix = await readDocumentObjectPrefix(key);
    if (!hasValidWorkDocumentMagic(prefix, extension)) {
      throw new WorkDocumentError(
        "Isi berkas tidak sesuai dengan jenis berkasnya.",
      );
    }

    // Video tidak di-hash di perangkat (berkas 100 MB tidak muat di memori
    // ponsel). ETag dari storage dipakai sebagai sidik jari isi.
    const checksum = isVideo
      ? (parsed.data.checksumSha256?.toLowerCase() ??
        object.etag?.toLowerCase() ??
        null)
      : (parsed.data.checksumSha256?.toLowerCase() ?? null);
    if (!checksum) {
      throw new WorkDocumentError(
        "Checksum berkas tidak tersedia. Silakan unggah ulang.",
      );
    }

    const used = await workDocumentUsedBytes(pool(), user.id);
    if (used + sizeBytes > settings.quotaBytes) {
      throw new WorkDocumentError(
        `Kuota dokumen tidak cukup. Terpakai ${formatDocumentBytes(used)} dari ${formatDocumentBytes(settings.quotaBytes)}.`,
        413,
      );
    }

    const result = await transaction(async (connection) => {
      // Serialisasi penyelesaian unggahan per pemilik agar dua unggahan
      // bersamaan tidak dapat melewati kuota.
      await query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [`work-document-upload:${user.id}`],
        connection,
      );

      const [existing] = await query(
        "SELECT * FROM work_documents WHERE storage_key=$1",
        [key],
        connection,
      );
      if (existing) {
        if (existing.owner_id !== user.id) {
          throw new WorkDocumentError("Kunci unggahan bukan milik akun ini.", 403);
        }
        return { document: toWorkDocument(existing), created: false };
      }

      // Kunci pengaturan agar batas tidak berubah di tengah pemeriksaan kuota.
      await query(
        "SELECT 1 FROM work_document_settings WHERE id='settings' FOR SHARE",
        [],
        connection,
      );
      const current = await getWorkDocumentSettings(connection);
      if (!current.uploadsEnabled) {
        throw new WorkDocumentError(
          "Unggahan dokumen kerja sedang dinonaktifkan oleh super admin.",
          403,
        );
      }
      if (!(current.allowedExtensions as string[]).includes(extension)) {
        throw new WorkDocumentError(
          "Jenis berkas ini tidak lagi diizinkan oleh pengaturan.",
        );
      }
      const limit = isVideo
        ? Math.min(current.maxVideoBytes, WORK_DOCUMENT_HARD_MAX_BYTES)
        : Math.min(current.maxFileBytes, WORK_DOCUMENT_HARD_MAX_BYTES);
      if (sizeBytes > limit) {
        throw new WorkDocumentError(
          `Ukuran ${isVideo ? "video" : "berkas"} melebihi batas ${formatDocumentBytes(limit)}.`,
        );
      }
      if (parsed.data.folderId) {
        await assertOwnedFolder(connection, parsed.data.folderId, user.id);
      }
      const usedNow = await workDocumentUsedBytes(connection, user.id);
      if (usedNow + sizeBytes > current.quotaBytes) {
        throw new WorkDocumentError(
          `Kuota dokumen tidak cukup. Terpakai ${formatDocumentBytes(usedNow)} dari ${formatDocumentBytes(current.quotaBytes)}.`,
          413,
        );
      }

      const id = `doc_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const title =
        parsed.data.title ||
        path.basename(fileName, path.extname(fileName)).trim().slice(0, 160) ||
        "Dokumen tanpa nama";
      const mimeType =
        WORK_DOCUMENT_MIME[extension as WorkDocumentExtension];

      await query(
        `INSERT INTO work_documents
          (id,owner_id,title,description,storage_key,file_name,extension,mime_type,
           size_bytes,checksum_sha256,created_at,updated_at,folder_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12)`,
        [
          id,
          user.id,
          title,
          parsed.data.description,
          key,
          fileName,
          extension,
          mimeType,
          sizeBytes,
          checksum,
          now,
          parsed.data.folderId,
        ],
        connection,
      );

      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "dokumen_diunggah",
        objectType: "dokumen",
        objectId: id,
        summary: `${user.name} mengunggah dokumen kerja "${title}".`,
        after: {
          id,
          title,
          fileName,
          extension,
          sizeBytes,
        },
      });

      return {
        document: toWorkDocument({
          id,
          owner_id: user.id,
          folder_id: parsed.data.folderId,
          title,
          description: parsed.data.description,
          storage_key: key,
          file_name: fileName,
          extension,
          mime_type: mimeType,
          size_bytes: sizeBytes,
          checksum_sha256: checksum,
          created_at: now,
          updated_at: now,
        }),
        created: true,
      };
    });

    return apiOk(
      { document: uploadedDocument(result.document) },
      result.created ? 201 : 200,
    );
  } catch (error) {
    if (uploadedObject) {
      const [existing] = await query(
        "SELECT 1 FROM work_documents WHERE storage_key=$1",
        [key],
      ).catch(() => []);
      if (!existing) {
        await deleteDocumentObject(key).catch((cleanupError) => {
          console.error(
            "Gagal membersihkan objek unggahan dokumen:",
            cleanupError,
          );
        });
      }
    }
    if (error instanceof WorkDocumentError) {
      return apiError(error.message, error.status);
    }
    console.error("Penyelesaian unggahan dokumen gagal:", error);
    return apiError(
      "Dokumen gagal diselesaikan. Silakan unggah ulang.",
      500,
    );
  }
}
