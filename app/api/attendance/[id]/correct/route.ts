import { getCurrentUser } from "@/lib/auth";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { mutateDb, pushAudit } from "@/lib/store";
import {
  attendanceMinutes,
  localDateTimeToIso,
  roundDuration,
} from "@/lib/time";
import { correctionSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan") {
    return apiError("Hanya atasan pembuat SPKL yang dapat mengoreksi absensi.", 403);
  }

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = correctionSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const checkInAt = localDateTimeToIso(parsed.data.checkInLocal);
  const checkOutAt = localDateTimeToIso(parsed.data.checkOutLocal);

  if (new Date(checkOutAt) <= new Date(checkInAt)) {
    return apiError("Jam pulang harus setelah jam masuk.");
  }

  try {
    const result = await mutateDb({ kind: "attendance", id }, (db) => {
      const attendance = db.attendances.find((item) => item.id === id);
      if (!attendance) throw new Error("Absensi tidak ditemukan.");
      const spkl = db.spkls.find((item) => item.id === attendance.spklId);
      if (!spkl) throw new Error("SPKL tidak ditemukan.");
      if (spkl.createdBy !== user.id) {
        throw new Error("Hanya atasan pembuat SPKL yang dapat mengoreksi absensi.");
      }

      if (new Date(checkOutAt) > new Date(spkl.endAt)) {
        throw new Error(
          "Jam pulang tidak boleh melewati jam selesai SPKL. Perpanjang SPKL terlebih dahulu jika pekerjaan berlanjut.",
        );
      }

      const duration = roundDuration(
        attendanceMinutes({
          checkInAt,
          checkOutAt,
          spklStartAt: spkl.startAt,
          spklEndAt: spkl.endAt,
        }),
        db.policy.roundingMinutes,
      );

      const before = {
        checkInAt: attendance.checkInAt,
        checkOutAt: attendance.checkOutAt,
        durationMinutes: attendance.durationMinutes,
        status: attendance.status,
      };

      attendance.checkInAt = checkInAt;
      attendance.checkOutAt = checkOutAt;
      attendance.durationMinutes = duration;
      attendance.status = "dikoreksi";
      attendance.correctionReason = parsed.data.reason;
      attendance.correctedBy = user.id;
      attendance.correctedAt = new Date().toISOString();
      attendance.updatedAt = new Date().toISOString();

      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "absensi_dikoreksi",
        objectType: "absensi",
        objectId: attendance.id,
        summary: `Absensi ${db.employees.find((employee) => employee.id === attendance.employeeId)?.name ?? "pekerja"} pada ${spkl.number} dikoreksi.`,
        before,
        after: {
          checkInAt,
          checkOutAt,
          durationMinutes: duration,
          status: "dikoreksi",
          reason: parsed.data.reason,
        },
      });

      return { attendance, employeeName: db.employees.find((e) => e.id === attendance.employeeId)?.name };
    });

    return apiOk({
      attendance: result.attendance,
      message: `Koreksi absensi ${result.employeeName ?? "pekerja"} tersimpan di log audit.`,
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal mengoreksi absensi.",
    );
  }
}
