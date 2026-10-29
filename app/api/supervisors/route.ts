import { can } from "@/lib/access";
import { insertAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { insert, query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { normalizePhone } from "@/lib/phone";
import { supervisorInputSchema } from "@/lib/validation";
import type { Employee } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (!can(user.role, "supervisors.manage")) {
    return apiError("Kamu tidak memiliki izin untuk menambahkan akun atasan.", 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = supervisorInputSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return apiError("Format nomor HP tidak valid. Gunakan format 08xx atau 628xx.");
  }

  try {
    const employee = await transaction(async (connection) => {
      const [duplicate] = await query<{ phone: boolean; nik: boolean; email: boolean }>(
        `SELECT
           EXISTS(SELECT 1 FROM employees WHERE phone=$1) phone,
           EXISTS(SELECT 1 FROM employees WHERE lower(nik)=lower($2)) nik,
           EXISTS(SELECT 1 FROM employees WHERE email=$3) email`,
        [phone, parsed.data.nik, parsed.data.email],
        connection,
      );
      if (duplicate.phone) throw new Error("Nomor HP ini sudah terdaftar pada akun lain.");
      if (duplicate.nik) throw new Error("NIK ini sudah terdaftar.");
      if (duplicate.email) throw new Error("Email ini sudah terdaftar pada akun lain.");

      const now = new Date().toISOString();
      const created: Employee = {
        id: `emp_${crypto.randomUUID()}`,
        nik: parsed.data.nik,
        name: parsed.data.name,
        phone,
        email: parsed.data.email,
        role: "atasan",
        supervisorId: null,
        divisionId: null,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await insert("employees", created, connection);
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "atasan_ditambahkan",
        objectType: "karyawan",
        objectId: created.id,
        summary: `Akun atasan ${created.name} dibuat oleh super admin.`,
        after: {
          name: created.name,
          nik: created.nik,
          phone: created.phone,
          email: created.email,
          role: created.role,
          active: created.active,
        },
      });
      return created;
    });

    return apiOk({
      employee,
      message: `Akun atasan ${employee.name} dibuat. Atasan dapat masuk dengan WhatsApp atau email terdaftarnya.`,
    }, 201);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menambahkan akun atasan.",
    );
  }
}
