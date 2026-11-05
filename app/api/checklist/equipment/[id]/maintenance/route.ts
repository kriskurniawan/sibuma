import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { createChecklistEquipmentMaintenance } from "@/lib/checklist-equipment";
import { checklistEquipmentMaintenanceSchema } from "@/lib/checklist-validation";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "pekerja" && user.role !== "atasan") {
    return apiError("Kamu tidak memiliki izin untuk mencatat perawatan.", 403);
  }

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistEquipmentMaintenanceSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const maintenance = await createChecklistEquipmentMaintenance(
      user,
      id,
      parsed.data,
    );
    return apiOk(
      { maintenance, message: "Riwayat perawatan dicatat." },
      201,
    );
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
