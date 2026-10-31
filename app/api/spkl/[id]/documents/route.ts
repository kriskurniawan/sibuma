import path from "node:path";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { UPLOAD_MAX_BYTES } from "@/lib/constants";
import {
  parseDocumentationMarker,
  readSibumaJpegComment,
} from "@/lib/documentation-marker";
import { apiError, apiOk } from "@/lib/http";
import { getPhotoLimits } from "@/lib/photo-limits";
import { deleteObject, putObject } from "@/lib/storage";
import { mutateDb, pushAudit } from "@/lib/store";
import type {
  Documentation,
  GeoPoint,
  StorageProvider,
} from "@/lib/types";
import { validCoordinate } from "@/lib/geo";

export const maxDuration = 30;

const ACCEPTED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Batas toleransi jam perangkat terhadap waktu server. */
const CAPTURE_FUTURE_TOLERANCE_MS = 10 * 60_000;
const CAPTURE_BEFORE_START_TOLERANCE_MS = 24 * 60 * 60_000;

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

function parseLocation(raw: FormDataEntryValue | null): GeoPoint | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      latitude?: unknown;
      longitude?: unknown;
    };
    if (
      typeof parsed.latitude !== "number" ||
      typeof parsed.longitude !== "number" ||
      !validCoordinate(parsed.latitude, parsed.longitude)
    ) {
      return null;
    }
    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
    };
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "pekerja") {
    return apiError("Hanya pekerja pada SPKL ini yang dapat mengunggah dokumentasi.", 403);
  }

  const { id } = await params;
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Data unggahan tidak valid.");
  }

  const file = formData.get("file");
  const descriptionRaw = formData.get("description");
  const description =
    typeof descriptionRaw === "string" ? descriptionRaw.trim() : "";
  const location = parseLocation(formData.get("location"));

  if (!(file instanceof File)) {
    return apiError("Pilih foto yang akan diunggah.");
  }
  if (description.length < 3) {
    return apiError("Tambahkan deskripsi minimal 3 karakter.");
  }
  if (description.length > 600) {
    return apiError("Deskripsi maksimal 600 karakter.");
  }
  if (file.size <= 0) {
    return apiError("File foto kosong.");
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return apiError(
      `Ukuran foto melebihi batas ${(UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(1)} MB setelah kompresi.`,
    );
  }
  const extension = ACCEPTED_TYPES[file.type];
  if (!extension) {
    return apiError("Format foto harus JPG, PNG, atau WEBP.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!matchesMagicBytes(buffer, file.type)) {
    return apiError("Isi file tidak sesuai dengan format gambarnya.");
  }

  // Waktu foto hanya diterima dari penanda yang dicetak aplikasi. Ini menutup
  // jalur unggah file mentah tanpa cap waktu, meski bukan bukti anti-palsu.
  const capture = parseDocumentationMarker(readSibumaJpegComment(buffer));
  if (!capture) {
    return apiError(
      "Foto tidak memiliki cap waktu SIBUMA. Pilih ulang foto lewat formulir dokumentasi agar cap waktu tercetak.",
    );
  }

  const safeFileName = path.basename(file.name || `dokumentasi.${extension}`);
  const storageKey = `${id}/${crypto.randomUUID()}.${extension}`;
  let storedProvider: StorageProvider | null = null;

  try {
    const { spklPhotos: maxDocs } = await getPhotoLimits();
    const documentation = await mutateDb({ kind: "spkl", id }, async (db) => {
      const spkl = db.spkls.find((item) => item.id === id);
      if (!spkl) throw new Error("SPKL tidak ditemukan.");
      if (spkl.canceledAt) throw new Error("SPKL ini sudah dibatalkan.");

      if (capture.spklNumber !== spkl.number) {
        throw new Error(
          "Cap waktu foto berasal dari SPKL lain. Pilih ulang foto dari formulir SPKL ini.",
        );
      }
      const capturedAt = new Date(capture.takenAt).getTime();
      if (capturedAt > Date.now() + CAPTURE_FUTURE_TOLERANCE_MS) {
        throw new Error(
          "Waktu foto berada di masa depan. Periksa jam perangkat, lalu pilih ulang foto.",
        );
      }
      if (
        capturedAt <
        new Date(spkl.startAt).getTime() - CAPTURE_BEFORE_START_TOLERANCE_MS
      ) {
        throw new Error(
          "Waktu foto lebih dari 24 jam sebelum SPKL dimulai. Pilih foto yang diambil saat pekerjaan berlangsung.",
        );
      }

      const assigned = db.spklWorkers.some(
        (item) => item.spklId === spkl.id && item.employeeId === user.id,
      );
      if (!assigned) {
        throw new Error("Kamu tidak ditugaskan pada SPKL ini.");
      }

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

      const docCount = db.documentations.filter(
        (doc) =>
          doc.attendanceId === attendance.id &&
          (doc.kind ?? "photo") === "photo",
      ).length;
      if (docCount >= maxDocs) {
        throw new Error(
          `Batas maksimal ${maxDocs} dokumentasi per sesi sudah tercapai.`,
        );
      }

      const provider = await putObject(storageKey, buffer, file.type);
      storedProvider = provider;

      const now = new Date();
      const doc: Documentation = {
        id: `doc_${crypto.randomUUID()}`,
        spklId: spkl.id,
        attendanceId: attendance.id,
        employeeId: user.id,
        storageProvider: provider,
        storageKey,
        fileName: safeFileName,
        mimeType: file.type,
        sizeBytes: buffer.length,
        description,
        takenAt: capture.takenAt,
        location,
        kind: "photo",
        createdAt: now.toISOString(),
      };

      db.documentations.push(doc);
      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "dokumentasi_diunggah",
        objectType: "absensi",
        objectId: attendance.id,
        summary: `${user.name} menambahkan dokumentasi pada ${spkl.number}.`,
        after: {
          documentationId: doc.id,
          description: doc.description,
          sizeBytes: doc.sizeBytes,
          hasLocation: Boolean(location),
          takenAt: doc.takenAt,
          captureSource: capture.source,
        },
      });

      return doc;
    });

    return apiOk({
      documentation,
      message: "Dokumentasi berhasil diunggah.",
    });
  } catch (error) {
    if (storedProvider) {
      await deleteObject(storageKey, storedProvider).catch(() => undefined);
    }
    return apiError(
      error instanceof Error ? error.message : "Gagal mengunggah dokumentasi.",
    );
  }
}
