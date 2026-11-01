import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { getNoteMedia } from "@/lib/note-queries";
import { getObject, storageErrorStatus } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);

  const { id } = await params;
  const requestedPhoto = new URL(request.url).searchParams.get("photo")?.trim();
  if (
    requestedPhoto &&
    (requestedPhoto.length > 160 ||
      /[\u0000-\u001F\u007F]/.test(requestedPhoto))
  ) {
    return apiError("Media catatan tidak ditemukan.", 404);
  }
  const attachmentId = requestedPhoto || null;

  let media: Awaited<ReturnType<typeof getNoteMedia>>;
  try {
    media = await getNoteMedia(user, id, attachmentId);
  } catch (error) {
    console.error(`Gagal membaca data media catatan ${id}:`, error);
    return apiError("Media catatan gagal dimuat. Coba lagi.", 500);
  }
  if (!media) {
    return apiError(
      "Media catatan tidak ditemukan atau bukan bagian dari aksesmu.",
      404,
    );
  }

  try {
    const object = await getObject(media.storage_key, "s3");
    const body = object.bytes.buffer.slice(
      object.bytes.byteOffset,
      object.bytes.byteOffset + object.bytes.byteLength,
    ) as ArrayBuffer;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": media.mime_type,
        "Content-Length": String(
          object.contentLength ?? object.bytes.byteLength,
        ),
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(media.file_name)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(`Gagal membaca media catatan ${media.storage_key}:`, error);
    if (storageErrorStatus(error) === 404) {
      return apiError("Berkas media catatan tidak ditemukan.", 404);
    }
    return apiError("Berkas media catatan gagal dimuat. Coba lagi.", 502);
  }
}
