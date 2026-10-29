import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { distanceMeters } from "@/lib/geo";
import { mutateDb, pushAudit } from "@/lib/store";
import { attendanceMinutes, roundDuration } from "@/lib/time";
import { checkInSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
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
    const result = await mutateDb({ kind: "attendance", id }, (db) => {
      const attendance = db.attendances.find((item) => item.id === id);
      if (!attendance) throw new Error("Sesi absensi tidak ditemukan.");
      if (attendance.employeeId !== user.id) {
        throw new Error("Kamu tidak memiliki akses ke sesi absensi ini.");
      }

      const spkl = db.spkls.find((item) => item.id === attendance.spklId);
      if (!spkl) throw new Error("SPKL tidak ditemukan.");
      if (attendance.status !== "berjalan") {
        throw new Error(
          "Sesi ini tidak sedang berjalan. Hubungi atasan jika perlu koreksi.",
        );
      }
      if (!attendance.checkInAt) {
        throw new Error("Sesi absensi belum memiliki waktu masuk.");
      }

      if (parsed.data.accuracy > db.policy.maxGpsAccuracyMeters) {
        throw new Error(
          `Akurasi GPS terlalu rendah (${Math.round(parsed.data.accuracy)} m). Maksimal ${db.policy.maxGpsAccuracyMeters} m.`,
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

      if (spkl.requiresDocumentation) {
        const docs = db.documentations.filter(
          (doc) => doc.attendanceId === attendance.id,
        );
        if (docs.length === 0) {
          throw new Error(
            "Unggah minimal satu dokumentasi pekerjaan sebelum absen pulang.",
          );
        }
      }

      const now = new Date();
      if (now > new Date(spkl.endAt)) {
        throw new Error(
          "Waktu SPKL sudah habis. Sesi ditutup otomatis oleh sistem.",
        );
      }

      const checkout = now.toISOString();
      const duration = roundDuration(
        attendanceMinutes({
          checkInAt: attendance.checkInAt,
          checkOutAt: checkout,
          spklStartAt: spkl.startAt,
          spklEndAt: spkl.endAt,
        }),
        db.policy.roundingMinutes,
      );

      attendance.checkOutAt = checkout;
      attendance.durationMinutes = duration;
      attendance.checkOutLocation = {
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        accuracy: parsed.data.accuracy,
        distanceFromSite: distance,
        capturedAt: checkout,
      };
      attendance.status = "selesai";
      attendance.updatedAt = checkout;

      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "absen_pulang",
        objectType: "absensi",
        objectId: attendance.id,
        summary: `${user.name} absen pulang pada ${spkl.number}.`,
        after: {
          checkOutAt: checkout,
          durationMinutes: duration,
          distanceFromSite: distance,
          accuracy: parsed.data.accuracy,
        },
      });

      return { attendance, spklNumber: spkl.number };
    });

    return apiOk({
      attendance: result.attendance,
      message: `Absen pulang tercatat. Terima kasih, pekerjaanmu tersimpan di ${result.spklNumber}.`,
    });
  } catch (error) {
    const typed = error as Error & { details?: unknown };
    return apiError(
      typed.message || "Gagal melakukan absen pulang.",
      422,
      typed.details,
    );
  }
}
