import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertAudit } from "@/lib/audit";
import { pool, query, transaction } from "@/lib/db";
import { rowToCamel } from "@/lib/db-model";
import {
  assertEvidenceVideoKey,
  evidenceVideoCompleteSchema,
  evidenceVideoFileName,
  formatVideoBytes,
  maxEvidenceVideoBytes,
  verifyEvidenceVideoObject,
} from "@/lib/evidence-video";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import {
  canAccessManualWork,
  loadManualWork,
} from "@/lib/manual-work-access";
import { manualWorkErrorMessage } from "@/lib/manual-work-errors";
import type { ManualWorkStatus } from "@/lib/manual-work-types";
import { getPhotoLimits } from "@/lib/photo-limits";
import { deleteObject } from "@/lib/storage";
import { isVideoMime } from "@/lib/video";

export const maxDuration = 30;

const ACTIVE_STATUSES: ManualWorkStatus[] = ["terbuka", "dikerjakan"];

/** Langkah kedua video pekerjaan: verifikasi objek, lalu simpan bukti. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = evidenceVideoCompleteSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const { key, mimeType, sizeBytes, durationSeconds, caption } = parsed.data;
  if (!isVideoMime(mimeType)) {
    return apiError("Format video harus MP4, WEBM, atau MOV.");
  }
  if (!assertEvidenceVideoKey(key, `pekerjaan/${id}/`, mimeType)) {
    return apiError("Kunci unggahan video bukan milik pekerjaan ini.", 403);
  }
  if ((caption?.length ?? 0) > 300) {
    return apiError("Keterangan video maksimal 300 karakter.");
  }

  const [alreadySaved] = await query(
    `SELECT * FROM manual_work_photos WHERE storage_key=$1`,
    [key],
  );
  if (alreadySaved) {
    if (alreadySaved.uploaded_by !== user.id) {
      return apiError("Kunci unggahan video bukan milik akun ini.", 403);
    }
    return apiOk({
      photo: rowToCamel(alreadySaved),
      message: "Video pekerjaan sudah tersimpan.",
    });
  }

  const limits = await getPhotoLimits();
  if (!limits.videoEnabled) {
    return apiError("Unggah video sedang dinonaktifkan oleh super admin.", 403);
  }
  if (limits.workVideos <= 0) {
    return apiError("Unggah video pekerjaan sedang dinonaktifkan.", 403);
  }
  const maxBytes = maxEvidenceVideoBytes(limits.maxVideoBytes);
  if (sizeBytes > maxBytes) {
    return apiError(
      `Ukuran video ${formatVideoBytes(sizeBytes)} melebihi batas ${formatVideoBytes(maxBytes)}.`,
      413,
    );
  }

  let objectStored = false;
  try {
    const object = await verifyEvidenceVideoObject(key, mimeType, sizeBytes);
    objectStored = true;

    const fileName = evidenceVideoFileName(parsed.data.fileName, mimeType);
    const photo = await transaction(async (connection) => {
      // Parent-first lock, lalu validasi ulang seluruh syarat unggah.
      const work = await loadManualWork(connection, id, true);
      if (!work) throw new Error("Pekerjaan tidak ditemukan.");
      if (!(await canAccessManualWork(connection, user, work))) {
        throw new Error("Kamu tidak ditugaskan pada pekerjaan ini.");
      }
      if (!ACTIVE_STATUSES.includes(work.status)) {
        throw new Error(
          "Pekerjaan sudah ditutup. Minta pemilik pekerjaan membuka kembali sebelum menambah video.",
        );
      }

      const duplicate = await query(
        `SELECT * FROM manual_work_photos WHERE storage_key=$1`,
        [key],
        connection,
      );
      if (duplicate[0]) return rowToCamel(duplicate[0]);

      const [count] = await query<{ total: number }>(
        `SELECT count(*)::integer total FROM manual_work_photos
         WHERE work_id=$1 AND kind='video'`,
        [id],
        connection,
      );
      const { workVideos: currentLimit } = await getPhotoLimits(connection);
      if ((count?.total ?? 0) >= currentLimit) {
        throw new Error(`Maksimal ${currentLimit} video per pekerjaan.`);
      }

      const now = new Date().toISOString();
      const photoId = `mwp_${crypto.randomUUID()}`;
      await query(
        `INSERT INTO manual_work_photos
          (id,work_id,uploaded_by,storage_provider,storage_key,file_name,
           mime_type,size_bytes,caption,taken_at,capture_source,created_at,
           kind,duration_seconds,storage_etag)
         VALUES ($1,$2,$3,'s3',$4,$5,$6,$7,$8,NULL,NULL,$9,'video',$10,$11)`,
        [
          photoId,
          id,
          user.id,
          key,
          fileName,
          mimeType,
          sizeBytes,
          caption ?? "",
          now,
          durationSeconds ?? null,
          object.etag,
        ],
        connection,
      );
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "pekerjaan_video_diunggah",
        objectType: "pekerjaan",
        objectId: id,
        summary: `${user.name} menambahkan video dokumentasi pekerjaan "${work.title}".`,
        after: {
          photoId,
          fileName,
          sizeBytes,
          caption: caption ?? "",
          durationSeconds: durationSeconds ?? null,
        },
      });

      return {
        id: photoId,
        workId: id,
        uploadedBy: user.id,
        storageProvider: "s3" as const,
        storageKey: key,
        fileName,
        mimeType,
        sizeBytes,
        caption: caption ?? "",
        takenAt: null,
        captureSource: null,
        kind: "video" as const,
        durationSeconds: durationSeconds ?? null,
        createdAt: now,
      };
    });

    return apiOk({ photo, message: "Video dokumentasi diunggah." }, 201);
  } catch (error) {
    if (objectStored) {
      const [row] = await query(
        `SELECT 1 FROM manual_work_photos WHERE storage_key=$1`,
        [key],
      ).catch(() => []);
      if (!row) {
        await deleteObject(key, "s3").catch((cleanupError) => {
          console.error("Gagal membersihkan video pekerjaan:", cleanupError);
        });
      }
    }
    return apiError(manualWorkErrorMessage(error));
  }
}
