import { CHECKOUT_GRACE_MINUTES } from "./constants";
import type { Attendance, Database, Spkl } from "./types";

/**
 * Sesi yang tidak pernah absen pulang tidak diberi waktu pulang palsu.
 * Durasi dibiarkan kosong agar rekap tidak menghitung lembur penuh; atasan
 * dapat mengoreksi bila pekerja benar-benar menyelesaikan pekerjaan.
 */
function closeMissingCheckout(
  db: Database,
  attendance: Attendance,
  spkl: Spkl,
  now: Date,
) {
  attendance.checkOutAt = null;
  attendance.durationMinutes = null;
  attendance.status = "ditutup_otomatis";
  attendance.updatedAt = now.toISOString();
  attendance.checkOutLocation = null;
  db.auditLogs.unshift({
    id: crypto.randomUUID(),
    actorId: "system",
    actorName: "Sistem",
    action: "sesi_tanpa_absen_pulang",
    objectType: "absensi",
    objectId: attendance.id,
    summary: `Absen pulang ${attendance.employeeId} pada ${spkl.number} tidak tercatat. Durasi tidak dihitung dan menunggu koreksi atasan bila diperlukan.`,
    before: {
      status: "berjalan",
      checkOutAt: null,
      durationMinutes: null,
    },
    after: {
      status: "ditutup_otomatis",
      checkOutAt: null,
      durationMinutes: null,
      checkoutGraceMinutes: CHECKOUT_GRACE_MINUTES,
    },
    createdAt: now.toISOString(),
  });
}

/**
 * Menutup sesi yang masih berjalan dan mencatat ketidakhadiran setelah jam SPKL
 * berakhir. Sesi yang sudah absen masuk diberi tenggang absen pulang; bila
 * tenggang terlewat, sesi ditutup tanpa mengisi waktu pulang. Dijalankan secara
 * lazy pada setiap pembacaan agar tidak bergantung pada satu proses cron.
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
    const graceEnd =
      new Date(spkl.endAt).getTime() + CHECKOUT_GRACE_MINUTES * 60_000;

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

      if (
        attendance.status === "berjalan" &&
        attendance.checkInAt &&
        now.getTime() > graceEnd
      ) {
        closeMissingCheckout(db, attendance, spkl, now);
        changed = true;
      }
    }
  }

  return changed;
}
