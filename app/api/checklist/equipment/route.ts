import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { createChecklistEquipment } from "@/lib/checklist-equipment";
import { checklistEquipmentSchema } from "@/lib/checklist-validation";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat menambah peralatan.", 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistEquipmentSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const equipment = await createChecklistEquipment(user, parsed.data);
    return apiOk(
      { equipment, message: "Peralatan ditambahkan." },
      201,
    );
  } catch (error) {
    return apiError(
      checklistErrorMessage(
        error,
        "Kode peralatan sudah dipakai. Gunakan kode lain untuk unit ini.",
      ),
    );
  }
}
