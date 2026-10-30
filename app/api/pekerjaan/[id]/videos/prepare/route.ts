import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { pool, query } from "@/lib/db";
import {
  evidenceVideoKey,
  evidenceVideoPrepareSchema,
  formatVideoBytes,
  maxEvidenceVideoBytes,
} from "@/lib/evidence-video";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import {
  canAccessManualWork,
  loadManualWork,
} from "@/lib/manual-work-access";
import { manualWorkErrorMessage } from "@/lib/manual-work-errors";
import type { ManualWorkStatus } from "@/lib/manual-work-types";
import { getPhotoLimits } from "@/lib/photo-limits";
import { presignObjectUpload } from "@/lib/storage";
import { isVideoMime } from "@/lib/video";

export const maxDuration = 30;

const ACTIVE_STATUSES: ManualWorkStatus[] = ["terbuka", "dikerjakan"];

/** Langkah pertama video pekerjaan: otorisasi, batas, lalu URL PUT sementara. */
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
  const parsed = evidenceVideoPrepareSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const { fileName, mimeType, sizeBytes } = parsed.data;
  if (!isVideoMime(mimeType)) {
    return apiError("Format video harus MP4, WEBM, atau MOV.");
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

  try {
    const work = await loadManualWork(pool(), id);
    if (!work) return apiError("Pekerjaan tidak ditemukan.", 404);
    if (!(await canAccessManualWork(pool(), user, work))) {
      return apiError("Kamu tidak ditugaskan pada pekerjaan ini.", 403);
    }
    if (!ACTIVE_STATUSES.includes(work.status)) {
      return apiError(
        "Pekerjaan sudah ditutup. Minta pemilik pekerjaan membuka kembali sebelum menambah video.",
      );
    }

    const [count] = await query<{ total: number }>(
      `SELECT count(*)::integer total FROM manual_work_photos
       WHERE work_id=$1 AND kind='video'`,
      [id],
    );
    if ((count?.total ?? 0) >= limits.workVideos) {
      return apiError(`Maksimal ${limits.workVideos} video per pekerjaan.`);
    }

    const key = evidenceVideoKey(`pekerjaan/${id}/`, mimeType);
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
      remaining: limits.workVideos - (count?.total ?? 0),
    });
  } catch (error) {
    return apiError(manualWorkErrorMessage(error));
  }
}
