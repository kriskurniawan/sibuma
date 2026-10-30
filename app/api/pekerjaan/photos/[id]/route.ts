import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readOnlyWrite } from "@/lib/read-only";
import { insertAudit } from "@/lib/audit";
import {
  canAccessManualWork,
  loadManualWork,
} from "@/lib/manual-work-access";
import { manualWorkErrorMessage } from "@/lib/manual-work-errors";
import { pool, query, transaction } from "@/lib/db";
import { apiError, apiOk } from "@/lib/http";
import { deleteObject, getObject, presignObjectView } from "@/lib/storage";
import type { ManualWorkStatus } from "@/lib/manual-work-types";
import { isVideoMime } from "@/lib/video";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const ACTIVE_STATUSES: ManualWorkStatus[] = ["terbuka", "dikerjakan"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);

  const { id } = await params;
  const [photo] = await query(
    `SELECT p.*,w.owner_id,w.created_by FROM manual_work_photos p
     JOIN manual_works w ON w.id=p.work_id
     WHERE p.id=$1`,
    [id],
  );
  if (!photo) return apiError("Foto tidak ditemukan.", 404);

  // Read-only supervisors still need to inspect evidence.
  const allowed = await canAccessManualWork(pool(), user, {
    id: photo.work_id as string,
    ownerId: photo.owner_id as string,
    createdBy: photo.created_by as string,
  });
  if (!allowed) {
    return apiError("Foto tidak ditemukan atau bukan bagian dari aksesmu.", 404);
  }

  try {
    // Video dialihkan ke URL bertanda tangan agar byte dan Range tidak
    // melewati fungsi Vercel. Hak akses sudah diperiksa di atas.
    if (
      photo.kind === "video" ||
      isVideoMime(photo.mime_type as string)
    ) {
      const target = await presignObjectView(photo.storage_key as string);
      return new Response(null, {
        status: 302,
        headers: {
          Location: target,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const object = await getObject(photo.storage_key as string, "s3");
    const extension = path
      .extname(photo.storage_key as string)
      .slice(1)
      .toLowerCase();
    const contentType =
      CONTENT_TYPES[extension] ?? (photo.mime_type as string);
    const body = object.bytes.buffer.slice(
      object.bytes.byteOffset,
      object.bytes.byteOffset + object.bytes.byteLength,
    ) as ArrayBuffer;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(
          object.contentLength ?? object.bytes.byteLength,
        ),
        // Evidence must not remain in a shared browser profile after logout.
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(photo.file_name as string)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(`Gagal membaca foto pekerjaan ${photo.storage_key as string}:`, error);
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
      const [existing] = await query(
        `SELECT * FROM manual_work_photos WHERE id=$1`,
        [id],
        connection,
      );
      if (!existing) throw new Error("Bukti dokumentasi tidak ditemukan.");

      // Parent-first lock: the work is frozen before its photo row changes.
      const work = await loadManualWork(
        connection,
        existing.work_id as string,
        true,
      );
      if (!work) throw new Error("Pekerjaan tidak ditemukan.");
      await query(
        `SELECT 1 FROM manual_work_photos WHERE id=$1 FOR UPDATE`,
        [id],
        connection,
      );

      if (!(await canAccessManualWork(connection, user, work))) {
        throw new Error("Kamu tidak ditugaskan pada pekerjaan ini.");
      }
      if (!ACTIVE_STATUSES.includes(work.status)) {
        throw new Error(
          "Pekerjaan sudah ditutup. Bukti dokumentasi tidak dapat dihapus.",
        );
      }

      const isVideo =
        existing.kind === "video" ||
        isVideoMime(existing.mime_type as string);
      await query(`DELETE FROM manual_work_photos WHERE id=$1`, [id], connection);
      await insertAudit(connection, {
        actorId: user.id,
        actorName: user.name,
        action: isVideo
          ? "pekerjaan_video_dihapus"
          : "pekerjaan_foto_dihapus",
        objectType: "pekerjaan",
        objectId: work.id,
        summary: isVideo
          ? `${user.name} menghapus video dokumentasi pekerjaan "${work.title}".`
          : `${user.name} menghapus foto dokumentasi pekerjaan "${work.title}".`,
        before: {
          photoId: id,
          kind: existing.kind ?? "photo",
          fileName: existing.file_name,
          storageKey: existing.storage_key,
          caption: existing.caption,
        },
      });
      return { storageKey: existing.storage_key as string, isVideo };
    });
    await deleteObject(storageKey, "s3").catch((error) => {
      console.error(`Gagal menghapus objek bukti pekerjaan ${storageKey}:`, error);
    });
    return apiOk({
      message: isVideo ? "Video dokumentasi dihapus." : "Foto dokumentasi dihapus.",
    });
  } catch (error) {
    return apiError(manualWorkErrorMessage(error));
  }
}
