import { getCurrentUser } from "@/lib/auth";
import {
  CHECKLIST_CONDITION_LABEL,
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

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("Sesi berakhir. Silakan masuk kembali.", 401);
  if (user.role !== "atasan") {
    return apiError("Hanya atasan yang dapat mengunduh rekap checklist.", 403);
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
  const filters: ChecklistReportFilters = {
    from,
    to,
    locationId: url.searchParams.get("locationId") || undefined,
    templateId: url.searchParams.get("templateId") || undefined,
    status: url.searchParams.get("status") || undefined,
    search: url.searchParams.get("search")?.trim() || undefined,
  };

  let header: string[];
  let lines: Array<Array<string | number | null | undefined>>;

  if (kind === "item" || kind === "butir") {
    const rows = await getChecklistItemExportRows(user.id, filters);
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
      row.locationName,
      CHECKLIST_STATUS_LABEL[row.status],
      row.position + 1,
      row.groupPath,
      row.prompt,
      row.condition
        ? CHECKLIST_CONDITION_LABEL[
            row.condition as keyof typeof CHECKLIST_CONDITION_LABEL
          ]
        : "Belum diperiksa",
      row.note,
      row.updatedAt ? formatDateTime(row.updatedAt) : "",
    ]);
  } else if (kind === "tindak-lanjut") {
    const data = await getChecklistFollowUpReportData(user.id, filters);
    header = [
      "Dibuat",
      "Judul",
      "Item terkait",
      "Prioritas",
      "Status",
      "Tenggat",
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
      row.inspection.locationName,
      row.inspection.templateName,
      `${row.inspection.periodLabel} (${row.inspection.occurrenceDate})`,
      row.followUp.progressNote,
      row.followUp.resultNote,
    ]);
  } else {
    const data = await getChecklistReportData(user.id, filters);
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
      row.inspection.locationName,
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
    `Periode: ${formatDateHuman(`${from}T12:00:00`, "d MMMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMMM yyyy")}`,
    `Diekspor: ${formatDateHuman(new Date().toISOString(), "d MMMM yyyy, HH:mm")} WIB`,
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
