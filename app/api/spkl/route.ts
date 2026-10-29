import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { notifySpkl } from "@/lib/notifications";
import { scheduleWarnings } from "@/lib/schedule";
import { mutateDb, pushAudit } from "@/lib/store";
import { durationLabel, minutesBetween, zonedToIso } from "@/lib/time";
import type { Employee, Spkl, SpklWorker } from "@/lib/types";
import { spklInputSchema } from "@/lib/validation";
import { workLocationAddress } from "@/lib/work-locations";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat membuat SPKL.", 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }

  const parsed = spklInputSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const input = parsed.data;
  const workerIds = [...new Set(input.workerIds)];
  const startAt = zonedToIso(input.date, input.startTime);
  const endAt = zonedToIso(input.date, input.endTime);
  const now = new Date();

  if (new Date(endAt) <= new Date(startAt)) {
    return apiError("Jam selesai harus setelah jam mulai.");
  }
  if (new Date(endAt) <= now) {
    return apiError(
      "SPKL tidak dapat dibuat karena jam selesai sudah lewat. Pilih jam selesai setelah sekarang.",
    );
  }

  try {
    const result = await mutateDb({ kind: "spkl", workerIds, divisionId: input.divisionId, sequence: true, startAt, workLocationId: input.locationId }, (db) => {
      const duration = minutesBetween(startAt, endAt);
      if (duration > db.policy.dailyLimitMinutes) {
        throw new Error(
          `Durasi SPKL ${durationLabel(duration)} melewati batas harian ${durationLabel(db.policy.dailyLimitMinutes)}.`,
        );
      }

      const workLocation = db.workLocations.find(
        (location) => location.id === input.locationId,
      );
      if (!workLocation) {
        throw new Error("Titik absensi tidak ditemukan.");
      }
      if (!workLocation.active) {
        throw new Error("Titik absensi sudah nonaktif. Pilih titik lain.");
      }

      const division = db.divisions.find(
        (item) =>
          item.id === input.divisionId &&
          item.supervisorId === user.id &&
          item.active,
      );
      if (!division) {
        throw new Error("Divisi tidak ditemukan atau sudah nonaktif.");
      }

      const team = db.employees.filter(
        (employee) =>
          employee.role === "pekerja" &&
          employee.active &&
          employee.accessMode !== "read_only" &&
          employee.supervisorId === user.id &&
          workerIds.includes(employee.id),
      );
      if (team.length !== workerIds.length) {
        throw new Error(
          "Satu atau lebih pekerja tidak ditemukan, tidak aktif, atau bukan bagian dari timmu.",
        );
      }

      const warnings = scheduleWarnings({
        employeeIds: workerIds,
        startAt,
        endAt,
        dailyLimitMinutes: db.policy.dailyLimitMinutes,
        weeklyLimitMinutes: db.policy.weeklyLimitMinutes,
        schedules: db.spkls.flatMap((spkl) =>
          db.spklWorkers
            .filter((assignment) => assignment.spklId === spkl.id)
            .map((assignment) => ({
              employeeId: assignment.employeeId,
              spklId: spkl.id,
              title: spkl.title,
              startAt: spkl.startAt,
              endAt: spkl.endAt,
              canceled: Boolean(spkl.canceledAt),
            })),
        ),
      });

      const sequence = db.meta.nextSpklSequence;
      db.meta.nextSpklSequence += 1;
      const spkl: Spkl = {
        id: `spkl_${crypto.randomUUID()}`,
        number: `SPKL/${input.date.slice(0, 4)}/${input.date.slice(5, 7)}/${String(sequence).padStart(3, "0")}`,
        title: input.title,
        description: input.description,
        date: input.date,
        startAt,
        endAt,
        location: {
          latitude: workLocation.latitude,
          longitude: workLocation.longitude,
          address: workLocationAddress(workLocation),
        },
        workLocationId: workLocation.id,
        radiusMeters: input.radiusMeters,
        createdBy: user.id,
        divisionId: division.id,
        requiresDocumentation: input.requiresDocumentation,
        canceledAt: null,
        cancelReason: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      const assignments: SpklWorker[] = workerIds.map((employeeId) => ({
        spklId: spkl.id,
        employeeId,
        assignedAt: now.toISOString(),
      }));

      db.spkls.push(spkl);
      db.spklWorkers.push(...assignments);
      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "spkl_dibuat",
        objectType: "spkl",
        objectId: spkl.id,
        summary: `SPKL ${spkl.number} “${spkl.title}” dibuat untuk ${team.length} pekerja.`,
        after: {
          ...spkl,
          divisionName: division.name,
          workers: team.map((employee) => employee.name),
        },
      });

      return { spkl, team, warnings };
    });

    after(async () => {
      // `after` memastikan notifikasi tetap selesai di Vercel setelah respons dikirim.
      await notifySpkl("spkl_baru", result.spkl, result.team).catch(() => {
        // Notifikasi masuk ke outbox dan tidak boleh menggagalkan pembuatan SPKL.
      });
    });

    return apiOk({
      id: result.spkl.id,
      spkl: result.spkl,
      warnings: result.warnings,
      message: "SPKL berhasil dibuat dan langsung berlaku.",
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal membuat SPKL.",
    );
  }
}
