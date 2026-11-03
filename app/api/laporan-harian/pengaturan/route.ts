import { getCurrentUser } from "@/lib/auth";
import { dailyReportScope } from "@/lib/daily-report";
import { saveDailyReportSettings } from "@/lib/daily-report-settings";
import { dailyReportSettingsSchema } from "@/lib/daily-report-validation";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { readOnlyWrite } from "@/lib/read-only";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);

  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const scope = dailyReportScope(user);
  if (!scope.ownerId) {
    return apiError("Akun ini tidak dapat menyimpan judul laporan.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = dailyReportSettingsSchema.safeParse(body);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const settings = await saveDailyReportSettings({
      ownerId: scope.ownerId,
      date: parsed.data.date,
      title: parsed.data.title,
      notes: parsed.data.notes,
      actor: { id: user.id, name: user.name },
    });
    return apiOk({ settings });
  } catch (error) {
    console.error("Gagal menyimpan judul dan catatan laporan harian:", error);
    return apiError("Judul dan catatan gagal disimpan. Silakan coba lagi.", 500);
  }
}
