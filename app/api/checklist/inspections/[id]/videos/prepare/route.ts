import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import {
  assertChecklistVideoTarget,
  countChecklistVideos,
} from "@/lib/checklist-video-access";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import {
  evidenceVideoKey,
  evidenceVideoPrepareSchema,
  formatVideoBytes,
  maxEvidenceVideoBytes,
} from "@/lib/evidence-video";
import { pool } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { getPhotoLimits } from "@/lib/photo-limits";
import { presignObjectUpload } from "@/lib/storage";
import { isVideoMime } from "@/lib/video";

export const maxDuration = 30;

const prepareSchema = evidenceVideoPrepareSchema.extend({
  answerId: z.string().trim().min(1).nullish(),
  followUpId: z.string().trim().min(1).nullish(),
});

/** Langkah pertama video checklist: otorisasi, batas, lalu URL PUT sementara. */
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
  const parsed = prepareSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const { fileName, mimeType, sizeBytes } = parsed.data;
  if (!isVideoMime(mimeType)) {
    return apiError("Format video harus MP4, WEBM, atau MOV.");
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

  const answerId = parsed.data.answerId ?? null;
  const followUpId = parsed.data.followUpId ?? null;
  try {
    await assertChecklistVideoTarget(user, id, answerId, followUpId);
    const used = await countChecklistVideos(pool(), id, answerId, followUpId);
    if (used >= limits.checklistVideos) {
      return apiError(
        `Batas maksimal ${limits.checklistVideos} video per item atau tindak lanjut.`,
      );
    }

    const key = evidenceVideoKey(`checklist/${id}/`, mimeType);
    const upload = await presignObjectUpload(key, mimeType, sizeBytes);
    const safeName = `${fileName.split(/[\\/]/).pop() ?? fileName}`.slice(
      0,
      200,
    );
    return apiOk({
      upload: {
        key,
        url: upload.uploadUrl,
        method: "PUT",
        headers: { "Content-Type": mimeType },
        expiresIn: upload.expiresIn,
        fileName: safeName,
      },
      maxBytes,
      remaining: limits.checklistVideos - used,
    });
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
