import { getCurrentUser } from "@/lib/auth";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { mutateDb, pushAudit } from "@/lib/store";
import { divisionUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat memperbarui divisi.", 403);
  }

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = divisionUpdateSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  try {
    const division = await mutateDb({ kind: "division", supervisorId: user.id }, (db) => {
      const item = db.divisions.find((entry) => entry.id === id);
      if (!item) throw new Error("Divisi tidak ditemukan.");
      if (item.supervisorId !== user.id) {
        throw new Error("Divisi ini bukan bagian dari timmu.");
      }

      if (
        parsed.data.name &&
        db.divisions.some(
          (entry) =>
            entry.id !== item.id &&
            entry.supervisorId === user.id &&
            entry.name.toLowerCase() === parsed.data.name!.toLowerCase(),
        )
      ) {
        throw new Error("Nama divisi ini sudah dipakai.");
      }

      if (parsed.data.active === false && item.active) {
        const hasWorkers = db.employees.some(
          (employee) => employee.divisionId === item.id,
        );
        if (hasWorkers) {
          throw new Error(
            "Divisi masih memiliki pekerja. Pindahkan pekerja ke divisi lain terlebih dahulu.",
          );
        }
        const otherActive = db.divisions.some(
          (entry) =>
            entry.id !== item.id &&
            entry.supervisorId === user.id &&
            entry.active,
        );
        if (!otherActive) {
          throw new Error("Minimal satu divisi aktif harus tersedia.");
        }
      }

      const before = {
        name: item.name,
        description: item.description,
        active: item.active,
      };
      if (parsed.data.name) item.name = parsed.data.name;
      if (typeof parsed.data.description === "string") {
        item.description = parsed.data.description;
      }
      if (typeof parsed.data.active === "boolean") {
        item.active = parsed.data.active;
      }
      item.updatedAt = new Date().toISOString();

      pushAudit(db, {
        actorId: user.id,
        actorName: user.name,
        action: "divisi_diubah",
        objectType: "divisi",
        objectId: item.id,
        summary: `Divisi ${item.name} diperbarui.`,
        before,
        after: {
          name: item.name,
          description: item.description,
          active: item.active,
        },
      });

      return item;
    });

    return apiOk({
      division,
      message: `Divisi ${division.name} berhasil disimpan.`,
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal memperbarui divisi.",
    );
  }
}
