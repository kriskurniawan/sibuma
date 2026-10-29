import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk } from "@/lib/http";
import { notifySpkl } from "@/lib/notifications";
import { mutateDb, pushAudit } from "@/lib/store";
import {
  attendanceMinutes,
  roundDuration,
  spklStatus,
} from "@/lib/time";
import type { Employee } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat membatalkan SPKL.", 403);
  }

  const { id } = await params;
  let reason = "";
  try {
    const body = (await request.json()) as { reason?: string };
    reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  } catch {
    reason = "";
  }

  try {
    const result = await mutateDb({ kind: "spkl", id }, (db) => {
      const spkl = db.spkls.find((item) => item.id === id);
      if (!spkl) throw new Error("SPKL tidak ditemukan.");
      if (spkl.createdBy !== user.id) {
        throw new Error("Kamu tidak memiliki akses untuk membatalkan SPKL ini.");
      }
      if (spkl.canceledAt) throw new Error("SPKL ini sudah dibatalkan.");
      if (spklStatus(spkl) === "selesai") {
        throw new Error("SPKL yang sudah selesai tidak dapat dibatalkan.");
      }

      const now = new Date();
      spkl.canceledAt = now.toISOString();
      spkl.cancelReason = reason || "Dibatalkan oleh atasan.";
      spkl.updatedAt = now.toISOString();

      const openSessions = db.attendances.filter(
        (attendance) =>
          attendance.spklId === spkl.id && attendance.status === "berjalan",
      );
      for (const attendance of openSessions) {
        if (!attendance.checkInAt) continue;
        attendance.checkOutAt = now.toISOString();
        attendance.durationMinutes = roundDuration(
          attendanceMinutes({
            checkInAt: attendance.checkInAt,
            checkOutAt: attendance.checkOutAt,
            spklStartAt: spkl.startAt,
            spklEndAt: spkl.endAt,
          }),
          db.policy.roundingMinutes,
        );
        attendance.status = "ditutup_otomatis";
        attendance.updatedAt = now.toISOString();
        attendance.checkOutLocation = null;
      }

      const workers = db.employees.filter(
        (employee) =>
          employee.active &&
          db.spklWorkers.some(
            (assignment) =>
              assignment.spklId === spkl.id &&
              assignment.employeeId === employee.id,
          ),
      );

      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "spkl_dibatalkan",
        objectType: "spkl",
        objectId: spkl.id,
        summary: `SPKL ${spkl.number} “${spkl.title}” dibatalkan.`,
        before: { canceledAt: null },
        after: {
          canceledAt: spkl.canceledAt,
          cancelReason: spkl.cancelReason,
          closedSessions: openSessions.length,
        },
      });

      return { spkl: { ...spkl }, workers: workers as Employee[] };
    });

    after(async () => {
      // `after` memastikan notifikasi tetap selesai di Vercel setelah respons dikirim.
      await notifySpkl(
        "spkl_dibatalkan",
        result.spkl,
        result.workers,
        `Alasan: ${result.spkl.cancelReason ?? "Dibatalkan oleh atasan."}`,
      ).catch(() => undefined);
    });

    return apiOk({
      message: "SPKL dibatalkan. Pekerja akan menerima notifikasi.",
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal membatalkan SPKL.",
    );
  }
}
