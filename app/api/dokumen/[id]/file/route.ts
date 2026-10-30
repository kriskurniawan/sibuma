import { getCurrentUser } from "@/lib/auth";
import {
  documentStorageConfigMessage,
  isDocumentStorageConfigured,
} from "@/lib/document-storage-config";
import { getDocumentObjectStream, presignDocumentView } from "@/lib/document-storage";
import { loadViewableWorkDocument } from "@/lib/work-document-access";
import {
  isWorkDocumentVideo,
  WORK_DOCUMENT_PREVIEW_EXTENSIONS,
} from "@/lib/work-document-types";
import { apiError } from "@/lib/http";

export const maxDuration = 30;

function contentDisposition(kind: "inline" | "attachment", fileName: string) {
  const fallback = fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (!isDocumentStorageConfigured()) {
    return apiError(documentStorageConfigMessage(), 503);
  }

  const { id } = await params;
  // Hak akses diperiksa ulang setiap kali berkas diminta, bukan saat daftar dimuat.
  const document = await loadViewableWorkDocument(user, id);
  if (!document) {
    return apiError("Dokumen tidak ditemukan atau aksesnya sudah ditutup.", 404);
  }

  try {
    const download =
      new URL(request.url).searchParams.get("download") === "1";

    // Video dialihkan ke storage agar byte tidak melewati Vercel. Hak akses
    // sudah diperiksa di atas; URL hanya berlaku 15 menit dan diterbitkan
    // ulang setiap pemutaran.
    if (isWorkDocumentVideo(document.extension)) {
      const target = await presignDocumentView(
        document.storageKey,
        15 * 60,
        download
          ? contentDisposition("attachment", document.fileName)
          : undefined,
      );
      return new Response(null, {
        status: 302,
        headers: {
          Location: target,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const object = await getDocumentObjectStream(document.storageKey);
    const inline =
      !download && WORK_DOCUMENT_PREVIEW_EXTENSIONS.has(document.extension);

    return new Response(object.stream, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(object.contentLength ?? document.sizeBytes),
        "Content-Disposition": contentDisposition(
          inline ? "inline" : "attachment",
          document.fileName,
        ),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Gagal membaca objek dokumen kerja:", error);
    return apiError("Berkas gagal diambil. Silakan coba lagi.", 500);
  }
}
