import path from "node:path";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertAudit } from "@/lib/audit";
import {
  canAccessManualWork,
  loadManualWork,
} from "@/lib/manual-work-access";
import { manualWorkErrorMessage } from "@/lib/manual-work-errors";
import {
  MANUAL_WORK_MAX_PHOTOS,
  type ManualWorkStatus,
} from "@/lib/manual-work-types";
import { UPLOAD_MAX_BYTES } from "@/lib/constants";
import { pool, query, transaction } from "@/lib/db";
import {
  MANUAL_WORK_MARKER_PREFIX,
  parseManualWorkMarker,
  readSibumaJpegComment,
} from "@/lib/documentation-marker";
import { apiError, apiOk } from "@/lib/http";
import { deleteObject, putObject } from "@/lib/storage";
import { zonedToIso } from "@/lib/time";

export const maxDuration = 30;

const CAPTURE_FUTURE_TOLERANCE_MS = 10 * 60_000;
const CAPTURE_BEFORE_START_TOLERANCE_MS = 24 * 60 * 60_000;

const ACCEPTED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const ACTIVE_STATUSES: ManualWorkStatus[] = ["terbuka", "dikerjakan"];

function matchesMagicBytes(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const { id } = await params;
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Data unggahan tidak valid.");
  }

  const file = formData.get("file");
  const captionRaw = formData.get("caption");
  const caption = typeof captionRaw === "string" ? captionRaw.trim() : "";

  if (!(file instanceof File)) return apiError("Pilih foto yang akan diunggah.");
  if (caption.length > 300) {
    return apiError("Keterangan foto maksimal 300 karakter.");
  }
  if (file.size <= 0) return apiError("File foto kosong.");
  if (file.size > UPLOAD_MAX_BYTES) {
    return apiError(
      `Ukuran foto melebihi batas ${(UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(1)} MB setelah kompresi.`,
    );
  }
  const extension = ACCEPTED_TYPES[file.type];
  if (!extension) return apiError("Format foto harus JPG, PNG, atau WEBP.");

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!matchesMagicBytes(buffer, file.type)) {
    return apiError("Isi file tidak sesuai dengan format gambarnya.");
  }

  // Foto harus melewati proses cap waktu SIBUMA di klien. Ini menutup unggahan
  // file mentah tanpa timestamp, meski bukan bukti anti-palsu.
  const capture = parseManualWorkMarker(
    readSibumaJpegComment(buffer, MANUAL_WORK_MARKER_PREFIX),
  );
  if (!capture) {
    return apiError(
      "Foto tidak memiliki cap waktu SIBUMA. Pilih ulang lewat tombol Kamera atau Galeri agar waktu foto tercetak.",
    );
  }
  const capturedAt = new Date(capture.takenAt).getTime();
  if (capturedAt > new Date().getTime() + CAPTURE_FUTURE_TOLERANCE_MS) {
    return apiError(
      "Waktu foto berada di masa depan. Periksa jam perangkat, lalu pilih ulang foto.",
    );
  }

  const safeFileName = path.basename(file.name || `pekerjaan.${extension}`);
  const storageKey = `pekerjaan/${id}/${crypto.randomUUID()}.${extension}`;
  let stored = false;

  try {
    // Authorize before touching storage. The external upload stays outside the
    // database transaction so a retry can never duplicate the object.
    const work = await loadManualWork(pool(), id);
    if (!work) return apiError("Pekerjaan tidak ditemukan.", 404);
    if (!(await canAccessManualWork(pool(), user, work))) {
      return apiError("Kamu tidak ditugaskan pada pekerjaan ini.", 403);
    }
    if (!ACTIVE_STATUSES.includes(work.status)) {
      return apiError(
        "Pekerjaan sudah ditutup. Minta pemilik pekerjaan membuka kembali sebelum menambah foto.",
      );
    }
    const [before] = await query<{ total: number }>(
      `SELECT count(*)::integer total FROM manual_work_photos WHERE work_id=$1`,
      [id],
    );
    if ((before?.total ?? 0) >= MANUAL_WORK_MAX_PHOTOS) {
      return apiError(`Maksimal ${MANUAL_WORK_MAX_PHOTOS} foto per pekerjaan.`);
    }

    await putObject(storageKey, buffer, file.type);
    stored = true;

    const photo = await transaction(async (connection) => {
      // Parent-first lock, then revalidate everything checked before upload.
      const current = await loadManualWork(connection, id, true);
      if (!current) throw new Error("Pekerjaan tidak ditemukan.");
      if (!(await canAccessManualWork(connection, user, current))) {
        throw new Error("Kamu tidak ditugaskan pada pekerjaan ini.");
      }
      if (!ACTIVE_STATUSES.includes(current.status)) {
        throw new Error(
          "Pekerjaan sudah ditutup. Minta pemilik pekerjaan membuka kembali sebelum menambah foto.",
        );
      }
      if (capture.workId !== current.id) {
        throw new Error(
          "Cap waktu foto berasal dari pekerjaan lain. Pilih ulang foto dari formulir pekerjaan ini.",
        );
      }
      const startAt = new Date(
        zonedToIso(current.startDate, "00:00"),
      ).getTime();
      if (capturedAt < startAt - CAPTURE_BEFORE_START_TOLERANCE_MS) {
        throw new Error(
          "Waktu foto lebih dari 24 jam sebelum tanggal mulai pekerjaan. Pilih foto yang diambil saat pekerjaan berlangsung.",
        );
      }
      const [count] = await query<{ total: number }>(
        `SELECT count(*)::integer total FROM manual_work_photos WHERE work_id=$1`,
        [id],
        connection,
      );
      if ((count?.total ?? 0) >= MANUAL_WORK_MAX_PHOTOS) {
        throw new Error(`Maksimal ${MANUAL_WORK_MAX_PHOTOS} foto per pekerjaan.`);
      }

      const now = new Date().toISOString();
      const photoId = `mwp_${crypto.randomUUID()}`;
      await query(
        `INSERT INTO manual_work_photos
          (id,work_id,uploaded_by,storage_provider,storage_key,file_name,
           mime_type,size_bytes,caption,taken_at,capture_source,created_at)
         VALUES ($1,$2,$3,'s3',$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          photoId,
          id,
          user.id,
          storageKey,
          safeFileName,
          file.type,
          buffer.length,
          caption,
          capture.takenAt,
          capture.source,
          now,
        ],
        connection,
      );
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "pekerjaan_foto_diunggah",
        objectType: "pekerjaan",
        objectId: id,
        summary: `${user.name} menambahkan foto dokumentasi pekerjaan "${current.title}".`,
        after: {
          photoId,
          fileName: safeFileName,
          sizeBytes: buffer.length,
          caption,
          takenAt: capture.takenAt,
          captureSource: capture.source,
        },
      });
      return {
        id: photoId,
        workId: id,
        uploadedBy: user.id,
        storageProvider: "s3" as const,
        storageKey,
        fileName: safeFileName,
        mimeType: file.type,
        sizeBytes: buffer.length,
        caption,
        takenAt: capture.takenAt,
        captureSource: capture.source,
        createdAt: now,
      };
    });
    return apiOk({ photo, message: "Foto dokumentasi diunggah." }, 201);
  } catch (error) {
    if (stored) await deleteObject(storageKey, "s3").catch(() => undefined);
    return apiError(manualWorkErrorMessage(error));
  }
}
