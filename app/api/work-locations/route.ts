import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { readOnlyWrite } from "@/lib/read-only";
import { workLocationSchema } from "@/lib/validation";
import { getWorkLocation, listWorkLocations } from "@/lib/work-locations";

export const runtime = "nodejs";

function duplicateName(error: unknown) {
  return (error as { code?: string }).code === "23505";
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (!can(user.role, "policy.manage")) {
    return apiError("Kamu tidak memiliki izin untuk melihat titik absensi.", 403);
  }

  const locations = await listWorkLocations({ includeInactive: true });
  return apiOk({ locations });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (!can(user.role, "policy.manage")) {
    return apiError("Kamu tidak memiliki izin untuk mengatur titik absensi.", 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = workLocationSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const location = await transaction(async (connection) => {
      const id = `wl_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      if (!parsed.data.active) {
        const [active] = await query<{ total: number }>(
          `SELECT count(*)::integer total FROM work_locations WHERE active=true`,
          [],
          connection,
        );
        if (Number(active.total) === 0) {
          throw new Error("Titik absensi pertama harus aktif.");
        }
      }
      await query(
        `INSERT INTO work_locations
          (id,name,address,latitude,longitude,radius_meters,active,created_by,updated_by,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$9)`,
        [
          id,
          parsed.data.name,
          parsed.data.address,
          parsed.data.latitude,
          parsed.data.longitude,
          parsed.data.radiusMeters,
          parsed.data.active,
          user.id,
          now,
        ],
        connection,
      );
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "lokasi_absen_ditambah",
        objectType: "kebijakan",
        objectId: id,
        summary: `Titik absensi "${parsed.data.name}" ditambahkan.`,
        after: parsed.data,
      });
      return getWorkLocation(id, connection);
    });
    return apiOk({ location, message: "Titik absensi ditambahkan." }, 201);
  } catch (error) {
    if (duplicateName(error)) {
      return apiError("Nama titik lokasi sudah dipakai.");
    }
    return apiError(
      error instanceof Error ? error.message : "Gagal menambahkan titik absensi.",
    );
  }
}
