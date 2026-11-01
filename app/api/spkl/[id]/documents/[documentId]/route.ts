import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { query } from "@/lib/db";
import { apiError, apiOk } from "@/lib/http";
import { deleteObject } from "@/lib/storage";
import { mutateDb, pushAudit } from "@/lib/store";
import type { StorageProvider } from "@/lib/types";

export const maxDuration = 30;

/**
 * Objek hanya dihapus jika tidak ada baris dokumentasi lain yang memakainya.
 * Data lama dapat berbagi storage key antar beberapa baris.
 */
async function deleteObjectIfUnused(
  key: string | null | undefined,
  provider: StorageProvider,
) {
  if (!key) return;
  try {
    const [stillUsed] = await query(
      `SELECT 1 FROM documentations WHERE storage_key=$1 OR poster_key=$1 LIMIT 1`,
      [key],
    );
    if (stillUsed) return;
    await deleteObject(key, provider);
  } catch (error) {
    // Baris sudah terhapus dari database; kegagalan membersihkan objek tidak
    // boleh membuat permintaan terlihat gagal.
    console.error(`Gagal menghapus objek dokumentasi ${key}:`, error);
  }
}

/**
 * Pengunggah dapat menghapus dokumentasinya sendiri selama masa unggah SPKL
 * masih berlaku. Setelah tenggat, bukti dikunci untuk audit.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "pekerja") {
    return apiError(
      "Hanya pekerja pengunggah yang dapat menghapus dokumentasi.",
      403,
    );
  }

  const { id, documentId } = await params;
  try {
    const removed = await mutateDb({ kind: "spkl", id }, async (db) => {
      const spkl = db.spkls.find((item) => item.id === id);
      if (!spkl) throw new Error("SPKL tidak ditemukan.");
      if (spkl.canceledAt) {
        throw new Error(
          "SPKL ini sudah dibatalkan. Dokumentasi tidak dapat dihapus.",
        );
      }

      const doc = db.documentations.find(
        (item) => item.id === documentId && item.spklId === spkl.id,
      );
      if (!doc) throw new Error("Dokumentasi tidak ditemukan.");
      if (doc.employeeId !== user.id) {
        throw new Error(
          "Kamu hanya dapat menghapus dokumentasi yang kamu unggah.",
        );
      }

      const attendance = db.attendances.find(
        (item) =>
          item.id === doc.attendanceId && item.employeeId === user.id,
      );
      if (!attendance?.checkInAt || attendance.status === "tidak_hadir") {
        throw new Error(
          "Kamu harus absen masuk terlebih dahulu sebelum menghapus dokumentasi.",
        );
      }

      const lockAt =
        new Date(spkl.endAt).getTime() + db.policy.docGraceMinutes * 60_000;
      if (Date.now() > lockAt) {
        throw new Error(
          "Waktu unggah dokumentasi sudah berakhir. Bukti dikunci dan tidak dapat dihapus.",
        );
      }

      const index = db.documentations.findIndex((item) => item.id === doc.id);
      if (index >= 0) db.documentations.splice(index, 1);

      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "dokumentasi_dihapus",
        objectType: "absensi",
        objectId: doc.attendanceId,
        summary: `${user.name} menghapus ${
          doc.kind === "video" ? "video" : "foto"
        } dokumentasi pada ${spkl.number}.`,
        before: {
          documentationId: doc.id,
          kind: doc.kind ?? "photo",
          fileName: doc.fileName,
          description: doc.description,
          sizeBytes: doc.sizeBytes,
          storageKey: doc.storageKey,
          takenAt: doc.takenAt,
        },
      });

      return doc;
    });

    await deleteObjectIfUnused(removed.storageKey, removed.storageProvider);
    await deleteObjectIfUnused(removed.posterKey, removed.storageProvider);

    return apiOk({
      message:
        removed.kind === "video"
          ? "Video dokumentasi dihapus."
          : "Foto dokumentasi dihapus.",
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menghapus dokumentasi.",
    );
  }
}
