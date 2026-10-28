import { getCurrentUser } from "@/lib/auth";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { checklistLocationSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat menambah lokasi checklist.", 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistLocationSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const location = await transaction(async (connection) => {
      if (parsed.data.parentId) {
        const [parent] = await query(
          `SELECT id FROM checklist_locations WHERE id=$1 AND owner_id=$2`,
          [parsed.data.parentId, user.id],
          connection,
        );
        if (!parent) throw new Error("Lokasi induk tidak ditemukan.");
      }
      const now = new Date().toISOString();
      const id = `cl_${crypto.randomUUID()}`;
      await query(
        `INSERT INTO checklist_locations
          (id,owner_id,name,description,public_description,public_enabled,parent_id,active,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          id,
          user.id,
          parsed.data.name,
          parsed.data.description,
          parsed.data.publicDescription,
          parsed.data.publicEnabled ?? false,
          parsed.data.parentId ?? null,
          parsed.data.active ?? true,
          now,
          now,
        ],
        connection,
      );
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "checklist_lokasi_dibuat",
        objectType: "checklist",
        objectId: id,
        summary: `${user.name} menambahkan lokasi checklist ${parsed.data.name}.`,
        after: parsed.data,
      });
      return {
        id,
        ownerId: user.id,
        name: parsed.data.name,
        description: parsed.data.description,
        publicDescription: parsed.data.publicDescription,
        publicEnabled: parsed.data.publicEnabled ?? false,
        parentId: parsed.data.parentId ?? null,
        active: parsed.data.active ?? true,
        createdAt: now,
        updatedAt: now,
      };
    });
    return apiOk({ location, message: "Lokasi checklist ditambahkan." }, 201);
  } catch (error) {
    return apiError(
      checklistErrorMessage(error, "Nama lokasi sudah dipakai pada induk yang sama."),
    );
  }
}
