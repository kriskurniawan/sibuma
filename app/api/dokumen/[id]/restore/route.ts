import { getCurrentUser } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
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
  try {
    const document = await transaction(async (connection) => {
      const current = await loadWorkDocument(connection, id, true);
      if (!current) throw new WorkDocumentError("Dokumen tidak ditemukan.", 404);
      if (current.ownerId !== user.id) {
        throw new WorkDocumentError(
          "Hanya pemilik dokumen yang dapat memulihkannya.",
          403,
        );
      }
      if (!current.deletedAt) {
        throw new WorkDocumentError("Dokumen tidak berada di sampah.");
      }

      const now = new Date().toISOString();
      await query(
        `UPDATE work_documents
         SET deleted_at=NULL,deleted_by=NULL,purge_after=NULL,updated_at=$1
         WHERE id=$2`,
        [now, id],
        connection,
      );
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "dokumen_dipulihkan",
        objectType: "dokumen",
        objectId: id,
        summary: `${user.name} memulihkan dokumen "${current.title}" dari sampah.`,
        before: { deletedAt: current.deletedAt, purgeAfter: current.purgeAfter },
        after: { deletedAt: null, purgeAfter: null },
      });
      return {
        ...current,
        deletedAt: null,
        deletedBy: null,
        purgeAfter: null,
        updatedAt: now,
      };
    });
    return apiOk({ document });
  } catch (error) {
    if (error instanceof WorkDocumentError) {
      return apiError(error.message, error.status);
    }
    console.error("Gagal memulihkan dokumen kerja:", error);
    return apiError("Dokumen gagal dipulihkan. Silakan coba lagi.", 500);
  }
}
