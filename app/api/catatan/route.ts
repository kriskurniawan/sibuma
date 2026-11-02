import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { NOTE_MAX_PHOTOS, NOTE_MAX_TOTAL_BYTES } from "@/lib/constants";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import {
  findNoteByClientRequest,
  getActiveEmployeeNames,
  getNoteDivisions,
  insertNote,
  noteExists,
} from "@/lib/note-queries";
import type { NoteAudience } from "@/lib/note-types";
import { noteCreateSchema } from "@/lib/note-validation";
import {
  notePhotoFiles,
  parseNoteIds,
  prepareNotePhotos,
  safeNoteFileName,
} from "@/lib/note-upload";
import { putObject } from "@/lib/storage";
import { cleanupObjects } from "@/lib/storage-cleanup";

export const runtime = "nodejs";
export const maxDuration = 30;

function recipientLabel(
  audienceType: NoteAudience,
  divisionName: string,
  names: string[],
) {
  if (audienceType !== "employees") return `divisi ${divisionName}`;
  if (names.length === 1) return names[0];
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3
    ? `${shown}, dan ${names.length - 3} lainnya`
    : shown;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("Data catatan tidak valid.");
  }

  let employeeIds: string[] = [];
  let divisionIds: string[] = [];
  try {
    employeeIds = parseNoteIds(
      form,
      "employeeIds",
      "Daftar penerima tidak valid.",
    );
    divisionIds = parseNoteIds(
      form,
      "divisionIds",
      "Daftar divisi tujuan tidak valid.",
    );
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Data penerima tidak valid.",
    );
  }

  const rawClientRequestId = form.get("clientRequestId");
  const clientRequestId =
    typeof rawClientRequestId === "string" && rawClientRequestId.trim()
      ? rawClientRequestId.trim()
      : undefined;

  const parsed = noteCreateSchema.safeParse({
    title: form.get("title"),
    body: form.get("body"),
    audienceType: form.get("audienceType"),
    divisionIds,
    employeeIds,
    clientRequestId,
  });
  if (!parsed.success) return apiError(validationMessage(parsed.error));
  const input = parsed.data;

  // Retry setelah respons hilang harus mengembalikan catatan yang sama, bukan
  // membuat salinan baru atau mengunggah foto lagi.
  if (input.clientRequestId) {
    try {
      const existingId = await findNoteByClientRequest(
        user.id,
        input.clientRequestId,
      );
      if (existingId) {
        return apiOk({ id: existingId, duplicate: true });
      }
    } catch (error) {
      console.error("Gagal memeriksa kunci idempotensi catatan:", error);
      return apiError("Catatan gagal disimpan. Coba lagi.", 503);
    }
  }

  let audienceType: NoteAudience = input.audienceType;
  let divisions: Array<{ id: string; name: string }> = [];
  let divisionId: string | null = null;
  let divisionName = "";
  let recipientIds: string[] = [];
  let recipientNames: string[] = [];

  if (input.audienceType === "division") {
    const ids = [...new Set(input.divisionIds)];
    divisions = await getNoteDivisions(ids);
    if (divisions.length !== ids.length) {
      return apiError(
        "Sebagian divisi tujuan tidak aktif atau tidak ditemukan.",
      );
    }
    divisionName = divisions.map((row) => row.name).join(", ");
    // Satu divisi tetap memakai kolom lama; lebih dari satu memakai relasi
    // `note_divisions` agar visibilitas lintas divisi dapat diperiksa.
    audienceType = divisions.length > 1 ? "divisions" : "division";
    divisionId = divisions.length === 1 ? divisions[0].id : null;
  } else {
    recipientIds = [...new Set(input.employeeIds)];
    const employees = await getActiveEmployeeNames(recipientIds);
    if (employees.length !== recipientIds.length) {
      return apiError(
        "Penerima harus karyawan aktif; akun atasan atau admin tidak dapat dipilih.",
      );
    }
    recipientNames = employees.map((row) => row.name);
  }

  const photos = notePhotoFiles(form);

  if (photos.length > NOTE_MAX_PHOTOS) {
    return apiError(`Maksimal ${NOTE_MAX_PHOTOS} foto per catatan.`);
  }

  const totalBytes = photos.reduce((sum, photo) => sum + photo.size, 0);
  if (totalBytes > NOTE_MAX_TOTAL_BYTES) {
    return apiError(
      `Total ukuran foto maksimal ${(NOTE_MAX_TOTAL_BYTES / 1024 / 1024).toFixed(0)} MB.`,
    );
  }

  const preparation = await prepareNotePhotos(photos);
  if (!preparation.ok) return apiError(preparation.message);
  const prepared = preparation.prepared;

  const noteId = `note_${crypto.randomUUID()}`;
  const uploadedKeys: string[] = [];
  const attachments: Array<{
    id: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }> = [];

  for (const [index, entry] of prepared.entries()) {
    const storageKey = `catatan/${noteId}/${crypto.randomUUID()}.${entry.extension}`;
    try {
      await putObject(
        storageKey,
        new Uint8Array(entry.buffer),
        entry.photo.type,
      );
    } catch (error) {
      after(() => cleanupObjects(uploadedKeys));
      console.error("Gagal mengunggah foto catatan:", error);
      return apiError("Foto catatan gagal diunggah. Coba lagi.", 502);
    }
    uploadedKeys.push(storageKey);
    attachments.push({
      id: `att_${crypto.randomUUID()}`,
      storageKey,
      fileName: safeNoteFileName(
        entry.photo.name,
        `catatan-${index + 1}.${entry.extension}`,
      ),
      mimeType: entry.photo.type,
      sizeBytes: entry.photo.size,
    });
  }

  try {
    await insertNote({
      id: noteId,
      authorId: user.id,
      authorName: user.name,
      title: input.title,
      body: input.body,
      audienceType,
      divisions,
      divisionId,
      divisionName,
      recipientIds,
      clientRequestId: input.clientRequestId ?? null,
      attachments,
      auditSummary: `${user.name} membuat catatan "${input.title}" untuk ${recipientLabel(audienceType, divisionName, recipientNames)}.`,
    });
  } catch (error) {
    console.error("Gagal menyimpan catatan:", error);

    // COMMIT dapat berhasil di server tetapi responsnya hilang. Jangan hapus
    // objek yang mungkin sudah dirujuk oleh catatan yang tersimpan.
    let committed: boolean;
    try {
      committed = await noteExists(noteId);
    } catch (lookupError) {
      console.error(
        "Gagal memastikan catatan tersimpan setelah error:",
        lookupError,
      );
      return apiError(
        "Catatan belum dapat dipastikan tersimpan. Coba lagi dengan aman.",
        503,
      );
    }
    if (committed) return apiOk({ id: noteId, duplicate: true }, 201);

    // Permintaan paralel dengan kunci yang sama: catatan milik pemenang
    // dipakai, sedangkan foto dari permintaan ini dibersihkan.
    if (input.clientRequestId) {
      let winnerId: string | null = null;
      try {
        winnerId = await findNoteByClientRequest(
          user.id,
          input.clientRequestId,
        );
      } catch (lookupError) {
        console.error(
          "Gagal memeriksa pemenang kunci idempotensi:",
          lookupError,
        );
        return apiError(
          "Catatan belum dapat dipastikan tersimpan. Coba lagi dengan aman.",
          503,
        );
      }
      if (winnerId) {
        after(() => cleanupObjects(uploadedKeys));
        return apiOk({ id: winnerId, duplicate: true });
      }
    }

    after(() => cleanupObjects(uploadedKeys));
    return apiError("Catatan gagal disimpan. Coba lagi.", 500);
  }

  return apiOk({ id: noteId }, 201);
}
