import { getCurrentUser } from "@/lib/auth";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { distanceMeters } from "@/lib/geo";
import { mutateDb, pushAudit } from "@/lib/store";
import { checkInOpensAt, formatDateHuman, spklStatus } from "@/lib/time";
import type { Attendance } from "@/lib/types";
import { checkInSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "pekerja") {
    return apiError("Absensi hanya dapat dilakukan oleh pekerja.", 403);
  }

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checkInSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const result = await mutateDb({ kind: "spkl", id }, (db) => {
      const spkl = db.spkls.find((item) => item.id === id);
      if (!spkl) throw new Error("SPKL tidak ditemukan.");
      if (spklStatus(spkl) === "dibatalkan") {
        throw new Error("SPKL ini sudah dibatalkan.");
      }
      const assigned = db.spklWorkers.some(
        (item) => item.spklId === spkl.id && item.employeeId === user.id,
      );
      if (!assigned) throw new Error("Kamu tidak ditugaskan pada SPKL ini.");

      const now = new Date();
      const opensAt = new Date(checkInOpensAt(spkl.date));
      if (now < opensAt) {
        throw new Error(
          `Absen masuk baru dibuka pada ${formatDateHuman(spkl.startAt, "d MMMM yyyy")} pukul 00:00 WIB.`,
        );
      }
      if (now > new Date(spkl.endAt)) {
        throw new Error("Waktu SPKL sudah habis. Absen masuk terkunci.");
      }

      const existing = db.attendances.find(
        (item) => item.spklId === spkl.id && item.employeeId === user.id,
      );
      if (existing) {
        throw new Error(
          existing.status === "tidak_hadir"
            ? "Kamu tercatat tidak hadir pada SPKL ini."
            : "Kamu sudah melakukan absen masuk pada SPKL ini.",
        );
      }

      if (parsed.data.accuracy > db.policy.maxGpsAccuracyMeters) {
        throw new Error(
          `Akurasi GPS terlalu rendah (${Math.round(parsed.data.accuracy)} m). Maksimal ${db.policy.maxGpsAccuracyMeters} m. Coba di area terbuka.`,
        );
      }

      const distance = distanceMeters(spkl.location, {
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
      });
      if (distance > spkl.radiusMeters) {
        const error = new Error(
          `Kamu berada ${distance} m dari titik SPKL. Radius absen ${spkl.radiusMeters} m.`,
        ) as Error & { details?: unknown };
        error.details = {
          distance,
          radiusMeters: spkl.radiusMeters,
          accuracy: parsed.data.accuracy,
        };
        throw error;
      }

      const capturedAt = now.toISOString();
      const attendance: Attendance = {
        id: `att_${crypto.randomUUID()}`,
        spklId: spkl.id,
        employeeId: user.id,
        checkInAt: capturedAt,
        checkOutAt: null,
        durationMinutes: null,
        checkInLocation: {
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          accuracy: parsed.data.accuracy,
          distanceFromSite: distance,
          capturedAt,
        },
        checkOutLocation: null,
        status: "berjalan",
        correctionReason: null,
        correctedBy: null,
        correctedAt: null,
        createdAt: capturedAt,
        updatedAt: capturedAt,
      };

      db.attendances.push(attendance);
      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "absen_masuk",
        objectType: "absensi",
        objectId: attendance.id,
        summary: `${user.name} absen masuk pada ${spkl.number}.`,
        after: {
          checkInAt: capturedAt,
          scheduledStartAt: spkl.startAt,
          earlyCheckIn: now < new Date(spkl.startAt),
          distanceFromSite: distance,
          accuracy: parsed.data.accuracy,
        },
      });

      return { attendance, spklNumber: spkl.number };
    });

    return apiOk({
      attendance: result.attendance,
      message: `Absen masuk tercatat pada ${result.spklNumber}. Selamat bekerja!`,
    });
  } catch (error) {
    const typed = error as Error & { details?: unknown };
    return apiError(
      typed.message || "Gagal melakukan absen masuk.",
      422,
      typed.details,
    );
  }
}
