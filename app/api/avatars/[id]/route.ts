import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { apiError } from "@/lib/http";
import { getObject } from "@/lib/storage";

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

  const { id } = await params;
  const [employee] = await query<{ avatar_key: string | null }>(
    "SELECT avatar_key FROM employees WHERE id=$1",
    [id],
  );
  if (!employee?.avatar_key) {
    return apiError("Foto profil tidak ditemukan.", 404);
  }

  try {
    const object = await getObject(employee.avatar_key, "s3");
    const extension = path
      .extname(employee.avatar_key)
      .slice(1)
      .toLowerCase();
    const contentType = CONTENT_TYPES[extension] ?? "image/jpeg";
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
        // Foto profil bisa terlihat di perangkat bersama. Jangan simpan di
        // cache HTTP setelah logout atau pergantian akun.
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(`avatar.${extension || "jpg"}`)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(`Gagal membaca avatar ${employee.avatar_key}:`, error);
    return apiError("Berkas foto tidak tersedia.", 404);
  }
}
