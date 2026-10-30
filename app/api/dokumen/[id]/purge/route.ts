import { getCurrentUser } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { deleteDocumentObject } from "@/lib/document-storage";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk } from "@/lib/http";
import { loadWorkDocument } from "@/lib/work-document-access";
import { WorkDocumentError } from "@/lib/work-document-errors";

export const maxDuration = 30;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const { id } = await params;
  let storageKey: string | null = null;
  try {
    const removed = await transaction(async (connection) => {
      const current = await loadWorkDocument(connection, id, true);
      if (!current) throw new WorkDocumentError("Dokumen tidak ditemukan.", 404);
      if (current.ownerId !== user.id) {
        throw new WorkDocumentError(
          "Hanya pemilik dokumen yang dapat menghapusnya permanen.",
          403,
        );
      }
      if (!current.deletedAt) {
        throw new WorkDocumentError(
          "Pindahkan dokumen ke sampah sebelum menghapus permanen.",
        );
      }

      await query("DELETE FROM work_documents WHERE id=$1", [id], connection);
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "dokumen_dihapus_permanen",
        objectType: "dokumen",
        objectId: id,
        summary: `${user.name} menghapus permanen dokumen "${current.title}".`,
        before: {
          id: current.id,
          title: current.title,
          fileName: current.fileName,
          sizeBytes: current.sizeBytes,
        },
      });
      return { storageKey: current.storageKey, title: current.title };
    });
    storageKey = removed.storageKey;
    // Baris sudah hilang; kegagalan storage hanya meninggalkan objek yatim.
    await deleteDocumentObject(removed.storageKey).catch((error) => {
      console.error(
        `Gagal menghapus objek dokumen permanen ${removed.storageKey}:`,
        error,
      );
    });
    return apiOk({ removed: true });
  } catch (error) {
    if (error instanceof WorkDocumentError) {
      return apiError(error.message, error.status);
    }
    console.error("Gagal menghapus permanen dokumen kerja:", error, storageKey);
    return apiError("Dokumen gagal dihapus permanen. Silakan coba lagi.", 500);
  }
}
