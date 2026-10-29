import { can } from "@/lib/access";
import { insertAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { query, select, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { normalizePhone } from "@/lib/phone";
import { supervisorUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (!can(user.role, "supervisors.manage")) {
    return apiError("Kamu tidak memiliki izin untuk mengubah akun atasan.", 403);
  }

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = supervisorUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined;
  if (parsed.data.phone && !phone) {
    return apiError("Format nomor HP tidak valid. Gunakan format 08xx atau 628xx.");
  }

  try {
    const employee = await transaction(async (connection) => {
      const [item] = await select("employees", "id=$1", [id], connection, "FOR UPDATE");
      if (!item || item.role !== "atasan") {
        throw new Error("Akun atasan tidak ditemukan.");
      }

      const [duplicate] = await query<{ phone: boolean; nik: boolean; email: boolean }>(
        `SELECT
           EXISTS(SELECT 1 FROM employees WHERE id<>$1 AND phone=$2) phone,
           EXISTS(SELECT 1 FROM employees WHERE id<>$1 AND lower(nik)=lower($3)) nik,
           EXISTS(SELECT 1 FROM employees WHERE id<>$1 AND email=$4) email`,
        [item.id, phone ?? null, parsed.data.nik ?? null, parsed.data.email ?? null],
        connection,
      );
      if (phone && duplicate.phone) throw new Error("Nomor HP ini sudah terdaftar pada akun lain.");
      if (parsed.data.nik && duplicate.nik) throw new Error("NIK ini sudah terdaftar.");
      if (parsed.data.email && duplicate.email) throw new Error("Email ini sudah terdaftar pada akun lain.");

      const before = {
        name: item.name,
        nik: item.nik,
        phone: item.phone,
        email: item.email ?? null,
        accessMode: item.accessMode,
      };
      if (parsed.data.name) item.name = parsed.data.name;
      if (parsed.data.nik) item.nik = parsed.data.nik;
      if (phone) item.phone = phone;
      if (parsed.data.email) item.email = parsed.data.email;
      if (parsed.data.accessMode) item.accessMode = parsed.data.accessMode;
      item.updatedAt = new Date().toISOString();

      await query(
        `UPDATE employees SET name=$2,nik=$3,phone=$4,email=$5,access_mode=$6,updated_at=$7 WHERE id=$1`,
        [item.id, item.name, item.nik, item.phone, item.email, item.accessMode, item.updatedAt],
        connection,
      );
      if (
        before.phone !== item.phone ||
        before.email !== (item.email ?? null) ||
        before.nik !== item.nik
      ) {
        await query(
          `UPDATE otp_records SET status='gagal' WHERE employee_id=$1 AND status<>'terpakai'`,
          [item.id],
          connection,
        );
      }
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "atasan_diubah",
        objectType: "karyawan",
        objectId: item.id,
        summary: `Akun atasan ${item.name} diperbarui oleh super admin.`,
        before,
        after: {
          name: item.name,
          nik: item.nik,
          phone: item.phone,
          email: item.email ?? null,
          accessMode: item.accessMode,
        },
      });
      return item;
    });

    return apiOk({ employee, message: `Akun atasan ${employee.name} berhasil disimpan.` });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal memperbarui akun atasan.",
    );
  }
}
