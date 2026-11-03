import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getDailyReportPhoto,
  normalizeReportDate,
} from "@/lib/daily-report";
import type { DailyReportPhotoSource } from "@/lib/daily-report-types";
import { apiError } from "@/lib/http";
import { getObject } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function isPhotoSource(value: string): value is DailyReportPhotoSource {
  return value === "pekerjaan" || value === "checklist";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ source: string; id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);

  const { source, id } = await params;
  if (!isPhotoSource(source)) {
    return apiError("Jenis foto tidak dikenal.", 404);
  }

  const url = new URL(request.url);
  const date = normalizeReportDate(url.searchParams.get("tanggal"));
  const photo = await getDailyReportPhoto(user, source, id, date);
  if (!photo) {
    return apiError(
      "Foto tidak ditemukan atau bukan bagian dari laporan pada tanggal ini.",
      404,
    );
  }

  try {
    const object = await getObject(photo.storage_key, "s3");
    const extension = path
      .extname(photo.storage_key)
      .slice(1)
      .toLowerCase();
    const contentType = CONTENT_TYPES[extension] ?? photo.mime_type;
    const body = object.bytes.buffer.slice(
      object.bytes.byteOffset,
      object.bytes.byteOffset + object.bytes.byteLength,
    ) as ArrayBuffer;
    const disposition =
      url.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(
          object.contentLength ?? object.bytes.byteLength,
        ),
        // Bukti pekerjaan tidak boleh tertinggal di profil browser bersama.
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(photo.file_name)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      `Gagal membaca foto laporan harian ${photo.storage_key}:`,
      error,
    );
    return apiError("Berkas foto tidak tersedia.", 404);
  }
}
