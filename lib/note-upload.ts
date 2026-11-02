import "server-only";

import path from "node:path";
import { UPLOAD_MAX_BYTES } from "./constants";

const ACCEPTED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function notePhotoFiles(form: FormData) {
  return form
    .getAll("photo")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

export function parseNoteIds(form: FormData, field: string, message: string) {
  const raw = form.get(field);
  if (raw === null) return [] as string[];
  if (typeof raw !== "string") throw new Error(message);
  if (!raw.trim()) return [] as string[];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(message);
  }
  if (!Array.isArray(parsed)) throw new Error(message);

  return parsed.map((value) => {
    if (typeof value !== "string") throw new Error(message);
    const id = value.trim();
    if (!id || id.length > 160 || /[\u0000-\u001F\u007F]/.test(id)) {
      throw new Error(message);
    }
    return id;
  });
}

function matchesMagicBytes(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }
  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export function safeNoteFileName(name: string, fallback: string) {
  const base = path
    .basename(name.replaceAll("\\", "/"))
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
  return base.slice(0, 160) || fallback;
}

export interface PreparedNotePhoto {
  photo: File;
  extension: string;
  buffer: Buffer;
}

export type PrepareNotePhotosResult =
  | { ok: true; prepared: PreparedNotePhoto[] }
  | { ok: false; message: string };

/** Validasi isi dan format tiap foto sebelum diunggah. */
export async function prepareNotePhotos(
  photos: File[],
): Promise<PrepareNotePhotosResult> {
  const prepared: PreparedNotePhoto[] = [];
  for (const [index, photo] of photos.entries()) {
    if (photo.size > UPLOAD_MAX_BYTES) {
      return {
        ok: false,
        message: `Foto ${index + 1} melebihi batas ${(UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(1)} MB setelah kompresi.`,
      };
    }
    const extension = ACCEPTED_TYPES[photo.type];
    if (!extension) {
      return {
        ok: false,
        message: `Foto ${index + 1} harus berformat JPG, PNG, atau WEBP.`,
      };
    }
    const buffer = Buffer.from(await photo.arrayBuffer());
    if (!matchesMagicBytes(buffer, photo.type)) {
      return {
        ok: false,
        message: `Isi foto ${index + 1} tidak sesuai dengan format gambarnya.`,
      };
    }
    prepared.push({ photo, extension, buffer });
  }
  return { ok: true, prepared };
}
