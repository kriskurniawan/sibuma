import { getCurrentUser } from "@/lib/auth";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { mutateDb, pushAudit } from "@/lib/store";
import type { Division } from "@/lib/types";
import { divisionInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat menambahkan divisi.", 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = divisionInputSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const division = await mutateDb({ kind: "division", supervisorId: user.id }, (db) => {
      const duplicate = db.divisions.some(
        (item) =>
          item.supervisorId === user.id &&
          item.name.toLowerCase() === parsed.data.name.toLowerCase(),
      );
      if (duplicate) {
        throw new Error("Nama divisi ini sudah dipakai.");
      }

      const now = new Date().toISOString();
      const created: Division = {
        id: `div_${crypto.randomUUID()}`,
        name: parsed.data.name,
        description: parsed.data.description,
        supervisorId: user.id,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      db.divisions.push(created);
      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "divisi_dibuat",
        objectType: "divisi",
        objectId: created.id,
        summary: `Divisi ${created.name} ditambahkan.`,
        after: {
          name: created.name,
          description: created.description,
          active: created.active,
        },
      });
      return created;
    });

    return apiOk({
      division,
      message: `Divisi ${division.name} berhasil ditambahkan.`,
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menambahkan divisi.",
    );
  }
}
