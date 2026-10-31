import { insertAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { query, transaction } from "@/lib/db";
import { isCompanyEmail } from "@/lib/email";
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

  const nextEmail = parsed.data.email;
  if (nextEmail && isCompanyEmail(nextEmail)) {
    return apiError(
      "Email wajib memakai domain selain bmbi.my.id. Gunakan email pribadi yang aktif.",
    );
  }

  try {
    const employee = await transaction(async (connection) => {
      const [item] = await query<{
        name: string;
        phone: string;
        email: string | null;
      }>(
        "SELECT name,phone,email FROM employees WHERE id=$1 FOR UPDATE",
        [user.id],
        connection,
      );
      if (!item) throw new Error("Akun tidak ditemukan.");

      const nextName = parsed.data.name;
      const resolvedPhone = nextPhone ?? item.phone;
      const currentEmail = item.email ?? null;
      const resolvedEmail = nextEmail ?? currentEmail;
      const phoneChanged = Boolean(nextPhone && nextPhone !== item.phone);
      const nameChanged = nextName !== item.name;
      const emailChanged = Boolean(nextEmail && nextEmail !== currentEmail);

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

      if (emailChanged) {
        const [duplicate] = await query<{ exists: boolean }>(
          "SELECT EXISTS(SELECT 1 FROM employees WHERE id<>$1 AND lower(email)=lower($2)) AS exists",
          [user.id, nextEmail],
          connection,
        );
        if (duplicate?.exists) {
          throw new Error("Email ini sudah terdaftar pada akun lain.");
        }
      }

      const now = new Date().toISOString();
      await query(
        "UPDATE employees SET name=$2,phone=$3,email=$4,updated_at=$5 WHERE id=$1",
        [user.id, nextName, resolvedPhone, resolvedEmail, now],
        connection,
      );

      if (phoneChanged || emailChanged) {
        await query(
          "UPDATE otp_records SET status='gagal' WHERE employee_id=$1 AND status<>'terpakai'",
          [user.id],
          connection,
        );
      }

      const changes: string[] = [];
      if (nameChanged) changes.push("nama");
      if (phoneChanged) changes.push("nomor WhatsApp");
      if (emailChanged) changes.push("email");
      const summary =
        changes.length === 0
          ? `${item.name} menyimpan profil tanpa perubahan.`
          : `${item.name} memperbarui ${joinChanges(changes)} profil.`;

      await insertAudit(connection, {
        actorId: user.id,
        actorName: item.name,
        action: "profil_diubah",
        objectType: "karyawan",
        objectId: user.id,
        summary,
        before: {
          name: item.name,
          phone: item.phone,
          email: currentEmail,
        },
        after: {
          name: nextName,
          phone: resolvedPhone,
          email: resolvedEmail,
        },
      });

      return {
        name: nextName,
        phone: resolvedPhone,
        email: resolvedEmail,
        phoneChanged,
        emailChanged,
        nameChanged,
      };
    });

    const message = employee.emailChanged
      ? "Email profil diperbarui. Gunakan email baru untuk login berikutnya."
      : employee.phoneChanged
        ? "Profil dan nomor WhatsApp diperbarui."
        : employee.nameChanged
          ? "Nama profil diperbarui."
          : "Tidak ada perubahan profil.";

    return apiOk({
      name: employee.name,
      phone: employee.phone,
      email: employee.email,
      message,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return apiError("Email atau nomor HP ini sudah terdaftar pada akun lain.");
    }
    return apiError(
      error instanceof Error ? error.message : "Gagal memperbarui profil.",
    );
  }
}

function joinChanges(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} dan ${items.at(-1)}`;
}
