import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { removeEmployeeAvatar, saveEmployeeAvatar } from "@/lib/employee-avatar";
import { apiError, apiOk } from "@/lib/http";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 3 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const declaredSize = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredSize) && declaredSize > MAX_REQUEST_BYTES) {
    return apiError("Ukuran foto maksimal 2 MB.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("Permintaan unggah tidak valid.");
  }

  try {
    const result = await saveEmployeeAvatar({
      employeeId: user.id,
      file: form.get("file"),
      actor: user,
      summary: `${user.name} memperbarui foto profilnya.`,
    });
    return apiOk({ ...result, message: "Foto profil diperbarui." });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menyimpan foto profil.",
    );
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  try {
    const result = await removeEmployeeAvatar({
      employeeId: user.id,
      actor: user,
      summary: `${user.name} menghapus foto profilnya.`,
    });
    return apiOk({ ...result, message: "Foto profil dihapus." });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menghapus foto profil.",
    );
  }
}
