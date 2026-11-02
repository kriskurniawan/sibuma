import { getCurrentUser } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/http";
import { getManualWorkActiveCount } from "@/lib/manual-work-queries";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);

  return apiOk({ count: await getManualWorkActiveCount(user) });
}
