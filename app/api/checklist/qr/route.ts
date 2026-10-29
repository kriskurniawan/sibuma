import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { createChecklistQr } from "@/lib/checklist-qr";
import { checklistQrSchema } from "@/lib/checklist-validation";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat membuat QR checklist.", 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistQrSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const qr = await createChecklistQr(user, {
      name: parsed.data.name,
      mode: parsed.data.mode,
      locationId: parsed.data.locationId ?? null,
      active: parsed.data.active,
    });
    return apiOk({ qr }, 201);
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
