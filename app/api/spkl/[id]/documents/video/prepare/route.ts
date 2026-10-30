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
import { getPhotoLimits } from "@/lib/photo-limits";
import { getPolicy } from "@/lib/queries";
import { presignObjectUpload } from "@/lib/storage";
import { isVideoMime } from "@/lib/video";

export const maxDuration = 30;

/**
 * Langkah pertama video dokumentasi SPKL: periksa hak unggah dan batas, lalu
 * terbitkan URL PUT sementara. Byte video dikirim browser langsung ke storage
 * agar tidak melewati batas payload fungsi serverless.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "pekerja") {
    return apiError(
      "Hanya pekerja pada SPKL ini yang dapat mengunggah dokumentasi.",
      403,
    );
  }

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
  if (limits.spklVideos <= 0) {
    return apiError("Unggah video dokumentasi SPKL sedang dinonaktifkan.", 403);
  }
  const maxBytes = maxEvidenceVideoBytes(limits.maxVideoBytes);
  if (sizeBytes > maxBytes) {
    return apiError(
      `Ukuran video ${formatVideoBytes(sizeBytes)} melebihi batas ${formatVideoBytes(maxBytes)}.`,
      413,
    );
  }

  const [spkl] = await query(
    `SELECT id,number,end_at,canceled_at FROM spkls WHERE id=$1`,
    [id],
  );
  if (!spkl) return apiError("SPKL tidak ditemukan.", 404);
  if (spkl.canceled_at) return apiError("SPKL ini sudah dibatalkan.");

  const [assigned] = await query(
    `SELECT 1 FROM spkl_workers WHERE spkl_id=$1 AND employee_id=$2`,
    [id, user.id],
  );
  if (!assigned) return apiError("Kamu tidak ditugaskan pada SPKL ini.", 403);

  const [attendance] = await query(
    `SELECT id,check_in_at,status FROM attendances WHERE spkl_id=$1 AND employee_id=$2`,
    [id, user.id],
  );
  if (!attendance?.check_in_at || attendance.status === "tidak_hadir") {
    return apiError(
      "Kamu harus absen masuk terlebih dahulu sebelum mengunggah dokumentasi.",
    );
  }

  const policy = await getPolicy();
  const lockAt =
    new Date(spkl.end_at as string).getTime() +
    policy.docGraceMinutes * 60_000;
  if (Date.now() > lockAt) {
    return apiError(
      "Waktu unggah dokumentasi sudah berakhir. Hubungi atasan jika ada kendala.",
    );
  }

  const [count] = await query<{ total: number }>(
    `SELECT count(*)::integer total FROM documentations
     WHERE attendance_id=$1 AND kind='video'`,
    [attendance.id],
  );
  if ((count?.total ?? 0) >= limits.spklVideos) {
    return apiError(
      `Batas maksimal ${limits.spklVideos} video per sesi sudah tercapai.`,
    );
  }

  try {
    const key = evidenceVideoKey(`${id}/`, mimeType);
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
      remaining: limits.spklVideos - (count?.total ?? 0),
    });
  } catch (error) {
    console.error("Gagal membuat URL unggah video SPKL:", error);
    return apiError(
      "URL unggah video gagal dibuat. Silakan coba lagi.",
      500,
    );
  }
}
