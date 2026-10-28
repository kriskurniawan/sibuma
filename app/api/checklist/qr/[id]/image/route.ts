import { headers } from "next/headers";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { qrTargetPath } from "@/lib/checklist-qr";
import { query } from "@/lib/db";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan") return apiError("QR tidak tersedia.", 403);

  const { id } = await params;
  const [row] = await query(
    `SELECT id,token,mode,location_id FROM checklist_qr_codes WHERE id=$1 AND owner_id=$2`,
    [id, user.id],
  );
  if (!row) return apiError("QR tidak ditemukan.", 404);

  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host =
    headerStore.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headerStore.get("host");
  const proto =
    forwardedProto || (host?.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
  const target = `${origin}${qrTargetPath({
    token: row.token as string,
    mode: row.mode as "pilih_area" | "langsung",
    locationId: (row.location_id as string | null) ?? null,
  })}`;

  const png = await QRCode.toBuffer(target, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 1024,
    color: { dark: "#111827ff", light: "#ffffffff" },
  });
  const download = new URL(request.url).searchParams.get("download") === "1";

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="qr-checklist-${id}.png"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
