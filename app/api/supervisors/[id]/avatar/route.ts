import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { removeEmployeeAvatar, saveEmployeeAvatar } from "@/lib/employee-avatar";
import { apiError, apiOk } from "@/lib/http";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 3 * 1024 * 1024;

async function findSupervisor(id: string) {
  const [employee] = await query<{ id: string; name: string }>(
    "SELECT id,name FROM employees WHERE id=$1 AND role='atasan'",
    [id],
  );
  return employee ?? null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (!can(user.role, "supervisors.manage")) {
    return apiError("Kamu tidak memiliki izin untuk mengubah foto atasan.", 403);
  }

  const { id } = await params;
  const supervisor = await findSupervisor(id);
  if (!supervisor) return apiError("Akun atasan tidak ditemukan.", 404);

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
      employeeId: supervisor.id,
      file: form.get("file"),
      actor: user,
      summary: `${user.name} memperbarui foto profil atasan ${supervisor.name}.`,
    });
    return apiOk({ ...result, message: "Foto atasan diperbarui." });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menyimpan foto atasan.",
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (!can(user.role, "supervisors.manage")) {
    return apiError("Kamu tidak memiliki izin untuk mengubah foto atasan.", 403);
  }

  const { id } = await params;
  const supervisor = await findSupervisor(id);
  if (!supervisor) return apiError("Akun atasan tidak ditemukan.", 404);

  try {
    const result = await removeEmployeeAvatar({
      employeeId: supervisor.id,
      actor: user,
      summary: `${user.name} menghapus foto profil atasan ${supervisor.name}.`,
    });
    return apiOk({ ...result, message: "Foto atasan dihapus." });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menghapus foto atasan.",
    );
  }
}
