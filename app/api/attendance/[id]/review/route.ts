import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk } from "@/lib/http";
import { mutateDb, pushAudit } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Atasan pembuat SPKL menyetujui sesi yang ditutup otomatis karena pekerja
 * tidak absen pulang. Durasi dan waktu pulang tidak diubah; persetujuan hanya
 * menandai bahwa penutupan otomatis sudah ditinjau.
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") {
    return apiError("Hanya atasan pembuat SPKL yang dapat menyetujui absensi.", 403);
  }

  const { id } = await params;

  try {
    const result = await mutateDb({ kind: "attendance", id }, (db) => {
      const attendance = db.attendances.find((item) => item.id === id);
      if (!attendance) throw new Error("Absensi tidak ditemukan.");
      const spkl = db.spkls.find((item) => item.id === attendance.spklId);
      if (!spkl) throw new Error("SPKL tidak ditemukan.");
      if (spkl.createdBy !== user.id) {
        throw new Error(
          "Hanya atasan pembuat SPKL yang dapat menyetujui absensi.",
        );
      }
      if (attendance.status !== "ditutup_otomatis") {
        throw new Error(
          "Hanya sesi yang ditutup otomatis yang memerlukan persetujuan.",
        );
      }

      const employeeName =
        db.employees.find((employee) => employee.id === attendance.employeeId)
          ?.name ?? "pekerja";

      if (attendance.reviewedAt) {
        return { attendance, employeeName, alreadyReviewed: true };
      }

      const now = new Date().toISOString();
      attendance.reviewedAt = now;
      attendance.reviewedBy = user.id;
      attendance.updatedAt = now;

      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "absensi_disetujui",
        objectType: "absensi",
        objectId: attendance.id,
        summary: `Penutupan otomatis absensi ${employeeName} pada ${spkl.number} disetujui.`,
        before: { reviewedAt: null, status: attendance.status },
        after: {
          reviewedAt: now,
          reviewedBy: user.id,
          status: attendance.status,
        },
      });

      return { attendance, employeeName, alreadyReviewed: false };
    });

    return apiOk({
      attendance: result.attendance,
      message: result.alreadyReviewed
        ? "Absensi ini sudah disetujui."
        : `Penutupan otomatis absensi ${result.employeeName} disetujui.`,
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menyetujui absensi.",
    );
  }
}
