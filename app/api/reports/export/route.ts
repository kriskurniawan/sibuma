import { getCurrentUser } from "@/lib/auth";
import { ATTENDANCE_STATUS_LABEL } from "@/lib/constants";
import { apiError } from "@/lib/http";
import { getReportData } from "@/lib/queries";
import {
  currentMonthRange,
  durationLabel,
  formatDateHuman,
  formatTime,
} from "@/lib/time";

export const runtime = "nodejs";

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[";\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat mengunduh rekap.", 403);
  }

  const url = new URL(request.url);
  const range = currentMonthRange();
  const from = url.searchParams.get("from") || range.from;
  const to = url.searchParams.get("to") || range.to;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to)
  ) {
    return apiError("Rentang tanggal tidak valid.");
  }

  const data = await getReportData(user.id, {
    from,
    to,
    employeeId: url.searchParams.get("employeeId") || undefined,
    spklId: url.searchParams.get("spklId") || undefined,
    search: url.searchParams.get("search")?.trim() || undefined,
  });

  const header = [
    "Tanggal",
    "Nomor SPKL",
    "Pekerjaan",
    "Nama pekerja",
    "NIK",
    "Status absensi",
    "Jam masuk",
    "Jam pulang",
    "Durasi",
    "Dokumentasi",
    "Catatan koreksi",
  ];

  const lines = [
    header.map(csvCell).join(";"),
    ...data.rows.map((row) =>
      [
        row.spkl.date,
        row.spkl.number,
        row.spkl.title,
        row.employee.name,
        row.employee.nik,
        ATTENDANCE_STATUS_LABEL[row.attendance.status],
        row.attendance.checkInAt
          ? formatTime(row.attendance.checkInAt)
          : "",
        row.attendance.checkOutAt
          ? formatTime(row.attendance.checkOutAt)
          : "",
        row.attendance.status === "tidak_hadir"
          ? "0"
          : durationLabel(row.attendance.durationMinutes),
        row.documentationCount,
        row.attendance.correctionReason ?? "",
      ]
        .map(csvCell)
        .join(";"),
    ),
  ];

  const summaryLines = [
    "",
    "RINGKASAN PER PEKERJA",
    ["Nama", "Sesi", "Hadir", "Tidak hadir", "Total durasi", "Dokumentasi"]
      .map(csvCell)
      .join(";"),
    ...data.summaries.map((summary) =>
      [
        summary.employee.name,
        summary.sessionCount,
        summary.presentCount,
        summary.absentCount,
        durationLabel(summary.totalMinutes),
        summary.documentationCount,
      ]
        .map(csvCell)
        .join(";"),
    ),
    "",
    `Periode: ${formatDateHuman(`${from}T12:00:00`, "d MMMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMMM yyyy")}`,
    `Diekspor: ${formatDateHuman(new Date().toISOString(), "d MMMM yyyy, HH:mm")} WIB`,
  ];

  const body = `\uFEFF${[...lines, ...summaryLines].join("\r\n")}`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rekap-lembur-${from}-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
