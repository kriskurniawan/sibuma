import {
  canManageTeamReportSettings,
  isSuperAdmin,
  readOwnerId,
} from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { apiError, safeErrorMessage, validationMessage } from "@/lib/http";
import {
  buildOvertimeRecap,
  isValidRecapMonth,
  listRecapTeams,
  saveRecapSigners,
} from "@/lib/overtime-recap";
import { overtimeRecapExcelResponse } from "@/lib/overtime-recap-excel";
import { overtimeRecapPdfResponse } from "@/lib/overtime-recap-pdf";
import { formatDateHuman } from "@/lib/time";
import { overtimeRecapExportSchema } from "@/lib/validation";

export const runtime = "nodejs";

function normalizeName(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan" && !isSuperAdmin(user)) {
    return apiError("Kamu tidak memiliki izin untuk mengunduh rekap lembur.", 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = overtimeRecapExportSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));
  if (!isValidRecapMonth(parsed.data.month)) {
    return apiError("Bulan rekap tidak valid.");
  }

  const canSelectTeam = readOwnerId(user) === null;
  try {
    let ownerId: string;
    if (canSelectTeam) {
      if (!parsed.data.ownerId) {
        return apiError("Pilih tim yang akan diekspor.");
      }
      const teams = await listRecapTeams();
      if (!teams.some((team) => team.id === parsed.data.ownerId)) {
        return apiError("Tim rekap tidak ditemukan.", 404);
      }
      ownerId = parsed.data.ownerId;
    } else {
      ownerId = user.id;
    }

    const canManageSigners = canManageTeamReportSettings(user, ownerId);
    const preview = await buildOvertimeRecap({
      ownerId,
      month: parsed.data.month,
      canManageSigners,
    });

    if (preview.blockers.length > 0) {
      return apiError(
        preview.blockers.map((blocker) => blocker.message).join(" "),
        409,
        { blockers: preview.blockers },
      );
    }

    const signers = {
      buildingManagerName: normalizeName(
        parsed.data.buildingManagerName ?? preview.signers.buildingManagerName,
      ),
      managerName: normalizeName(
        parsed.data.managerName ?? preview.signers.managerName,
      ),
    };
    const exportedAt = formatDateHuman(
      new Date().toISOString(),
      "d MMMM yyyy, HH:mm",
    );
    const response =
      parsed.data.format === "pdf"
        ? overtimeRecapPdfResponse({ preview, signers, exportedAt })
        : await overtimeRecapExcelResponse({ preview, signers, exportedAt });

    if (canManageSigners) {
      await saveRecapSigners({
        ownerId,
        signers,
        actorId: user.id,
      });
    }

    return response;
  } catch (error) {
    return apiError(
      safeErrorMessage(error) || "Rekap lembur gagal diekspor.",
      500,
    );
  }
}
