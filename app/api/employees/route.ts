import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { normalizePhone } from "@/lib/phone";
import { mutateDb, pushAudit } from "@/lib/store";
import type { Employee } from "@/lib/types";
import { employeeInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat menambahkan pekerja.", 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = employeeInputSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return apiError("Format nomor HP tidak valid. Gunakan format 08xx atau 628xx.");
  }

  try {
    const employee = await mutateDb({ kind: "employee", supervisorId: user.id, phone, email: parsed.data.email, nik: parsed.data.nik }, (db) => {
      const division = db.divisions.find(
        (item) =>
          item.id === parsed.data.divisionId &&
          item.supervisorId === user.id &&
          item.active,
      );
      if (!division) {
        throw new Error("Divisi tidak ditemukan atau sudah nonaktif.");
      }

      if (db.employees.some((item) => item.phone === phone)) {
        throw new Error("Nomor HP ini sudah terdaftar pada akun lain.");
      }
      if (
        db.employees.some(
          (item) =>
            item.nik.toLowerCase() === parsed.data.nik.toLowerCase(),
        )
      ) {
        throw new Error("NIK ini sudah terdaftar.");
      }

      if (db.employees.some((item) => item.email === parsed.data.email)) {
        throw new Error("Email ini sudah terdaftar pada akun lain.");
      }
      const now = new Date().toISOString();
      const created: Employee = {
        id: `emp_${crypto.randomUUID()}`,
        nik: parsed.data.nik,
        name: parsed.data.name,
        phone,
        email: parsed.data.email,
        role: "pekerja",
        accessMode: "full",
        supervisorId: user.id,
        divisionId: division.id,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      db.employees.push(created);
      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "karyawan_ditambahkan",
        objectType: "karyawan",
        objectId: created.id,
        summary: `${created.name} ditambahkan ke divisi ${division.name}.`,
        after: {
          name: created.name,
          nik: created.nik,
          phone: created.phone,
          email: created.email,
          divisionId: created.divisionId,
          divisionName: division.name,
          active: created.active,
        },
      });
      return created;
    });

    return apiOk({
      employee,
      message: `${employee.name} berhasil ditambahkan. Email atau WhatsApp sudah bisa dipakai untuk masuk.`,
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menambahkan pekerja.",
    );
  }
}
