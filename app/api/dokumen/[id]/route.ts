import { getCurrentUser } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { loadWorkDocument } from "@/lib/work-document-access";
import { WorkDocumentError } from "@/lib/work-document-errors";
import { moveWorkDocumentToTrash } from "@/lib/work-document-mutations";
import { workDocumentUpdateSchema } from "@/lib/work-document-validation";

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
  const parsed = workDocumentUpdateSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const { id } = await params;
  try {
    const document = await transaction(async (connection) => {
      const current = await loadWorkDocument(connection, id, true);
      if (!current) throw new WorkDocumentError("Dokumen tidak ditemukan.", 404);
      if (current.ownerId !== user.id) {
        throw new WorkDocumentError(
          "Hanya pemilik dokumen yang dapat mengubahnya.",
          403,
        );
      }
      if (current.deletedAt) {
        throw new WorkDocumentError(
          "Pulihkan dokumen dari sampah sebelum mengubahnya.",
        );
      }

      const now = new Date().toISOString();
      await query(
        "UPDATE work_documents SET title=$1,description=$2,updated_at=$3 WHERE id=$4",
        [parsed.data.title, parsed.data.description, now, id],
        connection,
      );
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "dokumen_diubah",
        objectType: "dokumen",
        objectId: id,
        summary: `${user.name} mengubah keterangan dokumen "${parsed.data.title}".`,
        before: { title: current.title, description: current.description },
        after: { title: parsed.data.title, description: parsed.data.description },
      });

      return {
        ...current,
        title: parsed.data.title,
        description: parsed.data.description,
        updatedAt: now,
      };
    });
    return apiOk({ document });
  } catch (error) {
    if (error instanceof WorkDocumentError) {
      return apiError(error.message, error.status);
    }
    console.error("Gagal mengubah dokumen kerja:", error);
    return apiError("Dokumen gagal diubah. Silakan coba lagi.", 500);
  }
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
  try {
    const result = await moveWorkDocumentToTrash(user, id);
    return apiOk(result);
  } catch (error) {
    if (error instanceof WorkDocumentError) {
      return apiError(error.message, error.status);
    }
    console.error("Gagal memindahkan dokumen ke sampah:", error);
    return apiError("Dokumen gagal dipindahkan ke sampah.", 500);
  }
}
