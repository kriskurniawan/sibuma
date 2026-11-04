import {
  canManageTeamReportSettings,
  isSuperAdmin,
  readOwnerId,
} from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { apiError, apiOk, safeErrorMessage } from "@/lib/http";
import {
  buildOvertimeRecap,
  isValidRecapMonth,
  listRecapTeams,
} from "@/lib/overtime-recap";
import { currentMonthRange } from "@/lib/time";

export const runtime = "nodejs";

function currentRecapMonth() {
  return currentMonthRange().from.slice(0, 7);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan" && !isSuperAdmin(user)) {
    return apiError("Kamu tidak memiliki izin untuk membuka rekap lembur.", 403);
  }

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month")?.trim();
  if (monthParam && !isValidRecapMonth(monthParam)) {
    return apiError("Bulan rekap tidak valid.");
  }
  const month = monthParam || currentRecapMonth();

  const canSelectTeam = readOwnerId(user) === null;
  try {
    const teams = canSelectTeam ? await listRecapTeams() : undefined;
    const requestedOwner = url.searchParams.get("ownerId")?.trim();

    let ownerId: string;
    if (canSelectTeam) {
      if (!requestedOwner) {
        return apiOk({ teams, preview: null, canSelectTeam });
      }
      if (!teams?.some((team) => team.id === requestedOwner)) {
        return apiError("Tim rekap tidak ditemukan.", 404);
      }
      ownerId = requestedOwner;
    } else {
      ownerId = user.id;
    }

    const preview = await buildOvertimeRecap({
      ownerId,
      month,
      canManageSigners: canManageTeamReportSettings(user, ownerId),
    });

    return apiOk({ teams, preview, canSelectTeam });
  } catch (error) {
    return apiError(
      safeErrorMessage(error) || "Rekap lembur gagal dimuat.",
      500,
    );
  }
}
