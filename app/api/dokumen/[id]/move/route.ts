import { getCurrentUser } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { loadWorkDocument } from "@/lib/work-document-access";
import { assertOwnedFolder } from "@/lib/work-document-folders";
import { WorkDocumentError } from "@/lib/work-document-errors";
import { workDocumentMoveSchema } from "@/lib/work-document-validation";

export const maxDuration = 30;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = workDocumentMoveSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const { id } = await params;
  try {
    const document = await transaction(async (connection) => {
      const current = await loadWorkDocument(connection, id, true);
      if (!current) throw new WorkDocumentError("Dokumen tidak ditemukan.", 404);
      if (current.ownerId !== user.id) {
        throw new WorkDocumentError(
          "Hanya pemilik dokumen yang dapat memindahkannya.",
          403,
        );
      }
      if (current.deletedAt) {
        throw new WorkDocumentError(
          "Pulihkan dokumen dari sampah sebelum memindahkannya.",
        );
      }
      if (parsed.data.folderId) {
        await assertOwnedFolder(connection, parsed.data.folderId, user.id);
      }

      const now = new Date().toISOString();
      await query(
        "UPDATE work_documents SET folder_id=$1,updated_at=$2 WHERE id=$3",
        [parsed.data.folderId, now, id],
        connection,
      );
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "dokumen_dipindahkan",
        objectType: "dokumen",
        objectId: id,
        summary: `${user.name} memindahkan dokumen "${current.title}" ke ${parsed.data.folderId ? "folder lain" : "tanpa folder"}.`,
        before: { folderId: current.folderId },
        after: { folderId: parsed.data.folderId },
      });
      return { ...current, folderId: parsed.data.folderId, updatedAt: now };
    });
    return apiOk({ document });
  } catch (error) {
    if (error instanceof WorkDocumentError) {
      return apiError(error.message, error.status);
    }
    console.error("Gagal memindahkan dokumen kerja:", error);
    return apiError("Dokumen gagal dipindahkan. Silakan coba lagi.", 500);
  }
}
