import { getCurrentUser } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import {
  createWorkDocumentFolder,
  listWorkDocumentFolders,
} from "@/lib/work-document-folders";
import { WorkDocumentError } from "@/lib/work-document-errors";
import { workDocumentFolderSchema } from "@/lib/work-document-validation";

export const maxDuration = 30;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const folders = await listWorkDocumentFolders(user.id);
  return apiOk({ folders });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = workDocumentFolderSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const folder = await transaction((connection) =>
      createWorkDocumentFolder(connection, user.id, parsed.data, user),
    );
    return apiOk({ folder }, 201);
  } catch (error) {
    if (error instanceof WorkDocumentError) {
      return apiError(error.message, error.status);
    }
    console.error("Gagal membuat folder dokumen:", error);
    return apiError("Folder gagal dibuat. Silakan coba lagi.", 500);
  }
}
