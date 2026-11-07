import {
  canManageTeamReportSettings,
  isSuperAdmin,
  readOwnerId,
} from "@/lib/access";
import { currentOvertimePeriodRange } from "@/lib/active-overtime-period";
import { getCurrentUser } from "@/lib/auth";
import { apiError, apiOk, safeErrorMessage } from "@/lib/http";
import {
  buildOvertimeRecap,
  isValidRecapDate,
  listRecapTeams,
} from "@/lib/overtime-recap";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan" && !isSuperAdmin(user)) {
    return apiError("Kamu tidak memiliki izin untuk membuka rekap lembur.", 403);
  }

  const url = new URL(request.url);
  const requestedFrom = url.searchParams.get("from")?.trim();
  const requestedTo = url.searchParams.get("to")?.trim();
  if (Boolean(requestedFrom) !== Boolean(requestedTo)) {
    return apiError("Rentang tanggal rekap tidak lengkap.");
  }
  const fallback = currentOvertimePeriodRange();
  const from = requestedFrom || fallback.from;
  const to = requestedTo || fallback.to;
  if (
    !isValidRecapDate(from) ||
    !isValidRecapDate(to) ||
    from > to
  ) {
    return apiError("Rentang tanggal rekap tidak valid.");
  }

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
      from,
      to,
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
