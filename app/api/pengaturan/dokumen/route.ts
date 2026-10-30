import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { saveWorkDocumentSettings } from "@/lib/work-document-settings";
import { workDocumentSettingsSchema } from "@/lib/work-document-validation";

export const maxDuration = 30;

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (!can(user.role, "policy.manage")) {
    return apiError("Hanya super admin yang dapat mengubah pengaturan ini.", 403);
  }
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = workDocumentSettingsSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const settings = await transaction((connection) =>
      saveWorkDocumentSettings(connection, parsed.data, user),
    );
    return apiOk({ settings });
  } catch (error) {
    console.error("Gagal menyimpan pengaturan dokumen kerja:", error);
    return apiError("Pengaturan dokumen gagal disimpan. Silakan coba lagi.", 500);
  }
}
