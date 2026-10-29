import path from "node:path";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import {
  canAccessInspection,
  canManageFollowUp,
  loadInspection,
} from "@/lib/checklist-access";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import {
  checklistHasStarted,
  checklistNotStartedMessage,
} from "@/lib/checklist-schedule";
import { UPLOAD_MAX_BYTES } from "@/lib/constants";
import type { ChecklistFollowUp } from "@/lib/checklist-types";
import { pool, query, transaction } from "@/lib/db";
import { rowToCamel } from "@/lib/db-model";
import { apiError, apiOk } from "@/lib/http";
import { deleteObject, putObject } from "@/lib/storage";

export const maxDuration = 30;

const ACCEPTED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function matchesMagicBytes(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const { id } = await params;
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Data unggahan tidak valid.");
  }

  const file = formData.get("file");
  const answerIdRaw = formData.get("answerId");
  const followUpIdRaw = formData.get("followUpId");
  const captionRaw = formData.get("caption");
  const stageRaw = formData.get("stage");
  const answerId = typeof answerIdRaw === "string" && answerIdRaw ? answerIdRaw : null;
  const followUpId = typeof followUpIdRaw === "string" && followUpIdRaw ? followUpIdRaw : null;
  const caption = typeof captionRaw === "string" ? captionRaw.trim() : "";
  const stage = stageRaw === "perbaikan" ? "perbaikan" : "temuan";

  if (!(file instanceof File)) return apiError("Pilih foto yang akan diunggah.");
  if (Boolean(answerId) === Boolean(followUpId)) {
    return apiError("Foto harus terhubung ke tepat satu item atau tindak lanjut.");
  }
  if (caption.length > 300) return apiError("Keterangan foto maksimal 300 karakter.");
  if (file.size <= 0) return apiError("File foto kosong.");
  if (file.size > UPLOAD_MAX_BYTES) {
    return apiError(
      `Ukuran foto melebihi batas ${(UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(1)} MB setelah kompresi.`,
    );
  }
  const extension = ACCEPTED_TYPES[file.type];
  if (!extension) return apiError("Format foto harus JPG, PNG, atau WEBP.");

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!matchesMagicBytes(buffer, file.type)) {
    return apiError("Isi file tidak sesuai dengan format gambarnya.");
  }

  const safeFileName = path.basename(file.name || `checklist.${extension}`);
  const storageKey = `checklist/${id}/${crypto.randomUUID()}.${extension}`;
  const effectiveStage = followUpId ? "perbaikan" : stage;
  let stored = false;

  try {
    // Authorize before buffering/uploading, and keep the external storage call
    // outside the database transaction so retries cannot repeat the upload.
    const inspection = await loadInspection(pool(), id);
    if (!inspection) return apiError("Checklist tidak ditemukan.", 404);

    if (followUpId) {
      const [followUpRow] = await query(
        `SELECT * FROM checklist_follow_ups WHERE id=$1 AND inspection_id=$2`,
        [followUpId, id],
      );
      if (!followUpRow) return apiError("Tindak lanjut tidak ditemukan.", 404);
      const followUp = rowToCamel(followUpRow) as unknown as ChecklistFollowUp;
      if (["selesai", "dibatalkan"].includes(followUp.status as string)) {
        return apiError(
          "Tindak lanjut ini sudah ditutup. Bukti perbaikan tidak dapat ditambahkan.",
        );
      }
      const allowed = await canManageFollowUp(pool(), user, followUp);
      if (!allowed) {
        return apiError("Kamu tidak berhak menambah bukti pada tindak lanjut ini.", 403);
      }
    } else {
      const allowed = await canAccessInspection(pool(), user, inspection);
      if (!allowed) return apiError("Kamu tidak ditugaskan pada checklist ini.", 403);
      if (!checklistHasStarted(inspection.occurrenceDate)) {
        return apiError(checklistNotStartedMessage(inspection.occurrenceDate));
      }
      if (["selesai", "dilewati"].includes(inspection.status)) {
        return apiError(
          "Checklist sudah selesai. Minta atasan membuka kembali sebelum menambah foto.",
        );
      }
    }

    await putObject(storageKey, buffer, file.type);
    stored = true;

    const photo = await transaction(async (connection) => {
      // Lock the inspection first, then revalidate the state that was checked
      // before the upload. Completion/reopen uses the same parent-first order.
      const [current] = await query(
        `SELECT * FROM checklist_inspections WHERE id=$1 FOR UPDATE`,
        [id],
        connection,
      );
      if (!current) throw new Error("Checklist tidak ditemukan.");

      if (followUpId) {
        const [followUpRow] = await query(
          `SELECT * FROM checklist_follow_ups WHERE id=$1 AND inspection_id=$2 FOR UPDATE`,
          [followUpId, id],
          connection,
        );
        if (!followUpRow) throw new Error("Tindak lanjut tidak ditemukan.");
        const followUp = rowToCamel(followUpRow) as unknown as ChecklistFollowUp;
        if (["selesai", "dibatalkan"].includes(followUp.status as string)) {
          throw new Error(
            "Tindak lanjut ini sudah ditutup. Bukti perbaikan tidak dapat ditambahkan.",
          );
        }
        const allowed = await canManageFollowUp(connection, user, followUp);
        if (!allowed) {
          throw new Error("Kamu tidak berhak menambah bukti pada tindak lanjut ini.");
        }
      } else {
        const allowed = await canAccessInspection(connection, user, {
          id,
          ownerId: current.owner_id as string,
        });
        if (!allowed) throw new Error("Kamu tidak ditugaskan pada checklist ini.");
        if (!checklistHasStarted(current.occurrence_date as string)) {
          throw new Error(
            checklistNotStartedMessage(current.occurrence_date as string),
          );
        }
        if (["selesai", "dilewati"].includes(current.status as string)) {
          throw new Error(
            "Checklist sudah selesai. Minta atasan membuka kembali sebelum menambah foto.",
          );
        }
        const [answer] = await query(
          `SELECT id FROM checklist_answers WHERE id=$1 AND inspection_id=$2`,
          [answerId, id],
          connection,
        );
        if (!answer) throw new Error("Item checklist tidak ditemukan.");
      }

      const [count] = await query(
        `SELECT count(*)::integer total FROM checklist_photos
         WHERE inspection_id=$1 AND (($2::text IS NOT NULL AND answer_id=$2) OR ($3::text IS NOT NULL AND follow_up_id=$3))`,
        [id, answerId, followUpId],
        connection,
      );
      if (count.total >= 6) throw new Error("Maksimal 6 foto per item atau tindak lanjut.");

      const now = new Date().toISOString();
      const photoId = `cp_${crypto.randomUUID()}`;
      await query(
        `INSERT INTO checklist_photos
          (id,inspection_id,answer_id,follow_up_id,uploaded_by,storage_provider,storage_key,file_name,
           mime_type,size_bytes,caption,stage,created_at)
         VALUES ($1,$2,$3,$4,$5,'s3',$6,$7,$8,$9,$10,$11,$12)`,
        [
          photoId,
          id,
          answerId,
          followUpId,
          user.id,
          storageKey,
          safeFileName,
          file.type,
          buffer.length,
          caption,
          effectiveStage,
          now,
        ],
        connection,
      );
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: "checklist_foto_diunggah",
        objectType: "checklist",
        objectId: id,
        summary: followUpId
          ? `${user.name} menambahkan foto perbaikan tindak lanjut.`
          : `${user.name} menambahkan foto checklist.`,
        after: {
          photoId,
          answerId,
          followUpId,
          stage: effectiveStage,
          sizeBytes: buffer.length,
        },
      });
      return {
        id: photoId,
        inspectionId: id,
        answerId,
        followUpId,
        uploadedBy: user.id,
        storageProvider: "s3",
        storageKey,
        fileName: safeFileName,
        mimeType: file.type,
        sizeBytes: buffer.length,
        caption,
        stage: effectiveStage,
        createdAt: now,
      };
    });
    return apiOk({ photo, message: "Foto checklist diunggah." }, 201);
  } catch (error) {
    if (stored) await deleteObject(storageKey, "s3").catch(() => undefined);
    return apiError(checklistErrorMessage(error));
  }
}
