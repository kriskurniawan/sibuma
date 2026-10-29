import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertAudit } from "@/lib/audit";
import {
  assertManualWorkAssignee,
  assertManualWorkSupervisor,
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

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "atasan" && user.role !== "pekerja") {
    return apiError(
      "Akun ini tidak dapat membuat pekerjaan harian.",
      403,
    );
  }
  const isWorker = user.role === "pekerja";

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
    const id = await transaction(async (connection) => {
      let ownerId = user.id;
      const assignees: Array<{ id: string; name: string }> = [];

      if (isWorker) {
        // Pekerja mencatat untuk dirinya dan rekan tim yang ikut bekerja;
        // atasan penanggung jawab tetap menjadi pemilik catatan.
        const supervisor = await assertManualWorkSupervisor(
          connection,
          user.id,
        );
        if (!supervisor) {
          throw new Error(
            "Penanggung jawab belum aktif atau belum ditetapkan. Hubungi admin sebelum mencatat pekerjaan.",
          );
        }
        ownerId = supervisor.id;
        for (const employeeId of requestedAssigneeIds) {
          const person = await assertManualWorkAssignee(
            connection,
            supervisor.id,
            employeeId,
          );
          if (!person) {
            throw new Error("Pekerja yang dipilih tidak aktif di timmu.");
          }
          assignees.push(person);
        }
      } else {
        for (const employeeId of requestedAssigneeIds) {
          const person = await assertManualWorkAssignee(
            connection,
            user.id,
            employeeId,
          );
          if (!person) {
            throw new Error("Pekerja yang dipilih tidak aktif di timmu.");
          }
          assignees.push(person);
        }
        if (requestedFollowUpId) {
          await assertManualWorkFollowUp(
            connection,
            user.id,
            requestedFollowUpId,
          );
        }
      }

      const location = await assertManualWorkLocation(
        connection,
        ownerId,
        input.locationId,
      );

      const now = new Date().toISOString();
      const workId = `mw_${crypto.randomUUID()}`;
      await query(
        `INSERT INTO manual_works
          (id,owner_id,title,description,safety_name,location_id,location_name,
           start_date,target_date,requires_documentation,status,
           source_follow_up_id,result_note,created_by,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'terbuka',$11,'',$12,$13,$13)`,
        [
          workId,
          ownerId,
          input.title,
          input.description,
          input.safetyName,
          location.id,
          location.name,
          input.startDate,
          input.targetDate ?? null,
          input.requiresDocumentation,
          requestedFollowUpId,
          user.id,
          now,
        ],
        connection,
      );
      for (const person of assignees) {
        await query(
          `INSERT INTO manual_work_assignees (work_id,employee_id) VALUES ($1,$2)`,
          [workId, person.id],
          connection,
        );
      }
      await insertManualWorkEvent(connection, {
        workId,
        actorId: user.id,
        actorName: user.name,
        action: isWorker ? "dilaporkan" : "dibuat",
        status: "terbuka",
        note: isWorker
          ? "Pekerjaan dicatat dan langsung aktif."
          : `Ditugaskan kepada ${assignees.map((person) => person.name).join(", ")}.`,
      });
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "pekerjaan_dibuat",
        objectType: "pekerjaan",
        objectId: workId,
        summary: isWorker
          ? `${user.name} mencatat pekerjaan harian "${input.title}".`
          : `${user.name} membuat pekerjaan harian "${input.title}".`,
        after: {
          title: input.title,
          description: input.description,
          safetyName: input.safetyName,
          locationId: location.id,
          locationName: location.name,
          startDate: input.startDate,
          targetDate: input.targetDate ?? null,
          assignees: assignees.map((person) => person.id),
          requiresDocumentation: input.requiresDocumentation,
          sourceFollowUpId: requestedFollowUpId,
          selfReported: isWorker,
        },
      });
      return workId;
    });
    return apiOk(
      {
        id,
        message: isWorker
          ? "Pekerjaan dicatat dan langsung aktif."
          : "Pekerjaan dibuat.",
      },
      201,
    );
  } catch (error) {
    return apiError(manualWorkErrorMessage(error));
  }
}
