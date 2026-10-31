import { insertAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { normalizePhone } from "@/lib/phone";
import { profileUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const wantsPhoneChange = parsed.data.phone !== undefined;
  if (wantsPhoneChange && user.role !== "super_admin") {
    return apiError(
      "Nomor WhatsApp hanya dapat diubah oleh super admin.",
      403,
    );
  }
  const nextPhone = wantsPhoneChange
    ? normalizePhone(parsed.data.phone ?? "")
    : undefined;
  if (wantsPhoneChange && !nextPhone) {
    return apiError(
      "Format nomor HP tidak valid. Gunakan format 08xx atau 628xx.",
    );
  }

  try {
    const employee = await transaction(async (connection) => {
      const [item] = await query<{ name: string; phone: string }>(
        "SELECT name,phone FROM employees WHERE id=$1 FOR UPDATE",
        [user.id],
        connection,
      );
      if (!item) throw new Error("Akun tidak ditemukan.");

      const nextName = parsed.data.name;
      const resolvedPhone = nextPhone ?? item.phone;
      const phoneChanged = Boolean(nextPhone && nextPhone !== item.phone);
      const nameChanged = nextName !== item.name;

      if (phoneChanged) {
        const [duplicate] = await query<{ exists: boolean }>(
          "SELECT EXISTS(SELECT 1 FROM employees WHERE id<>$1 AND phone=$2) AS exists",
          [user.id, nextPhone],
          connection,
        );
        if (duplicate?.exists) {
          throw new Error("Nomor HP ini sudah terdaftar pada akun lain.");
        }
      }

      const now = new Date().toISOString();
      await query(
        "UPDATE employees SET name=$2,phone=$3,updated_at=$4 WHERE id=$1",
        [user.id, nextName, resolvedPhone, now],
        connection,
      );

      if (phoneChanged) {
        await query(
          "UPDATE otp_records SET status='gagal' WHERE employee_id=$1 AND status<>'terpakai'",
          [user.id],
          connection,
        );
      }

      const summary =
        phoneChanged && nameChanged
          ? `${item.name} memperbarui nama dan nomor WhatsApp profil.`
          : phoneChanged
            ? `${item.name} memperbarui nomor WhatsApp profil.`
            : `${item.name} memperbarui nama profil menjadi ${nextName}.`;

      await insertAudit(connection, {
        actorId: user.id,
        actorName: item.name,
        action: "profil_diubah",
        objectType: "karyawan",
        objectId: user.id,
        summary,
        before: phoneChanged
          ? { name: item.name, phone: item.phone }
          : { name: item.name },
        after: phoneChanged
          ? { name: nextName, phone: resolvedPhone }
          : { name: nextName },
      });

      return { name: nextName, phone: resolvedPhone, phoneChanged };
    });

    return apiOk({
      name: employee.name,
      phone: employee.phone,
      message: employee.phoneChanged
        ? "Profil dan nomor WhatsApp diperbarui."
        : "Nama profil diperbarui.",
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return apiError("Nomor HP ini sudah terdaftar pada akun lain.");
    }
    return apiError(
      error instanceof Error ? error.message : "Gagal memperbarui profil.",
    );
  }
}
