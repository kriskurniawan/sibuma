import { can } from "@/lib/access";
import { setActiveOvertimePeriodStartDay } from "@/lib/active-overtime-period";
import { setActiveTimeZone } from "@/lib/active-time-zone";
import { getCurrentUser } from "@/lib/auth";
import { reconcileAllChecklistSchedules } from "@/lib/checklist-schedule-reconcile";
import { readOnlyWrite } from "@/lib/read-only";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import { mutateDb, pushAudit } from "@/lib/store";
import { policySchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
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

  const result = await mutateDb(
    { kind: "policy" },
    (db) => {
      const previousTimeZone = db.policy.timezone;
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
      return {
        policy: db.policy,
        timeZoneChanged: previousTimeZone !== db.policy.timezone,
      };
    },
    {
      // Snapshot deadline checklist memakai zona lama. Hitung ulang occurrence
      // yang belum disentuh agar tanggal lokalnya tetap sesuai zona baru.
      afterPersist: async (connection, saved) => {
        if (!saved.timeZoneChanged) return;
        await reconcileAllChecklistSchedules(connection, parsed.data.timezone);
      },
    },
  );
  setActiveTimeZone(result.policy.timezone);
  setActiveOvertimePeriodStartDay(result.policy.overtimePeriodStartDay);

  return apiOk({
    policy: result.policy,
    message: "Kebijakan berhasil disimpan.",
  });
}
