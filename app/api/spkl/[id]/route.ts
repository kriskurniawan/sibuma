import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { enqueueSpklNotifications } from "@/lib/notification-outbox";
import { scheduleWarnings } from "@/lib/schedule";
import { isUnchangedSpklEdit, splitWorkerIds } from "@/lib/spkl-edit";
import { mutateDb, pushAudit } from "@/lib/store";
import { durationLabel, minutesBetween, spklStatus, zonedToIso } from "@/lib/time";
import type { Employee, SpklWorker } from "@/lib/types";
import { spklInputSchema } from "@/lib/validation";
import { workLocationAddress } from "@/lib/work-locations";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat mengubah SPKL.", 403);
  }

  const { id } = await params;
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

  try {
    const result = await mutateDb({ kind: "spkl", id, workerIds, divisionId: input.divisionId, startAt, workLocationId: input.locationId }, (db) => {
      const duration = minutesBetween(startAt, endAt);
      if (duration > db.policy.dailyLimitMinutes) {
        throw new Error(
          `Durasi SPKL ${durationLabel(duration)} melewati batas harian ${durationLabel(db.policy.dailyLimitMinutes)}.`,
        );
      }

      const spkl = db.spkls.find((item) => item.id === id);
      if (!spkl) throw new Error("SPKL tidak ditemukan.");
      if (spkl.createdBy !== user.id) {
        throw new Error("Kamu tidak memiliki akses untuk mengubah SPKL ini.");
      }
      if (spklStatus(spkl) === "dibatalkan") {
        throw new Error("SPKL yang sudah dibatalkan tidak dapat diubah.");
      }
      if (new Date(spkl.endAt) < now) {
        throw new Error(
          "SPKL sudah selesai. Gunakan koreksi absensi untuk memperbaiki jam.",
        );
      }
      if (
        input.expectedUpdatedAt &&
        spkl.updatedAt !== input.expectedUpdatedAt
      ) {
        throw new Error(
          "SPKL sudah diubah oleh pengguna lain. Muat ulang halaman sebelum menyimpan.",
        );
      }

      const workLocation = db.workLocations.find(
        (location) => location.id === input.locationId,
      );
      if (!workLocation) {
        throw new Error("Titik absensi tidak ditemukan.");
      }
      if (!workLocation.active && spkl.workLocationId !== workLocation.id) {
        throw new Error("Titik absensi sudah nonaktif. Pilih titik lain.");
      }

      const division = db.divisions.find(
        (item) =>
          item.id === input.divisionId &&
          item.supervisorId === user.id &&
          (item.active || item.id === spkl.divisionId),
      );
      if (!division) {
        throw new Error("Divisi tidak ditemukan atau sudah nonaktif.");
      }

      const currentAssignments = db.spklWorkers.filter(
        (item) => item.spklId === spkl.id,
      );
      const currentWorkerIds = currentAssignments.map((item) => item.employeeId);
      // Pekerja yang sudah tercatat tetap dipertahankan meskipun akunnya
      // nonaktif atau di luar tim saat ini. Validasi aktif hanya untuk
      // penugasan baru agar edit judul tidak menghapus pekerja diam-diam.
      const { added: addedIds, removed: removedIds } = splitWorkerIds(
        currentWorkerIds,
        workerIds,
      );
      const team = db.employees.filter(
        (employee) =>
          employee.role === "pekerja" &&
          employee.active &&
          employee.accessMode !== "read_only" &&
          employee.supervisorId === user.id &&
          addedIds.includes(employee.id),
      );
      if (team.length !== addedIds.length) {
        throw new Error(
          "Satu atau lebih pekerja baru tidak ditemukan, tidak aktif, atau bukan bagian dari timmu.",
        );
      }

      const attendances = db.attendances.filter(
        (attendance) => attendance.spklId === spkl.id,
      );
      const attendedIds = new Set(
        attendances
          .filter((attendance) => attendance.checkInAt)
          .map((attendance) => attendance.employeeId),
      );
      const blockedRemoval = removedIds.find((employeeId) =>
        attendedIds.has(employeeId),
      );
      if (blockedRemoval) {
        throw new Error(
          "Pekerja yang sudah melakukan absen masuk tidak dapat dikeluarkan dari SPKL. Koreksi absensinya terlebih dahulu jika diperlukan.",
        );
      }

      const earliestOnTimeCheckIn = attendances
        .filter(
          (attendance) =>
            attendance.checkInAt &&
            new Date(attendance.checkInAt) >= new Date(spkl.startAt),
        )
        .sort(
          (a, b) =>
            new Date(a.checkInAt as string).getTime() -
            new Date(b.checkInAt as string).getTime(),
        )[0];
      // Absen lebih awal tetap sah, jadi hanya absensi tepat waktu yang
      // membatasi pemindahan jam mulai.
      if (
        earliestOnTimeCheckIn?.checkInAt &&
        new Date(startAt) > new Date(earliestOnTimeCheckIn.checkInAt)
      ) {
        throw new Error(
          "Jam mulai tidak boleh dipindahkan melewati absensi tepat waktu yang sudah tercatat.",
        );
      }
      if (
        attendances.some((attendance) => attendance.status === "berjalan") &&
        new Date(endAt) < now
      ) {
        throw new Error(
          "Jam selesai tidak boleh di masa lalu selama masih ada sesi berjalan.",
        );
      }

      const warnings = scheduleWarnings({
        employeeIds: workerIds,
        startAt,
        endAt,
        dailyLimitMinutes: db.policy.dailyLimitMinutes,
        weeklyLimitMinutes: db.policy.weeklyLimitMinutes,
        schedules: db.spkls.flatMap((item) =>
          db.spklWorkers
            .filter((assignment) => assignment.spklId === item.id)
            .map((assignment) => ({
              employeeId: assignment.employeeId,
              spklId: item.id,
              title: item.title,
              startAt: item.startAt,
              endAt: item.endAt,
              canceled: Boolean(item.canceledAt),
            })),
        ),
        excludeSpklId: spkl.id,
      });

      const unchanged = isUnchangedSpklEdit(
        spkl,
        {
          title: input.title,
          description: input.description,
          date: input.date,
          startAt,
          endAt,
          divisionId: division.id,
          workLocationId: workLocation.id,
          radiusMeters: input.radiusMeters,
          requiresDocumentation: input.requiresDocumentation,
          workerIds,
        },
        currentWorkerIds,
      );

      // Simpan tanpa perubahan tidak boleh menambah audit atau mengirim ulang
      // notifikasi “SPKL diperbarui”.
      if (unchanged) {
        return {
          spkl: { ...spkl },
          team: [] as Employee[],
          removedEmployees: [] as Employee[],
          warnings,
          addedIds: [] as string[],
          changed: false,
        };
      }

      const before = {
        title: spkl.title,
        description: spkl.description,
        startAt: spkl.startAt,
        endAt: spkl.endAt,
        location: spkl.location,
        workLocationId: spkl.workLocationId,
        radiusMeters: spkl.radiusMeters,
        divisionId: spkl.divisionId,
        workers: currentWorkerIds,
      };

      spkl.title = input.title;
      spkl.description = input.description;
      spkl.date = input.date;
      spkl.startAt = startAt;
      spkl.endAt = endAt;
      spkl.divisionId = division.id;
      spkl.location = {
        latitude: workLocation.latitude,
        longitude: workLocation.longitude,
        address: workLocationAddress(workLocation),
      };
      spkl.workLocationId = workLocation.id;
      spkl.radiusMeters = input.radiusMeters;
      spkl.requiresDocumentation = input.requiresDocumentation;
      spkl.updatedAt = now.toISOString();

      for (const employeeId of removedIds) {
        const index = db.spklWorkers.findIndex(
          (item) =>
            item.spklId === spkl.id && item.employeeId === employeeId,
        );
        if (index >= 0) db.spklWorkers.splice(index, 1);
      }
      const newAssignments: SpklWorker[] = addedIds.map((employeeId) => ({
        spklId: spkl.id,
        employeeId,
        assignedAt: now.toISOString(),
      }));
      db.spklWorkers.push(...newAssignments);

      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "spkl_diubah",
        objectType: "spkl",
        objectId: spkl.id,
        summary: `SPKL ${spkl.number} “${spkl.title}” diperbarui.`,
        before,
        after: {
          title: spkl.title,
          description: spkl.description,
          startAt: spkl.startAt,
          endAt: spkl.endAt,
          location: spkl.location,
          workLocationId: spkl.workLocationId,
          radiusMeters: spkl.radiusMeters,
          divisionId: spkl.divisionId,
          divisionName: division.name,
          workers: workerIds,
        },
      });

      const removedEmployees = db.employees.filter(
        (employee) =>
          removedIds.includes(employee.id) &&
          employee.active &&
          employee.accessMode !== "read_only",
      );
      const notifiedWorkers = db.employees.filter(
        (employee) =>
          workerIds.includes(employee.id) &&
          employee.active &&
          employee.accessMode !== "read_only",
      );

      return {
        spkl: { ...spkl },
        team: notifiedWorkers as Employee[],
        removedEmployees: removedEmployees as Employee[],
        warnings,
        addedIds,
        changed: true,
      };
    }, {
      afterPersist: async (connection, result) => {
        if (!result.changed) return;

        await enqueueSpklNotifications(
          connection,
          "spkl_diubah",
          result.spkl,
          result.team,
          "Periksa kembali jadwal, lokasi, dan detail pekerjaanmu.",
        );

        if (result.removedEmployees.length > 0) {
          await enqueueSpklNotifications(
            connection,
            "spkl_diubah",
            result.spkl,
            result.removedEmployees,
            "Kamu tidak lagi ditugaskan pada SPKL ini. Abaikan pesan ini jika kamu sudah tidak memiliki penugasan.",
          );
        }
      },
    });

    return apiOk({
      spkl: result.spkl,
      warnings: result.warnings,
      newWorkerIds: result.addedIds,
      changed: result.changed,
      message: result.changed
        ? "Perubahan SPKL disimpan dan pekerja akan diberi tahu."
        : "Tidak ada perubahan pada SPKL, jadi notifikasi tidak dikirim ulang.",
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal mengubah SPKL.",
    );
  }
}
