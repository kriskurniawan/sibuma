import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { query } from "@/lib/db";
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
import { mutateDb, pushAudit } from "@/lib/store";
import type { Documentation } from "@/lib/types";
import { isVideoMime } from "@/lib/video";

export const maxDuration = 30;

/**
 * Langkah kedua video dokumentasi SPKL: ukuran, tipe, dan container objek
 * diverifikasi ulang, lalu baris dokumentasi dibuat. Objek yang gagal
 * diselesaikan dihapus agar tidak menjadi yatim.
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
  const parsed = evidenceVideoCompleteSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const { key, mimeType, sizeBytes, durationSeconds, caption } = parsed.data;
  if (!isVideoMime(mimeType)) {
    return apiError("Format video harus MP4, WEBM, atau MOV.");
  }
  if (!assertEvidenceVideoKey(key, `${id}/`, mimeType)) {
    return apiError("Kunci unggahan video bukan milik SPKL ini.", 403);
  }

  // Pengulangan penyelesaian (mis. retry jaringan) tidak membuat baris ganda.
  const [alreadySaved] = await query(
    `SELECT * FROM documentations WHERE storage_key=$1`,
    [key],
  );
  if (alreadySaved) {
    if (alreadySaved.employee_id !== user.id) {
      return apiError("Kunci unggahan video bukan milik akun ini.", 403);
    }
    return apiOk({
      documentation: rowToCamel(alreadySaved),
      message: "Dokumentasi video sudah tersimpan.",
    });
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

  let objectStored = false;
  try {
    const object = await verifyEvidenceVideoObject(key, mimeType, sizeBytes);
    objectStored = true;

    const fileName = evidenceVideoFileName(parsed.data.fileName, mimeType);
    const documentation = await mutateDb({ kind: "spkl", id }, async (db) => {
      const spkl = db.spkls.find((item) => item.id === id);
      if (!spkl) throw new Error("SPKL tidak ditemukan.");
      if (spkl.canceledAt) throw new Error("SPKL ini sudah dibatalkan.");

      const assigned = db.spklWorkers.some(
        (item) => item.spklId === spkl.id && item.employeeId === user.id,
      );
      if (!assigned) throw new Error("Kamu tidak ditugaskan pada SPKL ini.");

      const attendance = db.attendances.find(
        (item) => item.spklId === spkl.id && item.employeeId === user.id,
      );
      if (!attendance?.checkInAt || attendance.status === "tidak_hadir") {
        throw new Error(
          "Kamu harus absen masuk terlebih dahulu sebelum mengunggah dokumentasi.",
        );
      }

      const lockAt =
        new Date(spkl.endAt).getTime() + db.policy.docGraceMinutes * 60_000;
      if (Date.now() > lockAt) {
        throw new Error(
          "Waktu unggah dokumentasi sudah berakhir. Hubungi atasan jika ada kendala.",
        );
      }

      const duplicate = db.documentations.find(
        (item) => item.storageKey === key,
      );
      if (duplicate) return duplicate;

      const videoCount = db.documentations.filter(
        (item) =>
          item.attendanceId === attendance.id &&
          (item.kind ?? "photo") === "video",
      ).length;
      if (videoCount >= limits.spklVideos) {
        throw new Error(
          `Batas maksimal ${limits.spklVideos} video per sesi sudah tercapai.`,
        );
      }

      const now = new Date().toISOString();
      const doc: Documentation = {
        id: `doc_${crypto.randomUUID()}`,
        spklId: spkl.id,
        attendanceId: attendance.id,
        employeeId: user.id,
        storageProvider: "s3",
        storageKey: key,
        fileName,
        mimeType,
        sizeBytes,
        // Video tidak punya cap waktu di dalam berkas; keterangan tetap
        // opsional dan waktu unggah server dipakai sebagai takenAt.
        description:
          caption?.trim() || `Video dokumentasi ${spkl.number}.`,
        takenAt: now,
        location: null,
        kind: "video",
        durationSeconds: durationSeconds ?? null,
        posterKey: null,
        storageEtag: object.etag,
        createdAt: now,
      };

      db.documentations.push(doc);
      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "dokumentasi_diunggah",
        objectType: "absensi",
        objectId: attendance.id,
        summary: `${user.name} menambahkan video dokumentasi pada ${spkl.number}.`,
        after: {
          documentationId: doc.id,
          kind: "video",
          description: doc.description,
          sizeBytes: doc.sizeBytes,
          durationSeconds: doc.durationSeconds,
        },
      });

      return doc;
    });

    return apiOk(
      { documentation, message: "Video dokumentasi berhasil disimpan." },
      201,
    );
  } catch (error) {
    if (objectStored) {
      const [row] = await query(
        `SELECT 1 FROM documentations WHERE storage_key=$1`,
        [key],
      ).catch(() => []);
      if (!row) {
        await deleteObject(key, "s3").catch((cleanupError) => {
          console.error("Gagal membersihkan video SPKL:", cleanupError);
        });
      }
    }
    return apiError(
      error instanceof Error
        ? error.message
        : "Gagal menyimpan video dokumentasi.",
    );
  }
}
