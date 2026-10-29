import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { normalizePhone } from "@/lib/phone";
import { mutateDb, pushAudit } from "@/lib/store";
import { employeeUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat memperbarui data pekerja.", 403);
  }

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = employeeUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const phone = parsed.data.phone
    ? normalizePhone(parsed.data.phone)
    : undefined;
  if (parsed.data.phone && !phone) {
    return apiError("Format nomor HP tidak valid. Gunakan format 08xx atau 628xx.");
  }

  try {
    const employee = await mutateDb({ kind: "employee", id, supervisorId: user.id, phone, email: parsed.data.email, nik: parsed.data.nik }, (db) => {
      const item = db.employees.find((entry) => entry.id === id);
      if (!item) throw new Error("Pekerja tidak ditemukan.");
      if (item.supervisorId !== user.id) {
        throw new Error("Pekerja ini bukan bagian dari timmu.");
      }

      const targetDivision = parsed.data.divisionId
        ? db.divisions.find(
            (entry) =>
              entry.id === parsed.data.divisionId &&
              entry.supervisorId === user.id,
          )
        : null;
      if (parsed.data.divisionId && !targetDivision) {
        throw new Error("Divisi tidak ditemukan atau bukan bagian dari timmu.");
      }
      const movingDivision = Boolean(
        targetDivision && targetDivision.id !== item.divisionId,
      );
      if (movingDivision && !targetDivision!.active) {
        throw new Error("Divisi tujuan sudah nonaktif.");
      }
      if (movingDivision) {
        const blockingSpkl = db.spklWorkers
          .filter((assignment) => assignment.employeeId === item.id)
          .map((assignment) =>
            db.spkls.find((spkl) => spkl.id === assignment.spklId),
          )
          .find(
            (spkl) =>
              spkl &&
              !spkl.canceledAt &&
              new Date(spkl.endAt).getTime() > Date.now() &&
              spkl.divisionId !== targetDivision!.id,
          );
        if (blockingSpkl) {
          throw new Error(
            `Pekerja masih ditugaskan pada SPKL ${blockingSpkl.number} di divisi lama. Keluarkan dari SPKL tersebut atau tunggu SPKL selesai sebelum memindahkan divisi.`,
          );
        }
      }

      if (
        phone &&
        db.employees.some(
          (entry) => entry.id !== item.id && entry.phone === phone,
        )
      ) {
        throw new Error("Nomor HP ini sudah terdaftar pada akun lain.");
      }
      if (
        parsed.data.nik &&
        db.employees.some(
          (entry) =>
            entry.id !== item.id &&
            entry.nik.toLowerCase() === parsed.data.nik!.toLowerCase(),
        )
      ) {
        throw new Error("NIK ini sudah terdaftar.");
      }

      if (parsed.data.email && db.employees.some((entry) => entry.id !== item.id && entry.email === parsed.data.email)) {
        throw new Error("Email ini sudah terdaftar pada akun lain.");
      }
      const before = {
        name: item.name,
        nik: item.nik,
        phone: item.phone,
        email: item.email ?? null,
        divisionId: item.divisionId,
        active: item.active,
      };
      if (parsed.data.name) item.name = parsed.data.name;
      if (parsed.data.nik) item.nik = parsed.data.nik;
      if (phone) item.phone = phone;
      if (parsed.data.email) item.email = parsed.data.email;
      if (targetDivision) item.divisionId = targetDivision.id;
      if (typeof parsed.data.active === "boolean") {
        item.active = parsed.data.active;
      }
      if (before.phone !== item.phone || before.email !== (item.email ?? null) || before.nik !== item.nik || before.active !== item.active) {
        for (const otp of db.otps) if (otp.status !== "terpakai") otp.status = "gagal";
      }
      item.updatedAt = new Date().toISOString();

      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "karyawan_diubah",
        objectType: "karyawan",
        objectId: item.id,
        summary: `Data pekerja ${item.name} diperbarui.`,
        before,
        after: {
          name: item.name,
          nik: item.nik,
          phone: item.phone,
          email: item.email ?? null,
          divisionId: item.divisionId,
          divisionName:
            db.divisions.find((entry) => entry.id === item.divisionId)?.name ??
            null,
          active: item.active,
        },
      });

      return item;
    });

    return apiOk({
      employee,
      message: `Data ${employee.name} berhasil disimpan.`,
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal memperbarui pekerja.",
    );
  }
}
