import { getCurrentUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/access";
import { listChecklistConditions } from "@/lib/checklist-conditions";
import {
  CHECKLIST_FOLLOW_UP_LABEL,
  CHECKLIST_PRIORITY_LABEL,
  CHECKLIST_STATUS_LABEL,
  type ChecklistReportFilters,
} from "@/lib/checklist-types";
import {
  getChecklistFollowUpReportData,
  getChecklistItemExportRows,
  getChecklistReportData,
} from "@/lib/checklist-report";
import {
  excelDate,
  excelDateTime,
  excelFileResponse,
  type ExcelSheetInput,
} from "@/lib/excel";
import { apiError } from "@/lib/http";
import { currentMonthRange, formatDateHuman, formatDateTime } from "@/lib/time";

export const runtime = "nodejs";

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[";\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type RekapData = Awaited<ReturnType<typeof getChecklistReportData>>;
type ItemData = Awaited<ReturnType<typeof getChecklistItemExportRows>>;
type FollowUpData = Awaited<ReturnType<typeof getChecklistFollowUpReportData>>;

function rekapSheet(data: RekapData, subtitle: string): ExcelSheetInput {
  return {
    name: "Rekap Checklist",
    title: "Rekap Checklist",
    subtitle,
    columns: [
      { header: "Periode", width: 12, type: "date" },
      { header: "Jatuh tempo", width: 17, type: "datetime" },
      { header: "Template", width: 26 },
      { header: "Kategori", width: 16 },
      { header: "Lokasi", width: 28 },
      { header: "Status", width: 14 },
      { header: "Selesai", width: 17, type: "datetime" },
      { header: "Ketepatan waktu", width: 14 },
      { header: "Diperiksa", width: 10, type: "number", align: "right" },
      { header: "Total item", width: 10, type: "number", align: "right" },
      { header: "Temuan", width: 9, type: "number", align: "right" },
      {
        header: "Tindak lanjut",
        width: 12,
        type: "number",
        align: "right",
      },
      { header: "Petugas", width: 28 },
    ],
    rows: data.rows.map((row) => [
      excelDate(row.inspection.occurrenceDate),
      excelDateTime(row.inspection.dueAt),
      row.inspection.templateName,
      row.inspection.category,
      row.locationPath ?? row.inspection.locationName,
      CHECKLIST_STATUS_LABEL[row.inspection.status],
      row.inspection.completedAt
        ? excelDateTime(row.inspection.completedAt)
        : null,
      row.late
        ? "Terlambat"
        : row.inspection.status === "selesai"
          ? "Tepat waktu"
          : "",
      row.answeredCount,
      row.totalItems,
      row.issueCount,
      row.openFollowUps,
      row.assignees.map((person) => person.name).join(", "),
    ]),
    notes: [
      "Periode berdasarkan tanggal jatuh tempo (occurrence). Temuan dan tindak lanjut mengikuti data terbaru.",
    ],
  };
}

function itemSheet(
  rows: ItemData,
  conditions: Array<{ id: string; label: string }>,
  subtitle: string,
): ExcelSheetInput {
  const conditionLabel = new Map(
    conditions.map((condition) => [condition.id, condition.label]),
  );

  return {
    name: "Rincian Item",
    title: "Rincian Item Checklist",
    subtitle,
    columns: [
      { header: "Periode", width: 12, type: "date" },
      { header: "Jatuh tempo", width: 17, type: "datetime" },
      { header: "Template", width: 26 },
      { header: "Kategori", width: 16 },
      { header: "Lokasi", width: 28 },
      { header: "Status pemeriksaan", width: 17 },
      { header: "No", width: 6, type: "number", align: "right" },
      { header: "Grup", width: 24 },
      { header: "Item", width: 40 },
      { header: "Kondisi", width: 22 },
      { header: "Catatan", width: 36 },
      { header: "Diperbarui", width: 17, type: "datetime" },
    ],
    rows: rows.map((row) => [
      excelDate(row.occurrenceDate),
      excelDateTime(row.dueAt),
      row.templateName,
      row.category,
      row.locationPath ?? row.locationName,
      CHECKLIST_STATUS_LABEL[row.status],
      row.position + 1,
      row.groupPath,
      row.prompt,
      row.condition
        ? (conditionLabel.get(row.condition) ?? row.condition)
        : "Belum diperiksa",
      row.note,
      row.updatedAt ? excelDateTime(row.updatedAt) : null,
    ]),
    notes: [
      "Satu baris per item pemeriksaan. \u201cBelum diperiksa\u201d berarti item belum memiliki kondisi.",
    ],
  };
}

function followUpSheet(data: FollowUpData, subtitle: string): ExcelSheetInput {
  return {
    name: "Tindak Lanjut",
    title: "Laporan Tindak Lanjut",
    subtitle,
    columns: [
      { header: "Dibuat", width: 17, type: "datetime" },
      { header: "Judul", width: 34 },
      { header: "Item terkait", width: 30 },
      { header: "Prioritas", width: 10 },
      { header: "Status", width: 14 },
      { header: "Deadline", width: 12, type: "date" },
      { header: "PIC", width: 22 },
      { header: "Lokasi", width: 28 },
      { header: "Template", width: 26 },
      { header: "Periode", width: 24 },
      { header: "Progres", width: 40 },
      { header: "Hasil", width: 40 },
    ],
    rows: data.items.map((row) => [
      excelDateTime(row.followUp.createdAt),
      row.followUp.title,
      row.prompt ?? "",
      CHECKLIST_PRIORITY_LABEL[row.followUp.priority],
      CHECKLIST_FOLLOW_UP_LABEL[row.followUp.status],
      excelDate(row.followUp.dueDate),
      row.pic?.name ?? "",
      row.inspection.locationPath ?? row.inspection.locationName,
      row.inspection.templateName,
      `${row.inspection.periodLabel} (${row.inspection.occurrenceDate})`,
      row.followUp.progressNote,
      row.followUp.resultNote,
    ]),
    notes: [
      "Deadline, prioritas, dan status mengikuti data tindak lanjut terbaru.",
    ],
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan" && !isSuperAdmin(user)) {
    return apiError("Kamu tidak memiliki izin untuk mengunduh rekap checklist.", 403);
  }

  const url = new URL(request.url);
  const range = currentMonthRange();
  const from = DATE_PATTERN.test(url.searchParams.get("from") ?? "")
    ? url.searchParams.get("from")!
    : range.from;
  const to = DATE_PATTERN.test(url.searchParams.get("to") ?? "")
    ? url.searchParams.get("to")!
    : range.to;
  const kind = url.searchParams.get("kind") ?? "rekap";
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const ownerId = isSuperAdmin(user) ? null : user.id;
  const filters: ChecklistReportFilters = {
    from,
    to,
    locationId: url.searchParams.get("locationId") || undefined,
    includeSubLocations: url.searchParams.get("includeSub") !== "0",
    templateId: url.searchParams.get("templateId") || undefined,
    status: url.searchParams.get("status") || undefined,
    search: url.searchParams.get("search")?.trim() || undefined,
  };

  const period = `${formatDateHuman(`${from}T12:00:00`, "d MMMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMMM yyyy")}`;
  const exportedAt = formatDateHuman(
    new Date().toISOString(),
    "d MMMM yyyy, HH:mm",
  );
  const subtitle = `${period} · Diekspor ${exportedAt} WIB`;

  if (format === "xlsx") {
    const conventionalKind =
      kind === "butir" ? "item" : kind === "rincian" ? "item" : kind;

    if (conventionalKind === "laporan") {
      const [rekap, items, conditions] = await Promise.all([
        getChecklistReportData(ownerId, filters),
        getChecklistItemExportRows(ownerId, filters),
        listChecklistConditions({ includeInactive: true }),
      ]);
      return excelFileResponse({
        filename: `laporan-checklist-${from}-${to}.xlsx`,
        sheets: [
          rekapSheet(rekap, subtitle),
          itemSheet(items, conditions, subtitle),
        ],
      });
    }

    if (conventionalKind === "item") {
      const [items, conditions] = await Promise.all([
        getChecklistItemExportRows(ownerId, filters),
        listChecklistConditions({ includeInactive: true }),
      ]);
      return excelFileResponse({
        filename: `rincian-item-checklist-${from}-${to}.xlsx`,
        sheets: [itemSheet(items, conditions, subtitle)],
      });
    }

    if (conventionalKind === "tindak-lanjut") {
      const data = await getChecklistFollowUpReportData(ownerId, filters);
      return excelFileResponse({
        filename: `tindak-lanjut-${from}-${to}.xlsx`,
        sheets: [followUpSheet(data, subtitle)],
      });
    }

    const data = await getChecklistReportData(ownerId, filters);
    return excelFileResponse({
      filename: `rekap-checklist-${from}-${to}.xlsx`,
      sheets: [rekapSheet(data, subtitle)],
    });
  }

  let header: string[];
  let lines: Array<Array<string | number | null | undefined>>;

  if (kind === "item" || kind === "butir") {
    const [rows, conditions] = await Promise.all([
      getChecklistItemExportRows(ownerId, filters),
      listChecklistConditions({ includeInactive: true }),
    ]);
    const conditionLabel = new Map(
      conditions.map((condition) => [condition.id, condition.label]),
    );
    header = [
      "Periode",
      "Jatuh tempo",
      "Template",
      "Kategori",
      "Lokasi",
      "Status pemeriksaan",
      "No",
      "Grup",
      "Item",
      "Kondisi",
      "Catatan",
      "Diperbarui",
    ];
    lines = rows.map((row) => [
      row.occurrenceDate,
      formatDateTime(row.dueAt),
      row.templateName,
      row.category,
      row.locationPath ?? row.locationName,
      CHECKLIST_STATUS_LABEL[row.status],
      row.position + 1,
      row.groupPath,
      row.prompt,
      row.condition
        ? (conditionLabel.get(row.condition) ?? row.condition)
        : "Belum diperiksa",
      row.note,
      row.updatedAt ? formatDateTime(row.updatedAt) : "",
    ]);
  } else if (kind === "tindak-lanjut") {
    const data = await getChecklistFollowUpReportData(ownerId, filters);
    header = [
      "Dibuat",
      "Judul",
      "Item terkait",
      "Prioritas",
      "Status",
      "Deadline",
      "PIC",
      "Lokasi",
      "Template",
      "Periode",
      "Progres",
      "Hasil",
    ];
    lines = data.items.map((row) => [
      formatDateTime(row.followUp.createdAt),
      row.followUp.title,
      row.prompt ?? "",
      CHECKLIST_PRIORITY_LABEL[row.followUp.priority],
      CHECKLIST_FOLLOW_UP_LABEL[row.followUp.status],
      row.followUp.dueDate ?? "",
      row.pic?.name ?? "",
      row.inspection.locationPath ?? row.inspection.locationName,
      row.inspection.templateName,
      `${row.inspection.periodLabel} (${row.inspection.occurrenceDate})`,
      row.followUp.progressNote,
      row.followUp.resultNote,
    ]);
  } else {
    const data = await getChecklistReportData(ownerId, filters);
    header = [
      "Periode",
      "Jatuh tempo",
      "Template",
      "Kategori",
      "Lokasi",
      "Status",
      "Selesai",
      "Ketepatan waktu",
      "Item diperiksa",
      "Temuan",
      "Tindak lanjut terbuka",
      "Petugas",
    ];
    lines = data.rows.map((row) => [
      row.inspection.occurrenceDate,
      formatDateTime(row.inspection.dueAt),
      row.inspection.templateName,
      row.inspection.category,
      row.locationPath ?? row.inspection.locationName,
      CHECKLIST_STATUS_LABEL[row.inspection.status],
      row.inspection.completedAt
        ? formatDateTime(row.inspection.completedAt)
        : "",
      row.late
        ? "Terlambat"
        : row.inspection.status === "selesai"
          ? "Tepat waktu"
          : "",
      `${row.answeredCount}/${row.totalItems}`,
      row.issueCount,
      row.openFollowUps,
      row.assignees.map((person) => person.name).join(", "),
    ]);
  }

  const body = `\uFEFF${[
    header.map(csvCell).join(";"),
    ...lines.map((line) => line.map(csvCell).join(";")),
    "",
    `Periode: ${period}`,
    `Diekspor: ${exportedAt} WIB`,
  ].join("\r\n")}`;

  const slug =
    kind === "item" || kind === "butir"
      ? "rincian-item"
      : kind === "tindak-lanjut"
        ? "tindak-lanjut"
        : "rekap-checklist";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-${from}-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
