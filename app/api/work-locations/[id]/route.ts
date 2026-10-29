import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { readOnlyWrite } from "@/lib/read-only";
import { workLocationUpdateSchema } from "@/lib/validation";
import { getWorkLocation } from "@/lib/work-locations";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (!can(user.role, "policy.manage")) {
    return apiError("Kamu tidak memiliki izin untuk mengatur titik absensi.", 403);
  }

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = workLocationUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const location = await transaction(async (connection) => {
      const rows = await query<{ id: string }>(
        `SELECT id FROM work_locations ORDER BY id FOR UPDATE`,
        [],
        connection,
      );
      if (!rows.some((row) => row.id === id)) {
        throw new Error("Titik absensi tidak ditemukan.");
      }

      const current = await getWorkLocation(id, connection);
      if (!current) throw new Error("Titik absensi tidak ditemukan.");

      const next = {
        name: parsed.data.name ?? current.name,
        address: parsed.data.address ?? current.address,
        latitude: parsed.data.latitude ?? current.latitude,
        longitude: parsed.data.longitude ?? current.longitude,
        radiusMeters: parsed.data.radiusMeters ?? current.radiusMeters,
        active: parsed.data.active ?? current.active,
      };

      if (current.active && !next.active) {
        const [active] = await query<{ total: number }>(
          `SELECT count(*)::integer total FROM work_locations WHERE active=true`,
          [],
          connection,
        );
        if (Number(active.total) <= 1) {
          throw new Error("Minimal satu titik absensi harus tetap aktif.");
        }
      }

      const now = new Date().toISOString();
      await query(
        `UPDATE work_locations
         SET name=$2,address=$3,latitude=$4,longitude=$5,radius_meters=$6,
             active=$7,updated_by=$8,updated_at=$9
         WHERE id=$1`,
        [
          id,
          next.name,
          next.address,
          next.latitude,
          next.longitude,
          next.radiusMeters,
          next.active,
          user.id,
          now,
        ],
        connection,
      );
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "lokasi_absen_diubah",
        objectType: "kebijakan",
        objectId: id,
        summary: `Titik absensi "${next.name}" diperbarui.`,
        before: current,
        after: next,
      });
      return getWorkLocation(id, connection);
    });
    return apiOk({ location, message: "Titik absensi diperbarui." });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return apiError("Nama titik lokasi sudah dipakai.");
    }
    return apiError(
      error instanceof Error ? error.message : "Gagal mengubah titik absensi.",
    );
  }
}
