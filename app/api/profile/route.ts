import { insertAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { profileUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const employee = await transaction(async (connection) => {
      const [item] = await query<{ name: string }>(
        "SELECT name FROM employees WHERE id=$1 FOR UPDATE",
        [user.id],
        connection,
      );
      if (!item) throw new Error("Akun tidak ditemukan.");

      const now = new Date().toISOString();
      await query(
        "UPDATE employees SET name=$2,updated_at=$3 WHERE id=$1",
        [user.id, parsed.data.name, now],
        connection,
      );
      await insertAudit(connection, {
        actorId: user.id,
        actorName: item.name,
        action: "profil_diubah",
        objectType: "karyawan",
        objectId: user.id,
        summary: `${item.name} memperbarui nama profil menjadi ${parsed.data.name}.`,
        before: { name: item.name },
        after: { name: parsed.data.name },
      });
      return { name: parsed.data.name };
    });

    return apiOk({ ...employee, message: "Nama profil diperbarui." });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal memperbarui profil.",
    );
  }
}
