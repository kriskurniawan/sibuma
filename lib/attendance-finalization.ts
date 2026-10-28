import { attendanceMinutes, roundDuration } from "./time";
import type { Attendance, Database, Spkl } from "./types";

function closeAttendance(db: Database, attendance: Attendance, spkl: Spkl) {
  const now = new Date();
  const checkout = new Date(
    Math.min(now.getTime(), new Date(spkl.endAt).getTime()),
  );
  const checkoutIso = checkout.toISOString();
  const rawMinutes = attendanceMinutes({
    checkInAt: attendance.checkInAt as string,
    checkOutAt: checkoutIso,
    spklStartAt: spkl.startAt,
    spklEndAt: spkl.endAt,
  });
  attendance.checkOutAt = checkoutIso;
  attendance.durationMinutes = roundDuration(
    rawMinutes,
    db.policy.roundingMinutes,
  );
  attendance.status = "ditutup_otomatis";
  attendance.updatedAt = now.toISOString();
  attendance.checkOutLocation = null;
  db.auditLogs.unshift({
    id: crypto.randomUUID(),
    actorId: "system",
    actorName: "Sistem",
    action: "sesi_ditutup_otomatis",
    objectType: "absensi",
    objectId: attendance.id,
    summary: `Sesi ${attendance.employeeId} pada ${spkl.number} ditutup otomatis saat jam SPKL berakhir.`,
    before: { status: "berjalan", checkOutAt: null },
    after: {
      status: "ditutup_otomatis",
      checkOutAt: checkoutIso,
      durationMinutes: attendance.durationMinutes,
    },
    createdAt: now.toISOString(),
  });
}

/**
 * Menutup sesi yang masih berjalan dan mencatat ketidakhadiran setelah jam SPKL
 * berakhir. Dijalankan secara lazy pada setiap pembacaan agar tidak bergantung
 * pada satu proses cron (cocok untuk deployment serverless).
 */
export function finalizeExpired(db: Database, targetId?: string) {
  const now = new Date();
  let changed = false;

  for (const spkl of db.spkls) {
    if (spkl.id !== targetId) continue;
    if (spkl.canceledAt) continue;
    if (new Date(spkl.endAt).getTime() >= now.getTime()) continue;

    const workerIds = db.spklWorkers
      .filter((worker) => worker.spklId === spkl.id)
      .map((worker) => worker.employeeId);

    for (const employeeId of workerIds) {
      const attendance = db.attendances.find(
        (item) =>
          item.spklId === spkl.id && item.employeeId === employeeId,
      );

      if (!attendance) {
        const absent: Attendance = {
          id: crypto.randomUUID(),
          spklId: spkl.id,
          employeeId,
          checkInAt: null,
          checkOutAt: null,
          durationMinutes: 0,
          checkInLocation: null,
          checkOutLocation: null,
          status: "tidak_hadir",
          correctionReason: null,
          correctedBy: null,
          correctedAt: null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        db.attendances.push(absent);
        db.auditLogs.unshift({
          id: crypto.randomUUID(),
          actorId: "system",
          actorName: "Sistem",
          action: "tidak_hadir_dicatat",
          objectType: "absensi",
          objectId: absent.id,
          summary: `Tidak hadir tercatat untuk ${employeeId} pada ${spkl.number}.`,
          before: null,
          after: { status: "tidak_hadir" },
          createdAt: now.toISOString(),
        });
        changed = true;
        continue;
      }

      if (attendance.status === "berjalan" && attendance.checkInAt) {
        closeAttendance(db, attendance, spkl);
        changed = true;
      }
    }
  }

  return changed;
}

