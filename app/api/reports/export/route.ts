import { isSuperAdmin } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { ATTENDANCE_STATUS_LABEL } from "@/lib/constants";
import { excelDate, excelFileResponse } from "@/lib/excel";
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
  if (user.role !== "atasan" && !isSuperAdmin(user)) {
    return apiError("Kamu tidak memiliki izin untuk mengunduh rekap.", 403);
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

  const data = await getReportData(isSuperAdmin(user) ? null : user.id, {
    from,
    to,
    employeeId: url.searchParams.get("employeeId") || undefined,
    spklId: url.searchParams.get("spklId") || undefined,
    search: url.searchParams.get("search")?.trim() || undefined,
  });

  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const period = `${formatDateHuman(`${from}T12:00:00`, "d MMMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMMM yyyy")}`;
  const exportedAt = formatDateHuman(
    new Date().toISOString(),
    "d MMMM yyyy, HH:mm",
  );

  if (format === "xlsx") {
    return excelFileResponse({
      filename: `rekap-lembur-${from}-${to}.xlsx`,
      sheets: [
        {
          name: "Rekap Lembur",
          title: "Rekap Lembur",
          subtitle: `${period} · Diekspor ${exportedAt} WIB`,
          columns: [
            { header: "Tanggal", width: 12, type: "date" },
            { header: "Nomor SPKL", width: 18 },
            { header: "Pekerjaan", width: 30 },
            { header: "Nama pekerja", width: 24 },
            { header: "NIK", width: 18 },
            { header: "Status absensi", width: 16 },
            { header: "Jam masuk", width: 10, align: "center" },
            { header: "Jam pulang", width: 10, align: "center" },
            {
              header: "Durasi (menit)",
              width: 14,
              type: "number",
              align: "right",
            },
            {
              header: "Dokumentasi",
              width: 12,
              type: "number",
              align: "right",
            },
            { header: "Catatan koreksi", width: 36 },
          ],
          rows: data.rows.map((row) => [
            excelDate(row.spkl.date),
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
              ? 0
              : (row.attendance.durationMinutes ?? null),
            row.documentationCount,
            row.attendance.correctionReason ?? "",
          ]),
          notes: [
            "Durasi dalam menit, dihitung dari check-in efektif hingga check-out dan dibatasi jadwal SPKL.",
          ],
        },
        {
          name: "Ringkasan Pekerja",
          title: "Ringkasan per Pekerja",
          subtitle: `${period} · Diekspor ${exportedAt} WIB`,
          columns: [
            { header: "Nama pekerja", width: 24 },
            { header: "NIK", width: 18 },
            { header: "Sesi", width: 10, type: "number", align: "right" },
            { header: "Hadir", width: 10, type: "number", align: "right" },
            {
              header: "Tidak hadir",
              width: 12,
              type: "number",
              align: "right",
            },
            {
              header: "Total durasi (menit)",
              width: 18,
              type: "number",
              align: "right",
            },
            {
              header: "Dokumentasi",
              width: 12,
              type: "number",
              align: "right",
            },
          ],
          rows: data.summaries.map((summary) => [
            summary.employee.name,
            summary.employee.nik,
            summary.sessionCount,
            summary.presentCount,
            summary.absentCount,
            summary.totalMinutes,
            summary.documentationCount,
          ]),
          totals: [
            "Total",
            "",
            data.totals.sessions,
            data.totals.present,
            data.totals.absent,
            data.totals.minutes,
            data.totals.documentation,
          ],
          notes: ["Total durasi dalam menit dan siap dijumlahkan untuk penggajian."],
        },
      ],
    });
  }

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
    `Periode: ${period}`,
    `Diekspor: ${exportedAt} WIB`,
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
