import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertAudit } from "@/lib/audit";
import {
  canAccessManualWork,
  canManageManualWork,
  loadManualWork,
} from "@/lib/manual-work-access";
import { manualWorkErrorMessage } from "@/lib/manual-work-errors";
import { insertManualWorkEvent } from "@/lib/manual-work-events";
import { manualWorkActionSchema } from "@/lib/manual-work-validation";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk, validationMessage } from "@/lib/http";
import type { ManualWorkStatus } from "@/lib/manual-work-types";

const ACTIVE_STATUSES: ManualWorkStatus[] = ["terbuka", "dikerjakan"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("Permintaan tidak valid.");
  }
  const parsed = manualWorkActionSchema.safeParse(raw);
  if (!parsed.success) return apiError(validationMessage(parsed.error));
  const input = parsed.data;

  try {
    const result = await transaction(async (connection) => {
      // All lifecycle changes lock the work row before reading photos/events.
      const work = await loadManualWork(connection, id, true);
      if (!work) throw new Error("Pekerjaan tidak ditemukan.");

      const owner = user.role === "atasan" && work.ownerId === user.id;
      const manager = canManageManualWork(user, work);
      const operator = await canAccessManualWork(connection, user, work);
      const now = new Date().toISOString();

      if (input.action === "mulai") {
        if (!operator) {
          throw new Error(
            "Hanya pemilik pekerjaan, pelapor, atau pekerja yang ditugaskan yang dapat memulai.",
          );
        }
        if (work.status !== "terbuka") {
          throw new Error("Pekerjaan ini sudah dimulai atau sudah ditutup.");
        }
        await query(
          `UPDATE manual_works
           SET status='dikerjakan',started_at=coalesce(started_at,$2),updated_at=$2
           WHERE id=$1`,
          [id, now],
          connection,
        );
        await insertManualWorkEvent(connection, {
          workId: id,
          actorId: user.id,
          actorName: user.name,
          action: "dimulai",
          status: "dikerjakan",
          note: "Pekerjaan mulai dikerjakan.",
        });
        await insertAudit(connection, {
          actorId: user.id,
          actorName: user.name,
          action: "pekerjaan_dimulai",
          objectType: "pekerjaan",
          objectId: id,
          summary: `${user.name} memulai pekerjaan harian "${work.title}".`,
          before: { status: work.status },
          after: { status: "dikerjakan" },
        });
        return { status: "dikerjakan" as ManualWorkStatus };
      }

      if (input.action === "selesai") {
        if (!operator) {
          throw new Error(
            "Hanya pemilik pekerjaan, pelapor, atau pekerja yang ditugaskan yang dapat menyelesaikan.",
          );
        }
        if (work.status !== "dikerjakan") {
          throw new Error(
            "Pekerjaan harus dimulai terlebih dahulu sebelum diselesaikan.",
          );
        }
        if (work.requiresDocumentation) {
          const [photos] = await query<{ total: number }>(
            `SELECT count(*)::integer total FROM manual_work_photos
             WHERE work_id=$1 AND kind='photo'`,
            [id],
            connection,
          );
          if ((photos?.total ?? 0) < 1) {
            throw new Error(
              "Unggah minimal satu foto dokumentasi sebelum menyelesaikan pekerjaan.",
            );
          }
        }

        await query(
          `UPDATE manual_works
           SET status='selesai',result_note=$2,completed_at=$3,completed_by=$4,
               updated_at=$3
           WHERE id=$1`,
          [id, input.resultNote, now, user.id],
          connection,
        );
        await insertManualWorkEvent(connection, {
          workId: id,
          actorId: user.id,
          actorName: user.name,
          action: "diselesaikan",
          status: "selesai",
          note: input.resultNote || "Pekerjaan dinyatakan selesai.",
        });
        await insertAudit(connection, {
          actorId: user.id,
          actorName: user.name,
          action: "pekerjaan_diselesaikan",
          objectType: "pekerjaan",
          objectId: id,
          summary: `${user.name} menyelesaikan pekerjaan harian "${work.title}".`,
          before: { status: work.status },
          after: {
            status: "selesai",
            resultNote: input.resultNote,
          },
        });
        return { status: "selesai" as ManualWorkStatus };
      }

      if (input.action === "batal") {
        if (!manager) {
          throw new Error(
            "Hanya pemilik pekerjaan atau pelapor yang dapat membatalkan pekerjaan.",
          );
        }
        if (!ACTIVE_STATUSES.includes(work.status)) {
          throw new Error("Pekerjaan ini sudah ditutup.");
        }
        await query(
          `UPDATE manual_works
           SET status='dibatalkan',cancel_reason=$2,updated_at=$3
           WHERE id=$1`,
          [id, input.reason, now],
          connection,
        );
        await insertManualWorkEvent(connection, {
          workId: id,
          actorId: user.id,
          actorName: user.name,
          action: "dibatalkan",
          status: "dibatalkan",
          note: input.reason,
        });
        await insertAudit(connection, {
          actorId: user.id,
          actorName: user.name,
          action: "pekerjaan_dibatalkan",
          objectType: "pekerjaan",
          objectId: id,
          summary: `${user.name} membatalkan pekerjaan harian "${work.title}".`,
          before: { status: work.status },
          after: { status: "dibatalkan", reason: input.reason },
        });
        return { status: "dibatalkan" as ManualWorkStatus };
      }

      // buka_kembali
      if (!owner) {
        throw new Error("Hanya pemilik pekerjaan yang dapat membuka kembali pekerjaan.");
      }
      if (work.status !== "selesai") {
        throw new Error("Hanya pekerjaan yang sudah selesai yang dapat dibuka kembali.");
      }
      const nextStatus: ManualWorkStatus = work.startedAt
        ? "dikerjakan"
        : "terbuka";
      await query(
        `UPDATE manual_works
         SET status=$2,result_note='',completed_at=NULL,completed_by=NULL,
             reopened_at=$3,reopened_by=$4,reopen_reason=$5,updated_at=$3
         WHERE id=$1`,
        [id, nextStatus, now, user.id, input.reason],
        connection,
      );
      await insertManualWorkEvent(connection, {
        workId: id,
        actorId: user.id,
        actorName: user.name,
        action: "dibuka_kembali",
        status: nextStatus,
        note: input.reason,
      });
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "pekerjaan_dibuka_kembali",
        objectType: "pekerjaan",
        objectId: id,
        summary: `${user.name} membuka kembali pekerjaan harian "${work.title}".`,
        before: {
          status: work.status,
          resultNote: work.resultNote,
          completedAt: work.completedAt,
        },
        after: { status: nextStatus, reason: input.reason },
      });
      return { status: nextStatus };
    });
    return apiOk({ ...result, message: "Status pekerjaan diperbarui." });
  } catch (error) {
    return apiError(manualWorkErrorMessage(error));
  }
}
