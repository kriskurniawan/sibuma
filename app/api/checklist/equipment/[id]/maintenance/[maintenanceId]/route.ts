import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { updateChecklistEquipmentMaintenance } from "@/lib/checklist-equipment";
import { checklistEquipmentMaintenanceUpdateSchema } from "@/lib/checklist-validation";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; maintenanceId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "pekerja" && user.role !== "atasan") {
    return apiError(
      "Kamu tidak memiliki izin untuk mengubah riwayat perawatan.",
      403,
    );
  }

  const { id, maintenanceId } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistEquipmentMaintenanceUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const maintenance = await updateChecklistEquipmentMaintenance(
      user,
      id,
      maintenanceId,
      parsed.data,
    );
    return apiOk({ maintenance, message: "Riwayat perawatan diperbarui." });
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
