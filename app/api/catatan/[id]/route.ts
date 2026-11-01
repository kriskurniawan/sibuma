import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk } from "@/lib/http";
import { deleteNoteForUser } from "@/lib/note-queries";
import { cleanupObjects } from "@/lib/storage-cleanup";

export const runtime = "nodejs";
export const maxDuration = 30;

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
