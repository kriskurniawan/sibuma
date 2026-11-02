import { getCurrentUser } from "@/lib/auth";
import { insertAudit } from "@/lib/audit";
import {
  assertManualWorkAssignee,
  loadManualWork,
} from "@/lib/manual-work-access";
import { manualWorkErrorMessage } from "@/lib/manual-work-errors";
import { insertManualWorkEvent } from "@/lib/manual-work-events";
import {
  MANUAL_WORK_ACTIVE_STATUSES,
  MANUAL_WORK_MAX_ASSIGNEES,
  type ManualWorkStatus,
} from "@/lib/manual-work-types";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk } from "@/lib/http";
import { readOnlyWrite } from "@/lib/read-only";

const ACTIVE_STATUSES = new Set<ManualWorkStatus>(MANUAL_WORK_ACTIVE_STATUSES);

/**
 * Pekerja di tim yang sama boleh bergabung sendiri selama pekerjaan masih
 * berjalan. Join bersifat idempoten dan dicatat di riwayat pekerjaan.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;
  if (user.role !== "pekerja") {
    return apiError("Hanya pekerja yang dapat bergabung mengerjakan.", 403);
  }

  const { id } = await params;
  try {
    const result = await transaction(async (connection) => {
      const work = await loadManualWork(connection, id, true);
      if (!work) throw new Error("Pekerjaan tidak ditemukan.");
      if (!ACTIVE_STATUSES.has(work.status)) {
        throw new Error("Pekerjaan ini sudah selesai atau dibatalkan.");
      }

      const person = await assertManualWorkAssignee(
        connection,
        work.ownerId,
        user.id,
      );
      if (!person) {
        throw new Error("Pekerjaan ini bukan untuk timmu.");
      }

      const [existing] = await query(
        `SELECT 1 FROM manual_work_assignees
         WHERE work_id=$1 AND employee_id=$2`,
        [id, user.id],
        connection,
      );
      if (existing) {
        return { joined: false, title: work.title };
      }

      const [count] = await query<{ total: number }>(
        `SELECT count(*)::integer total FROM manual_work_assignees
         WHERE work_id=$1`,
        [id],
        connection,
      );
      if ((count?.total ?? 0) >= MANUAL_WORK_MAX_ASSIGNEES) {
        throw new Error(
          `Pekerjaan ini sudah memiliki ${MANUAL_WORK_MAX_ASSIGNEES} pekerja.`,
        );
      }

      await query(
        `INSERT INTO manual_work_assignees (work_id,employee_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [id, user.id],
        connection,
      );
      await insertManualWorkEvent(connection, {
        workId: id,
        actorId: user.id,
        actorName: user.name,
        action: "bergabung",
        status: work.status,
        note: "Bergabung mengerjakan.",
      });
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "pekerjaan_bergabung",
        objectType: "pekerjaan",
        objectId: id,
        summary: `${user.name} bergabung mengerjakan pekerjaan harian "${work.title}".`,
        after: { assigneeId: user.id },
      });

      return { joined: true, title: work.title };
    });

    return apiOk({
      joined: result.joined,
      message: result.joined
        ? "Kamu ikut mengerjakan pekerjaan ini."
        : "Kamu sudah tercatat mengerjakan pekerjaan ini.",
    });
  } catch (error) {
    return apiError(manualWorkErrorMessage(error));
  }
}
