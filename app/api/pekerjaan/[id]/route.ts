import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertAudit } from "@/lib/audit";
import {
  assertManualWorkAssignee,
  canManageManualWork,
  loadManualWork,
} from "@/lib/manual-work-access";
import { manualWorkErrorMessage } from "@/lib/manual-work-errors";
import { insertManualWorkEvent } from "@/lib/manual-work-events";
import { assertManualWorkFollowUp } from "@/lib/manual-work-links";
import { assertManualWorkLocation } from "@/lib/manual-work-locations";
import {
  manualWorkInputSchema,
  manualWorkSelfReportSchema,
} from "@/lib/manual-work-validation";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";

const EDITABLE_STATUSES = ["terbuka", "dikerjakan"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan" && user.role !== "pekerja") {
    return apiError(
      "Akun ini tidak dapat mengubah pekerjaan harian.",
      403,
    );
  }
  const isWorker = user.role === "pekerja";

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = (
    isWorker ? manualWorkSelfReportSchema : manualWorkInputSchema
  ).safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));
  const input = parsed.data;
  const managerInput = input as { followUpId?: string | null };
  const requestedAssigneeIds = input.assigneeIds;
  const requestedFollowUpId = isWorker
    ? null
    : (managerInput.followUpId ?? null);

  try {
    const result = await transaction(async (connection) => {
      // Lock the parent first; assignees and photos are always mutated after it.
      const current = await loadManualWork(connection, id, true);
      if (!current) throw new Error("Pekerjaan tidak ditemukan.");
      if (!canManageManualWork(user, current)) {
        throw new Error(
          isWorker
            ? "Hanya pelapor yang dapat mengubah laporan pekerjaan ini."
            : "Hanya pemilik pekerjaan yang dapat mengubahnya.",
        );
      }
      if (!EDITABLE_STATUSES.includes(current.status)) {
        throw new Error(
          "Pekerjaan yang sudah selesai atau dibatalkan tidak dapat diubah.",
        );
      }
      const location = await assertManualWorkLocation(
        connection,
        current.ownerId,
        input.locationId,
        current.locationId,
      );

      const previousAssignees = await query(
        `SELECT employee_id FROM manual_work_assignees WHERE work_id=$1`,
        [id],
        connection,
      );
      const previousIds = new Set(
        previousAssignees.map((row) => row.employee_id as string),
      );
      const nextAssigneeIds: string[] = [];
      for (const employeeId of requestedAssigneeIds) {
        // Pekerja yang sudah tercatat tetap boleh dipertahankan walau sudah
        // pindah tim atau nonaktif, agar edit rincian tidak memaksa mengubah
        // susunan tim.
        if (previousIds.has(employeeId)) {
          nextAssigneeIds.push(employeeId);
          continue;
        }
        const person = await assertManualWorkAssignee(
          connection,
          current.ownerId,
          employeeId,
        );
        if (!person) {
          throw new Error("Pekerja yang dipilih tidak aktif di timmu.");
        }
        nextAssigneeIds.push(person.id);
      }

      if (!isWorker && requestedFollowUpId) {
        await assertManualWorkFollowUp(
          connection,
          user.id,
          requestedFollowUpId,
          id,
        );
      }

      // Pelapor boleh memperbarui siapa saja yang ikut mengerjakan, tetapi
      // tautan tindak lanjut tetap diatur atasan.
      const sourceFollowUpId = isWorker
        ? current.sourceFollowUpId
        : requestedFollowUpId;

      const now = new Date().toISOString();
      await query(
        `UPDATE manual_works
         SET title=$2,description=$3,location_id=$4,location_name=$5,
             start_date=$6::date,target_date=$7::date,
             requires_documentation=$8,source_follow_up_id=$9,
             safety_name=$10,updated_at=$11
         WHERE id=$1`,
        [
          id,
          input.title,
          input.description,
          location.id,
          location.name,
          input.startDate,
          input.targetDate ?? null,
          input.requiresDocumentation,
          sourceFollowUpId,
          input.safetyName,
          now,
        ],
        connection,
      );
      await query(
        `DELETE FROM manual_work_assignees WHERE work_id=$1`,
        [id],
        connection,
      );
      for (const employeeId of nextAssigneeIds) {
        await query(
          `INSERT INTO manual_work_assignees (work_id,employee_id) VALUES ($1,$2)`,
          [id, employeeId],
          connection,
        );
      }

      await insertManualWorkEvent(connection, {
        workId: id,
        actorId: user.id,
        actorName: user.name,
        action: "diubah",
        status: current.status,
        note: isWorker
          ? "Catatan pekerjaan diperbarui."
          : "Rincian pekerjaan diperbarui.",
      });
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "pekerjaan_diubah",
        objectType: "pekerjaan",
        objectId: id,
        summary: `${user.name} mengubah pekerjaan harian "${input.title}".`,
        before: {
          title: current.title,
          description: current.description,
          safetyName: current.safetyName,
          locationId: current.locationId,
          locationName: current.locationName,
          startDate: current.startDate,
          targetDate: current.targetDate,
          requiresDocumentation: current.requiresDocumentation,
          sourceFollowUpId: current.sourceFollowUpId,
          assignees: previousAssignees.map(
            (row) => row.employee_id as string,
          ),
        },
        after: {
          title: input.title,
          description: input.description,
          safetyName: input.safetyName,
          locationId: location.id,
          locationName: location.name,
          startDate: input.startDate,
          targetDate: input.targetDate ?? null,
          requiresDocumentation: input.requiresDocumentation,
          sourceFollowUpId,
          assignees: nextAssigneeIds,
        },
      });
      return { id };
    });
    return apiOk({ ...result, message: "Pekerjaan diperbarui." });
  } catch (error) {
    return apiError(manualWorkErrorMessage(error));
  }
}
