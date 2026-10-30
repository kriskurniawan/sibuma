import "server-only";
import { z } from "zod";
import { headObject, readObjectRange } from "./storage";
import {
  VIDEO_MAX_BYTES,
  VIDEO_MIN_BYTES,
  isVideoMime,
  videoExtensionFor,
  videoMatchesMime,
} from "./video";

/**
 * Video bukti pekerjaan tidak direkam aplikasi, jadi tidak ada cap waktu di
 * dalam berkas. Yang dapat diperiksa server: tipe dan ukuran yang ditandatangani
 * saat unggah, container dari magic bytes, serta ETag objek sebagai sidik jari.
 */
export const evidenceVideoPrepareSchema = z.object({
  fileName: z.string().trim().min(1, "Nama video wajib diisi.").max(200),
  mimeType: z.string().trim().min(1, "Jenis video wajib diisi.").max(60),
  sizeBytes: z
    .number()
    .int("Ukuran video tidak valid.")
    .positive("Ukuran video tidak valid.")
    .max(VIDEO_MAX_BYTES, "Ukuran video melebihi batas keras 100 MB."),
});

export const evidenceVideoCompleteSchema = z.object({
  key: z.string().trim().min(10, "Kunci unggahan tidak valid.").max(400),
  fileName: z.string().trim().min(1, "Nama video wajib diisi.").max(200),
  mimeType: z.string().trim().min(1, "Jenis video wajib diisi.").max(60),
  sizeBytes: z
    .number()
    .int("Ukuran video tidak valid.")
    .positive("Ukuran video tidak valid.")
    .max(VIDEO_MAX_BYTES, "Ukuran video melebihi batas keras 100 MB."),
  /** Batas atas longgar; angka aneh dari klien tidak dipakai. */
  durationSeconds: z.number().int().nonnegative().max(24 * 60 * 60).nullish(),
  caption: z.string().trim().max(600, "Keterangan video maksimal 600 karakter.").optional(),
});

export type EvidenceVideoCompleteInput = z.infer<
  typeof evidenceVideoCompleteSchema
>;

export function maxEvidenceVideoBytes(configured: number) {
  return Math.max(
    VIDEO_MIN_BYTES,
    Math.min(configured, VIDEO_MAX_BYTES),
  );
}

export function formatVideoBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / 1024 / 1024;
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Kunci objek selalu `{prefix}{uuid}.{ext}` agar tidak bisa menunjuk objek lain. */
export function evidenceVideoKey(prefix: string, mimeType: string) {
  const extension = videoExtensionFor(mimeType);
  if (!extension) throw new Error("Format video harus MP4, WEBM, atau MOV.");
  return `${prefix}${crypto.randomUUID()}.${extension}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function assertEvidenceVideoKey(
  key: string,
  prefix: string,
  mimeType: string,
) {
  const extension = videoExtensionFor(mimeType);
  if (!extension) return false;
  const pattern = new RegExp(
    `^${escapeRegExp(prefix)}[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.${extension}$`,
  );
  return pattern.test(key);
}

export function evidenceVideoFileName(fileName: string, mimeType: string) {
  const extension = videoExtensionFor(mimeType);
  const base = fileName.split(/[\\/]/).pop()?.trim() || "video";
  const safe = base.replace(/[^\w.\- ()]+/g, "_").slice(0, 180);
  if (!extension) return safe;
  return safe.toLowerCase().endsWith(`.${extension}`)
    ? safe
    : `${safe}.${extension}`;
}

/**
 * Objek diverifikasi ulang sebelum baris bukti dibuat. Ukuran dan tipe harus
 * sama persis dengan yang ditandatangani; isi diperiksa dari beberapa byte
 * pertama. Objek yang tidak lolos dihapus oleh pemanggil.
 */
export async function verifyEvidenceVideoObject(
  key: string,
  mimeType: string,
  sizeBytes: number,
) {
  if (!isVideoMime(mimeType)) {
    throw new Error("Format video harus MP4, WEBM, atau MOV.");
  }
  if (sizeBytes < VIDEO_MIN_BYTES) {
    throw new Error("Berkas video terlalu kecil.");
  }
  const object = await headObject(key);
  if (object.contentLength !== sizeBytes) {
    throw new Error(
      "Ukuran video tidak sesuai dengan data unggahan. Silakan unggah ulang.",
    );
  }
  const storedType = object.contentType?.split(";")[0]?.trim().toLowerCase();
  if (storedType && storedType !== mimeType) {
    throw new Error(
      "Jenis video tidak sesuai dengan data unggahan. Silakan unggah ulang.",
    );
  }
  const prefix = await readObjectRange(key, 0, 63);
  if (!videoMatchesMime(prefix, mimeType)) {
    throw new Error(
      "Isi berkas bukan video MP4, WEBM, atau MOV yang valid.",
    );
  }
  return { etag: object.etag };
}
