import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { updateChecklistEquipment } from "@/lib/checklist-equipment";
import { checklistEquipmentUpdateSchema } from "@/lib/checklist-validation";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat mengubah peralatan.", 403);
  }

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistEquipmentUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const equipment = await updateChecklistEquipment(user, id, parsed.data);
    return apiOk({ equipment, message: "Peralatan diperbarui." });
  } catch (error) {
    return apiError(
      checklistErrorMessage(
        error,
        "Kode peralatan sudah dipakai. Gunakan kode lain untuk unit ini.",
      ),
    );
  }
}
