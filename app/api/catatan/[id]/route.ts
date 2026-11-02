import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { NOTE_MAX_PHOTOS, NOTE_MAX_TOTAL_BYTES } from "@/lib/constants";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import {
  deleteNoteForUser,
  getEditableNoteForUser,
  updateNoteContentForUser,
} from "@/lib/note-queries";
import { noteContentSchema } from "@/lib/note-validation";
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  let keepAttachmentIds: string[];
  try {
    if (!form.has("keepAttachmentIds")) {
      return apiError("Data foto catatan tidak valid.");
    }
    keepAttachmentIds = parseNoteIds(
      form,
      "keepAttachmentIds",
      "Data foto catatan tidak valid.",
    );
  } catch (error) {
    return apiError(
      error instanceof Error
        ? error.message
        : "Data foto catatan tidak valid.",
    );
  }

  const parsed = noteContentSchema.safeParse({
    title: form.get("title"),
    body: form.get("body"),
  });
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const rawExpectedUpdatedAt = form.get("expectedUpdatedAt");
  const expectedUpdatedAt =
    typeof rawExpectedUpdatedAt === "string" ? rawExpectedUpdatedAt : "";

  const { id } = await params;

  let note: Awaited<ReturnType<typeof getEditableNoteForUser>>;
  try {
    note = await getEditableNoteForUser({
      id,
      actorId: user.id,
      canEditAny: user.role === "super_admin",
    });
  } catch (error) {
    console.error("Gagal membaca catatan yang akan diubah:", error);
    return apiError("Catatan gagal diubah. Coba lagi.", 500);
  }

  if (note.status === "missing") {
    return apiError("Catatan tidak ditemukan atau tidak dapat diubah.", 404);
  }

  if (expectedUpdatedAt && note.updatedAt !== expectedUpdatedAt) {
    return apiError(
      "Catatan sudah diubah di tempat lain. Muat ulang halaman sebelum menyimpan lagi.",
      409,
    );
  }

  const uniqueKeepIds = [...new Set(keepAttachmentIds)];
  if (uniqueKeepIds.length !== keepAttachmentIds.length) {
    return apiError("Data foto catatan tidak valid.");
  }

  const attachedIds = new Set(
    note.attachments.map((attachment) => attachment.id),
  );
  if (uniqueKeepIds.some((attachmentId) => !attachedIds.has(attachmentId))) {
    return apiError(
      "Sebagian foto sudah berubah. Muat ulang halaman sebelum menyimpan lagi.",
      409,
    );
  }

  const keptBytes = uniqueKeepIds.reduce((sum, attachmentId) => {
    const attachment = note.attachments.find(
      (candidate) => candidate.id === attachmentId,
    );
    return sum + (attachment?.sizeBytes ?? 0);
  }, 0);

  const photos = notePhotoFiles(form);

  if (
    photos.length > 0 &&
    uniqueKeepIds.length + photos.length > NOTE_MAX_PHOTOS
  ) {
    return apiError(`Maksimal ${NOTE_MAX_PHOTOS} foto per catatan.`);
  }
  const totalBytes =
    keptBytes + photos.reduce((sum, photo) => sum + photo.size, 0);
  if (photos.length > 0 && totalBytes > NOTE_MAX_TOTAL_BYTES) {
    return apiError(
      `Total ukuran foto maksimal ${(NOTE_MAX_TOTAL_BYTES / 1024 / 1024).toFixed(0)} MB.`,
    );
  }

  const preparation = await prepareNotePhotos(photos);
  if (!preparation.ok) return apiError(preparation.message);

  const uploadedKeys: string[] = [];
  const newAttachments: Array<{
    id: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }> = [];

  for (const [index, entry] of preparation.prepared.entries()) {
    const storageKey = `catatan/${id}/${crypto.randomUUID()}.${entry.extension}`;
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
    newAttachments.push({
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

  let result: Awaited<ReturnType<typeof updateNoteContentForUser>>;
  try {
    result = await updateNoteContentForUser({
      id,
      actorId: user.id,
      actorName: user.name,
      canEditAny: user.role === "super_admin",
      expectedUpdatedAt,
      title: parsed.data.title,
      body: parsed.data.body,
      keepAttachmentIds: uniqueKeepIds,
      newAttachments,
    });
  } catch (error) {
    after(() => cleanupObjects(uploadedKeys));
    console.error("Gagal mengubah catatan:", error);
    return apiError("Catatan gagal diubah. Coba lagi.", 500);
  }

  if (result.status === "missing") {
    after(() => cleanupObjects(uploadedKeys));
    return apiError("Catatan tidak ditemukan atau tidak dapat diubah.", 404);
  }
  if (result.status === "conflict") {
    // Objek yang sudah terunggah tidak boleh tertinggal ketika transaksi
    // menolak perubahan karena catatan berubah lebih dulu.
    after(() => cleanupObjects(uploadedKeys));
    return apiError(
      "Catatan sudah diubah di tempat lain. Muat ulang halaman sebelum menyimpan lagi.",
      409,
    );
  }

  after(() => cleanupObjects(result.removedStorageKeys));
  return apiOk({ updated: true, id });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const { id } = await params;
  let result: Awaited<ReturnType<typeof deleteNoteForUser>>;
  try {
    result = await deleteNoteForUser({
      id,
      actorId: user.id,
      actorName: user.name,
      canDeleteAny: user.role === "super_admin",
    });
  } catch (error) {
    console.error("Gagal menghapus catatan:", error);
    return apiError("Catatan gagal dihapus. Coba lagi.", 500);
  }

  if (result.status === "missing") {
    // Penulis lain dan catatan yang tidak ada sengaja memakai respons yang
    // sama agar keberadaan catatan privat tidak dapat ditebak.
    return apiError("Catatan tidak ditemukan atau tidak dapat dihapus.", 404);
  }

  // Baris database sudah hilang; pembersihan media berjalan setelah respons
  // dan dicatat untuk diulang bila storage sedang tidak tersedia.
  const storageKeys = result.storageKeys;
  after(() => cleanupObjects(storageKeys));
  return apiOk({ deleted: true });
}
