import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertChecklistAudit } from "@/lib/checklist-audit";
import { checklistErrorMessage } from "@/lib/checklist-errors";
import {
  checklistHasStarted,
  checklistNotStartedMessage,
} from "@/lib/checklist-schedule";
import { getChecklistPhoto } from "@/lib/checklist-queries";
import { query, transaction } from "@/lib/db";
import { apiError, apiOk } from "@/lib/http";
import { deleteObject, getObject, presignObjectView } from "@/lib/storage";
import { isVideoMime } from "@/lib/video";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const { id } = await params;
  const result = await getChecklistPhoto(user.id, user.role === "atasan", id);
  if (!result) return apiError("Foto tidak ditemukan atau bukan bagian dari aksesmu.", 404);

  try {
    // Video dialihkan ke URL bertanda tangan agar byte dan Range tidak
    // melewati fungsi Vercel. Hak akses sudah diperiksa di atas.
    if (
      result.photo.kind === "video" ||
      isVideoMime(result.photo.mimeType)
    ) {
      const target = await presignObjectView(result.photo.storageKey);
      return new Response(null, {
        status: 302,
        headers: {
          Location: target,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const object = await getObject(result.photo.storageKey, "s3");
    const extension = path.extname(result.photo.storageKey).slice(1).toLowerCase();
    const contentType = CONTENT_TYPES[extension] ?? result.photo.mimeType;
    const body = object.bytes.buffer.slice(
      object.bytes.byteOffset,
      object.bytes.byteOffset + object.bytes.byteLength,
    ) as ArrayBuffer;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(object.contentLength ?? object.bytes.byteLength),
        // Sensitive evidence must not remain in a shared browser profile after
        // logout or an account switch. `private` alone still allows that.
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(result.photo.fileName)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(`Gagal membaca foto checklist ${result.photo.storageKey}:`, error);
    return apiError("Berkas foto tidak tersedia.", 404);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  const denied = readOnlyWrite(user);
  if (denied) return denied;

  const { id } = await params;
  try {
    const { storageKey, isVideo } = await transaction(async (connection) => {
      // Lock the parent inspection before the photo so every evidence mutation
      // follows the same inspection -> child order as completion/reopen.
      const [photo] = await query(
        `SELECT p.*,i.owner_id inspection_owner_id,i.status inspection_status,
                i.occurrence_date inspection_occurrence_date,
                f.status follow_up_status,f.pic_id follow_up_pic_id
         FROM checklist_photos p
         JOIN checklist_inspections i ON i.id=p.inspection_id
         LEFT JOIN checklist_follow_ups f ON f.id=p.follow_up_id
         WHERE p.id=$1 FOR UPDATE OF i, p`,
        [id],
        connection,
      );
      if (!photo) throw new Error("Bukti dokumentasi tidak ditemukan.");

      // Answer evidence for a finalized inspection is immutable. Repair evidence
      // stays editable while its follow-up is still active, even after the
      // original inspection was completed.
      if (photo.follow_up_id) {
        if (["selesai", "dibatalkan"].includes(photo.follow_up_status as string)) {
          throw new Error(
            "Tindak lanjut ini sudah ditutup. Bukti perbaikan tidak dapat dihapus.",
          );
        }
      } else if (["selesai", "dilewati"].includes(photo.inspection_status as string)) {
        throw new Error(
          "Checklist sudah selesai. Minta atasan membuka kembali sebelum mengubah bukti.",
        );
      } else if (
        !checklistHasStarted(photo.inspection_occurrence_date as string)
      ) {
        throw new Error(
          checklistNotStartedMessage(
            photo.inspection_occurrence_date as string,
          ),
        );
      }
      let allowed =
        photo.uploaded_by === user.id ||
        (photo.follow_up_id && photo.follow_up_pic_id === user.id) ||
        (user.role === "atasan" && photo.inspection_owner_id === user.id);
      if (!allowed) {
        const [assigned] = await query(
          `SELECT 1 FROM checklist_inspection_assignees WHERE inspection_id=$1 AND employee_id=$2`,
          [photo.inspection_id, user.id],
          connection,
        );
        allowed = Boolean(assigned);
      }
      if (!allowed) throw new Error("Kamu tidak berhak menghapus bukti ini.");
      const isVideo =
        photo.kind === "video" || isVideoMime(photo.mime_type as string);
      await query(`DELETE FROM checklist_photos WHERE id=$1`, [id], connection);
      await insertChecklistAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: isVideo ? "checklist_video_dihapus" : "checklist_foto_dihapus",
        objectType: "checklist",
        objectId: photo.inspection_id as string,
        summary: isVideo
          ? `${user.name} menghapus video checklist ${photo.file_name as string}.`
          : `${user.name} menghapus foto checklist ${photo.file_name as string}.`,
        before: {
          photoId: id,
          kind: photo.kind ?? "photo",
          answerId: photo.answer_id,
          followUpId: photo.follow_up_id,
          storageKey: photo.storage_key,
        },
      });
      return { storageKey: photo.storage_key as string, isVideo };
    });
    await deleteObject(storageKey, "s3").catch((error) => {
      console.error(`Gagal menghapus objek bukti checklist ${storageKey}:`, error);
    });
    return apiOk({
      message: isVideo ? "Video checklist dihapus." : "Foto checklist dihapus.",
    });
  } catch (error) {
    return apiError(checklistErrorMessage(error));
  }
}
