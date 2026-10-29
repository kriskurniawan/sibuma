import { can } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { mutateDb, pushAudit } from "@/lib/store";
import { policySchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (!can(user.role, "policy.manage")) {
    return apiError("Kamu tidak memiliki izin untuk mengubah kebijakan.", 403);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = policySchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));

  const policy = await mutateDb({ kind: "policy" }, (db) => {
    const before = { ...db.policy };
    Object.assign(db.policy, parsed.data, {
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    });
    pushAudit(db, {
      actorId: user.id,
      actorName: user.name,
      action: "kebijakan_diubah",
      objectType: "kebijakan",
      objectId: "policy",
      summary: "Kebijakan absensi dan lembur diperbarui.",
      before,
      after: { ...db.policy },
    });
    return db.policy;
  });

  return apiOk({
    policy,
    message: "Kebijakan berhasil disimpan.",
  });
}
