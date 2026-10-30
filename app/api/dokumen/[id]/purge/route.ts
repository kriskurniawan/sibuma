import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk } from "@/lib/http";
import { WorkDocumentError } from "@/lib/work-document-errors";
import { purgeWorkDocument } from "@/lib/work-document-mutations";

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
    await purgeWorkDocument(user, id);
    return apiOk({ removed: true });
  } catch (error) {
    if (error instanceof WorkDocumentError) {
      return apiError(error.message, error.status);
    }
    console.error("Gagal menghapus permanen dokumen kerja:", error);
    return apiError("Dokumen gagal dihapus permanen. Silakan coba lagi.", 500);
  }
}
