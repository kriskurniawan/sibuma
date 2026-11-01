import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runAutomation } from "@/lib/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function matchesSecret(header: string | null, secret: string) {
  if (!header) return false;
  const [scheme, credentials] = header.split(" ");
  if (scheme !== "Bearer" || !credentials) return false;

  const provided = Buffer.from(credentials);
  const expected = Buffer.from(secret);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

/**
 * Dipanggil scheduler eksternal setiap menit (cron-job.org) dan, sebagai jaring
 * pengaman, cron harian Vercel. Endpoint ini tidak bergantung pada pengguna yang
 * sedang membuka aplikasi.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        message: "CRON_SECRET belum dikonfigurasi pada environment server.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!matchesSecret(request.headers.get("authorization"), secret)) {
    return NextResponse.json(
      { ok: false, message: "Tidak diizinkan." },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
          "WWW-Authenticate": "Bearer",
        },
      },
    );
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  try {
    const result = await runAutomation({ dryRun });
    // Kegagalan satu pekerjaan tetap dilaporkan ke scheduler lewat status HTTP
    // agar notifikasi kegagalan cron-job.org/Vercel tidak tertutup oleh 200.
    const failed = result.executed.filter((job) => job.status === "error").length;
    return NextResponse.json(
      { ok: failed === 0, ...result },
      {
        status: failed > 0 ? 500 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error(
      "Otomasi terjadwal gagal:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, message: "Otomasi gagal dijalankan." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
