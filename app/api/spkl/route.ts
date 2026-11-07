import { getCurrentUser } from "@/lib/auth";
import { select } from "@/lib/db";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { enqueueSpklNotifications } from "@/lib/notification-outbox";
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
  const requestId = input.requestId?.trim() || null;
  const startAt = zonedToIso(input.date, input.startTime);
  const endAt = zonedToIso(input.date, input.endTime);
  const now = new Date();

  // Replay permintaan yang sama harus mengembalikan SPKL pertama, bukan
  // membuat SPKL dan antrean WhatsApp baru.
  if (requestId) {
    const [existing] = await select(
      "spkls",
      "created_by=$1 AND request_id=$2",
      [user.id, requestId],
    );
    if (existing) {
      return apiOk({
        id: existing.id,
        spkl: existing,
        warnings: [],
        replayed: true,
        message:
          "SPKL untuk permintaan ini sudah dibuat sebelumnya. Tidak ada data atau notifikasi baru.",
      });
    }
  }

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
        requestId,
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
    }, {
      afterPersist: async (connection, result) => {
        await enqueueSpklNotifications(
          connection,
          "spkl_baru",
          result.spkl,
          result.team,
        );
      },
    });

    return apiOk({
      id: result.spkl.id,
      spkl: result.spkl,
      warnings: result.warnings,
      message: "SPKL berhasil dibuat dan langsung berlaku.",
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    const constraint = (error as { constraint?: string }).constraint;
    if (
      requestId &&
      code === "23505" &&
      (!constraint || constraint === "spkls_request_unique")
    ) {
      const [existing] = await select(
        "spkls",
        "created_by=$1 AND request_id=$2",
        [user.id, requestId],
      );
      if (existing) {
        return apiOk({
          id: existing.id,
          spkl: existing,
          warnings: [],
          replayed: true,
          message:
            "SPKL untuk permintaan ini sudah dibuat sebelumnya. Tidak ada data atau notifikasi baru.",
        });
      }
    }
    return apiError(
      error instanceof Error ? error.message : "Gagal membuat SPKL.",
    );
  }
}
