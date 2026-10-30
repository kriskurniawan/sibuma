import { getCurrentUser } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { loadWorkDocument } from "@/lib/work-document-access";
import { WorkDocumentError } from "@/lib/work-document-errors";
import { saveWorkDocumentShareTargets } from "@/lib/work-document-sharing";
import { workDocumentShareSchema } from "@/lib/work-document-validation";

export const maxDuration = 30;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = workDocumentShareSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const { id } = await params;
  try {
    const share = await transaction(async (connection) => {
      const current = await loadWorkDocument(connection, id, true);
      if (!current) throw new WorkDocumentError("Dokumen tidak ditemukan.", 404);
      if (current.ownerId !== user.id) {
        throw new WorkDocumentError(
          "Hanya pemilik dokumen yang dapat mengatur berbagi.",
          403,
        );
      }
      if (current.deletedAt) {
        throw new WorkDocumentError(
          "Pulihkan dokumen dari sampah sebelum membagikannya.",
        );
      }
      return saveWorkDocumentShareTargets(connection, current, parsed.data, user);
    });
    return apiOk({ share });
  } catch (error) {
    if (error instanceof WorkDocumentError) {
      return apiError(error.message, error.status);
    }
    console.error("Gagal mengubah berbagi dokumen:", error);
    return apiError("Pengaturan berbagi gagal disimpan.", 500);
  }
}
