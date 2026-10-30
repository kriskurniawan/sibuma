import { getCurrentUser } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { loadWorkDocument } from "@/lib/work-document-access";
import { WorkDocumentError } from "@/lib/work-document-errors";
import { getWorkDocumentSettings } from "@/lib/work-document-settings";
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
    const result = await transaction(async (connection) => {
      const current = await loadWorkDocument(connection, id, true);
      if (!current) throw new WorkDocumentError("Dokumen tidak ditemukan.", 404);
      if (current.ownerId !== user.id) {
        throw new WorkDocumentError(
          "Hanya pemilik dokumen yang dapat menghapusnya.",
          403,
        );
      }
      if (current.deletedAt) {
        throw new WorkDocumentError("Dokumen sudah berada di sampah.");
      }

      // Kunci pengaturan agar masa simpan mengikuti nilai yang berlaku saat
      // dokumen dipindahkan ke sampah.
      await query(
        "SELECT 1 FROM work_document_settings WHERE id='settings' FOR SHARE",
        [],
        connection,
      );
      const settings = await getWorkDocumentSettings(connection);

      const now = new Date();
      const purgeAfter = new Date(
        now.getTime() + settings.trashRetentionDays * 24 * 60 * 60 * 1000,
      ).toISOString();
      await query(
        `UPDATE work_documents
         SET deleted_at=$1,deleted_by=$2,purge_after=$3,updated_at=$1
         WHERE id=$4`,
        [now.toISOString(), user.id, purgeAfter, id],
        connection,
      );
      // Akses berbagi ditutup saat dokumen masuk sampah; pemilik harus
      // membukanya kembali secara sadar setelah memulihkan dokumen.
      await query(
        `UPDATE work_document_shares
         SET enabled=false,updated_by=$1,updated_at=$2
         WHERE document_id=$3 AND enabled`,
        [user.id, now.toISOString(), id],
        connection,
      );
      await query(
        "DELETE FROM work_document_share_targets WHERE document_id=$1",
        [id],
        connection,
      );
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "dokumen_dipindahkan_ke_sampah",
        objectType: "dokumen",
        objectId: id,
        summary: `${user.name} memindahkan dokumen "${current.title}" ke sampah.`,
        before: { deletedAt: null },
        after: { deletedAt: now.toISOString(), purgeAfter, sharesClosed: true },
      });
      return { purgeAfter };
    });
    return apiOk(result);
  } catch (error) {
    if (error instanceof WorkDocumentError) {
      return apiError(error.message, error.status);
    }
    console.error("Gagal memindahkan dokumen ke sampah:", error);
    return apiError("Dokumen gagal dipindahkan ke sampah.", 500);
  }
}
