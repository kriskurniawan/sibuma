import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import {
  assertChecklistVideoTarget,
  countChecklistVideos,
} from "@/lib/checklist-video-access";
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
import { getPhotoLimits } from "@/lib/photo-limits";
import { deleteObject } from "@/lib/storage";
import { isVideoMime } from "@/lib/video";

export const maxDuration = 30;

const completeSchema = evidenceVideoCompleteSchema.extend({
  answerId: z.string().trim().min(1).nullish(),
  followUpId: z.string().trim().min(1).nullish(),
  stage: z.enum(["temuan", "perbaikan"]).optional(),
});

/** Langkah kedua video checklist: verifikasi objek, lalu simpan bukti. */
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
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const { key, mimeType, sizeBytes, durationSeconds, caption, stage } =
    parsed.data;
  const answerId = parsed.data.answerId ?? null;
  const followUpId = parsed.data.followUpId ?? null;
  if (!isVideoMime(mimeType)) {
    return apiError("Format video harus MP4, WEBM, atau MOV.");
  }
  if (!assertEvidenceVideoKey(key, `checklist/${id}/`, mimeType)) {
    return apiError("Kunci unggahan video bukan milik checklist ini.", 403);
  }
  if ((caption?.length ?? 0) > 300) {
    return apiError("Keterangan video maksimal 300 karakter.");
  }

  const [alreadySaved] = await query(
    `SELECT * FROM checklist_photos WHERE storage_key=$1`,
    [key],
  );
  if (alreadySaved) {
    if (alreadySaved.uploaded_by !== user.id) {
      return apiError("Kunci unggahan video bukan milik akun ini.", 403);
    }
    return apiOk({
      photo: rowToCamel(alreadySaved),
      message: "Video checklist sudah tersimpan.",
    });
  }

  const limits = await getPhotoLimits();
  if (!limits.videoEnabled) {
    return apiError("Unggah video sedang dinonaktifkan oleh super admin.", 403);
  }
  if (limits.checklistVideos <= 0) {
    return apiError("Unggah video checklist sedang dinonaktifkan.", 403);
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
      await assertChecklistVideoTarget(user, id, answerId, followUpId, {
        connection,
        lock: true,
      });
      const effectiveStage = followUpId ? "perbaikan" : (stage ?? "temuan");

      const duplicate = await query(
        `SELECT * FROM checklist_photos WHERE storage_key=$1`,
        [key],
        connection,
      );
      if (duplicate[0]) return rowToCamel(duplicate[0]);

      const used = await countChecklistVideos(
        connection,
        id,
        answerId,
        followUpId,
      );
      const { checklistVideos: currentLimit } = await getPhotoLimits(connection);
      if (used >= currentLimit) {
        throw new Error(
          `Maksimal ${currentLimit} video per item atau tindak lanjut.`,
        );
      }

      const now = new Date().toISOString();
      const photoId = `cp_${crypto.randomUUID()}`;
      await query(
        `INSERT INTO checklist_photos
          (id,inspection_id,answer_id,follow_up_id,uploaded_by,storage_provider,
           storage_key,file_name,mime_type,size_bytes,caption,stage,created_at,
           kind,duration_seconds,storage_etag)
         VALUES ($1,$2,$3,$4,$5,'s3',$6,$7,$8,$9,$10,$11,$12,'video',$13,$14)`,
        [
          photoId,
          id,
          answerId,
          followUpId,
          user.id,
          key,
          fileName,
          mimeType,
          sizeBytes,
          caption ?? "",
          effectiveStage,
          now,
          durationSeconds ?? null,
          object.etag,
        ],
        connection,
      );
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "checklist_video_diunggah",
        objectType: "checklist",
        objectId: id,
        summary: followUpId
          ? `${user.name} menambahkan video perbaikan tindak lanjut.`
          : `${user.name} menambahkan video checklist.`,
        after: {
          photoId,
          answerId,
          followUpId,
          stage: effectiveStage,
          sizeBytes,
          durationSeconds: durationSeconds ?? null,
        },
      });

      return {
        id: photoId,
        inspectionId: id,
        answerId,
        followUpId,
        uploadedBy: user.id,
        storageProvider: "s3",
        storageKey: key,
        fileName,
        mimeType,
        sizeBytes,
        caption: caption ?? "",
        stage: effectiveStage,
        kind: "video",
        durationSeconds: durationSeconds ?? null,
        createdAt: now,
      };
    });

    return apiOk({ photo, message: "Video checklist diunggah." }, 201);
  } catch (error) {
    if (objectStored) {
      const [row] = await query(
        `SELECT 1 FROM checklist_photos WHERE storage_key=$1`,
        [key],
      ).catch(() => []);
      if (!row) {
        await deleteObject(key, "s3").catch((cleanupError) => {
          console.error("Gagal membersihkan video checklist:", cleanupError);
        });
      }
    }
    return apiError(checklistErrorMessage(error));
  }
}
