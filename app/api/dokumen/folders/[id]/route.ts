import { getCurrentUser } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import {
  deleteWorkDocumentFolder,
  updateWorkDocumentFolder,
} from "@/lib/work-document-folders";
import { WorkDocumentError } from "@/lib/work-document-errors";
import { workDocumentFolderSchema } from "@/lib/work-document-validation";

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
  const parsed = workDocumentFolderSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const { id } = await params;
  try {
    const folder = await transaction((connection) =>
      updateWorkDocumentFolder(connection, id, user.id, parsed.data, user),
    );
    return apiOk({ folder });
  } catch (error) {
    if (error instanceof WorkDocumentError) {
      return apiError(error.message, error.status);
    }
    console.error("Gagal mengubah folder dokumen:", error);
    return apiError("Folder gagal diubah. Silakan coba lagi.", 500);
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
    const result = await transaction((connection) =>
      deleteWorkDocumentFolder(connection, id, user.id, user),
    );
    return apiOk(result);
  } catch (error) {
    if (error instanceof WorkDocumentError) {
      return apiError(error.message, error.status);
    }
    console.error("Gagal menghapus folder dokumen:", error);
    return apiError("Folder gagal dihapus. Silakan coba lagi.", 500);
  }
}
