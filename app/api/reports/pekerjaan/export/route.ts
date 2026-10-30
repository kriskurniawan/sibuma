import { isSuperAdmin } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import {
  excelDate,
  excelDateTime,
  excelFileResponse,
  type ExcelSheetInput,
} from "@/lib/excel";
import { apiError } from "@/lib/http";
import { getManualWorkReportData } from "@/lib/manual-work-report";
import {
  MANUAL_WORK_STATUS_LABEL,
  type ManualWorkReportFilters,
  type ManualWorkReportRow,
} from "@/lib/manual-work-types";
import { pdfFileResponse } from "@/lib/pdf";
import { getPhotoLimits } from "@/lib/photo-limits";
import { currentMonthRange, formatDateHuman, formatDateTime } from "@/lib/time";

export const runtime = "nodejs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[";\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function locationLabel(row: ManualWorkReportRow) {
  return row.locationPath ?? (row.work.locationName || "Tanpa lokasi");
}

function pdfDate(value: string | null | undefined) {
  if (!value) return "-";
  return formatDateHuman(`${value.slice(0, 10)}T12:00:00`, "d MMM yyyy");
}

function reportSheet(
  rows: ManualWorkReportRow[],
  subtitle: string,
): ExcelSheetInput {
  return {
    name: "Pekerjaan Harian",
    title: "Laporan Pekerjaan Harian",
    subtitle,
    columns: [
      { header: "Mulai", width: 12, type: "date" },
      { header: "Target", width: 12, type: "date" },
      { header: "Selesai", width: 17, type: "datetime" },
      { header: "Pekerjaan", width: 34 },
      { header: "Lokasi", width: 28 },
      { header: "Status", width: 14 },
      { header: "Pekerja", width: 30 },
      { header: "Petugas safety", width: 24 },
      { header: "Pelapor", width: 22 },
      { header: "Dokumentasi", width: 12, type: "number", align: "right" },
      { header: "Wajib dokumentasi", width: 16 },
      { header: "Tindak lanjut", width: 30 },
      { header: "Hasil", width: 40 },
      { header: "Dibuat", width: 17, type: "datetime" },
    ],
    rows: rows.map((row) => [
      excelDate(row.work.startDate),
      excelDate(row.work.targetDate),
      row.work.completedAt ? excelDateTime(row.work.completedAt) : null,
      row.work.title,
      locationLabel(row),
      MANUAL_WORK_STATUS_LABEL[row.work.status],
      row.assignees.map((person) => person.name).join(", "),
      row.work.safetyName,
      row.createdByName,
      row.photoCount,
      row.work.requiresDocumentation ? "Ya" : "Tidak",
      row.sourceFollowUp?.title ?? "",
      row.work.resultNote,
      excelDateTime(row.work.createdAt),
    ]),
    notes: [
      "Periode berdasarkan tanggal mulai pekerjaan. Satu baris adalah satu pekerjaan; dokumentasi menunjukkan jumlah foto terlampir.",
    ],
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan" && !isSuperAdmin(user)) {
    return apiError(
      "Kamu tidak memiliki izin untuk mengunduh laporan pekerjaan harian.",
      403,
    );
  }

  const url = new URL(request.url);
  const range = currentMonthRange();
  let from = DATE_PATTERN.test(url.searchParams.get("from") ?? "")
    ? url.searchParams.get("from")!
    : range.from;
  let to = DATE_PATTERN.test(url.searchParams.get("to") ?? "")
    ? url.searchParams.get("to")!
    : range.to;
  if (from > to) [from, to] = [to, from];

  const filters: ManualWorkReportFilters = {
    from,
    to,
    locationId: url.searchParams.get("locationId") || undefined,
    includeSubLocations: url.searchParams.get("includeSub") !== "0",
    employeeId: url.searchParams.get("employeeId") || undefined,
    status: url.searchParams.get("status") || undefined,
    search: url.searchParams.get("search")?.trim() || undefined,
  };

  const [data, photoLimits] = await Promise.all([
    getManualWorkReportData(
      isSuperAdmin(user) ? null : user.id,
      filters,
    ),
    getPhotoLimits(),
  ]);
  const formatParam = url.searchParams.get("format");
  const format =
    formatParam === "xlsx" ? "xlsx" : formatParam === "pdf" ? "pdf" : "csv";
  const period = `${formatDateHuman(`${from}T12:00:00`, "d MMMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMMM yyyy")}`;
  const exportedAt = formatDateHuman(
    new Date().toISOString(),
    "d MMMM yyyy, HH:mm",
  );
  const subtitle = `${period} · Diekspor ${exportedAt} WIB`;

  if (format === "xlsx") {
    return excelFileResponse({
      filename: `laporan-pekerjaan-harian-${from}-${to}.xlsx`,
      sheets: [reportSheet(data.rows, subtitle)],
    });
  }

  if (format === "pdf") {
    return pdfFileResponse({
      filename: `laporan-pekerjaan-harian-${from}-${to}.pdf`,
      title: "Laporan Pekerjaan Harian",
      subtitle: period,
      meta: [
        `${isSuperAdmin(user) ? "Super admin" : "Atasan"}: ${user.name}`,
        `Diekspor ${exportedAt} WIB`,
      ],
      exportedAt,
      kpis: [
        {
          label: "Total pekerjaan",
          value: data.totals.total,
          hint: `${data.totals.completed} selesai · ${data.totals.cancelled} dibatalkan`,
        },
        {
          label: "Masih aktif",
          value: data.totals.active,
          hint: `${data.totals.notStarted} belum mulai · ${data.totals.inProgress} dikerjakan`,
        },
        {
          label: "Terlambat",
          value: data.totals.overdue,
          hint: "Melewati target selesai",
        },
        {
          label: "Dokumentasi",
          value: data.totals.photos,
          hint: `${data.totals.workers} pekerja terlibat`,
        },
      ],
      tables: [
        {
          title: "Rincian pekerjaan harian",
          columns: [
            { header: "Mulai", width: 1.1 },
            { header: "Target", width: 1.1 },
            { header: "Pekerjaan", width: 3.4 },
            { header: "Lokasi", width: 2.6 },
            { header: "Status", width: 1.5 },
            { header: "Pekerja", width: 2.4 },
            { header: "Petugas safety", width: 1.8 },
            { header: "Pelapor", width: 1.8 },
            { header: "Dokumentasi", width: 1.3, align: "center" },
            { header: "Tindak lanjut", width: 2.4 },
            { header: "Hasil", width: 3.2 },
          ],
          rows: data.rows.map((row) => [
            pdfDate(row.work.startDate),
            pdfDate(row.work.targetDate),
            row.work.title,
            locationLabel(row),
            `${MANUAL_WORK_STATUS_LABEL[row.work.status]}${row.overdue ? " (terlambat)" : ""}`,
            row.assignees.map((person) => person.name).join(", ") || "-",
            row.work.safetyName || "-",
            row.createdByName,
            row.work.requiresDocumentation
              ? `${row.photoCount}/${photoLimits.workPhotos} foto`
              : "Tidak wajib",
            row.sourceFollowUp?.title ?? "-",
            row.work.resultNote || "-",
          ]),
          notes: [
            "Periode berdasarkan tanggal mulai pekerjaan. Satu baris adalah satu pekerjaan.",
            "Dokumentasi menunjukkan jumlah foto terlampir; pekerja kosong ditandai dengan tanda hubung.",
          ],
        },
      ],
    });
  }

  const header = [
    "Mulai",
    "Target",
    "Selesai",
    "Pekerjaan",
    "Lokasi",
    "Status",
    "Pekerja",
    "Petugas safety",
    "Pelapor",
    "Dokumentasi",
    "Wajib dokumentasi",
    "Tindak lanjut",
    "Hasil",
    "Dibuat",
  ];
  const lines = data.rows.map((row) => [
    row.work.startDate,
    row.work.targetDate ?? "",
    row.work.completedAt ? formatDateTime(row.work.completedAt) : "",
    row.work.title,
    locationLabel(row),
    MANUAL_WORK_STATUS_LABEL[row.work.status],
    row.assignees.map((person) => person.name).join(", "),
    row.work.safetyName,
    row.createdByName,
    row.photoCount,
    row.work.requiresDocumentation ? "Ya" : "Tidak",
    row.sourceFollowUp?.title ?? "",
    row.work.resultNote,
    formatDateTime(row.work.createdAt),
  ]);

  const body = `\uFEFF${[
    header.map(csvCell).join(";"),
    ...lines.map((line) => line.map(csvCell).join(";")),
    "",
    `Periode: ${period}`,
    `Diekspor: ${exportedAt} WIB`,
  ].join("\r\n")}`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laporan-pekerjaan-harian-${from}-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
