import { getCurrentUser } from "@/lib/auth";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { updateChecklistQr } from "@/lib/checklist-qr";
import { checklistQrUpdateSchema } from "@/lib/checklist-validation";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat mengubah QR checklist.", 403);
  }

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistQrUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const qr = await updateChecklistQr(user, id, parsed.data);
    return apiOk({ qr });
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
