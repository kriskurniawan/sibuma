import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import { checklistLocationUpdateSchema } from "@/lib/checklist-validation";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan") return apiError("Hanya atasan yang dapat mengubah lokasi.", 403);

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = checklistLocationUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const location = await transaction(async (connection) => {
      const [current] = await query(
        `SELECT * FROM checklist_locations WHERE id=$1 AND owner_id=$2 FOR UPDATE`,
        [id, user.id],
        connection,
      );
      if (!current) throw new Error("Lokasi tidak ditemukan.");
      if (parsed.data.parentId !== undefined && parsed.data.parentId !== null) {
        if (parsed.data.parentId === id) throw new Error("Lokasi tidak dapat menjadi induk dirinya sendiri.");
        const [parent] = await query(
          `SELECT id FROM checklist_locations WHERE id=$1 AND owner_id=$2`,
          [parsed.data.parentId, user.id],
          connection,
        );
        if (!parent) throw new Error("Lokasi induk tidak ditemukan.");
        const [cycle] = await query(
          `WITH RECURSIVE descendants AS (
             SELECT id FROM checklist_locations WHERE parent_id=$1 AND owner_id=$2
             UNION ALL
             SELECT l.id FROM checklist_locations l JOIN descendants d ON l.parent_id=d.id
           )
           SELECT id FROM descendants WHERE id=$3`,
          [id, user.id, parsed.data.parentId],
          connection,
        );
        if (cycle) throw new Error("Lokasi induk tidak boleh berada di bawah lokasi ini.");
      }
      const next = {
        name: parsed.data.name ?? (current.name as string),
        description: parsed.data.description ?? (current.description as string),
        publicDescription:
          parsed.data.publicDescription ?? (current.public_description as string),
        publicEnabled:
          parsed.data.publicEnabled ?? (current.public_enabled as boolean),
        parentId:
          parsed.data.parentId === undefined
            ? (current.parent_id as string | null)
            : parsed.data.parentId,
        active: parsed.data.active ?? (current.active as boolean),
      };
      await query(
        `UPDATE checklist_locations
         SET name=$3,description=$4,public_description=$5,public_enabled=$6,parent_id=$7,active=$8,updated_at=$9
         WHERE id=$1 AND owner_id=$2`,
        [id, user.id, next.name, next.description, next.publicDescription, next.publicEnabled, next.parentId, next.active, new Date().toISOString()],
        connection,
      );
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "checklist_lokasi_diubah",
        objectType: "checklist",
        objectId: id,
        summary: `${user.name} mengubah lokasi checklist ${next.name}.`,
        before: current,
        after: next,
      });
      return { ...next, id, ownerId: user.id };
    });
    return apiOk({ location, message: "Lokasi checklist diperbarui." });
  } catch (error) {
    return apiError(
      checklistErrorMessage(error, "Nama lokasi sudah dipakai pada induk yang sama."),
    );
  }
}
