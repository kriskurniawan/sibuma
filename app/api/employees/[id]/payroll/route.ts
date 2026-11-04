import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { apiError, apiOk } from "@/lib/http";
import { getEmployeePayroll } from "@/lib/overtime-recap";

export const runtime = "nodejs";

/** Data penggajian privat hanya untuk atasan pemilik pekerja. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan" || user.accessMode !== "full") {
    return apiError("Hanya atasan pengelola tim yang dapat membuka data penggajian.", 403);
  }

  const { id } = await params;
  const [target] = await query<{
    id: string;
    role: string;
    supervisor_id: string | null;
  }>(
    `SELECT id,role,supervisor_id FROM employees WHERE id=$1`,
    [id],
  );
  if (
    !target ||
    target.role !== "pekerja" ||
    target.supervisor_id !== user.id
  ) {
    return apiError("Pekerja ini bukan bagian dari timmu.", 404);
  }

  return apiOk({ payroll: await getEmployeePayroll(id) });
}
