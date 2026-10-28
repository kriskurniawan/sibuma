import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { getObject } from "@/lib/storage";
import { query, select } from "@/lib/db";

export const maxDuration = 30;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir.", 401);

  const { key } = await params;
  const storageKey = key.join("/");

  // Seed objects can be shared by several documentation rows. Authorize any
  // matching accessible row, not merely whichever row the database returns first.
  const [doc] = await select("documentations", `storage_key=$1 AND EXISTS(SELECT 1 FROM spkls s WHERE s.id=documentations.spkl_id AND
    (($3::boolean AND s.created_by=$2) OR EXISTS(SELECT 1 FROM spkl_workers w WHERE w.spkl_id=s.id AND w.employee_id=$2)))`,
    [storageKey, user.id, user.role === "atasan"], undefined, "LIMIT 1");
  if (!doc) {
    const existing = await query("SELECT 1 FROM documentations WHERE storage_key=$1 LIMIT 1", [storageKey]);
    return apiError(existing.length ? "Kamu tidak memiliki akses ke dokumentasi ini." : "Dokumentasi tidak ditemukan.", existing.length ? 403 : 404);
  }

  try {
    const object = await getObject(
      storageKey,
      doc.storageProvider,
    );
    const extension = path.extname(storageKey).slice(1).toLowerCase();
    const contentType = CONTENT_TYPES[extension] ?? doc.mimeType;
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
        // Documentation can contain faces, locations, and work evidence.
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(`Gagal membaca dokumentasi ${storageKey}:`, error);
    return apiError("Berkas dokumentasi tidak tersedia.", 404);
  }
}
