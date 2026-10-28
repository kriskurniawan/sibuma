import { getCurrentUser, isDemoMode } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/http";
import { resetDb } from "@/lib/store";

export const runtime = "nodejs";

export async function POST() {
  if (!isDemoMode()) return apiError("Mode demo tidak aktif.", 403);
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat mereset data demo.", 403);
  }

  await resetDb();
  return apiOk({
    message: "Data demo berhasil dikembalikan ke kondisi awal.",
  });
}
