import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { DailyReportData } from "./daily-report-types";

export const DEFAULT_DAILY_REPORT_TITLE = "LAPORAN HARIAN TIM";

export interface DailyReportTextOptions {
  /** Judul manual; tanda bintang ditambahkan otomatis. */
  title?: string;
  /** Catatan manual yang tampil satu tingkat di bawah tanggal. */
  notes?: string;
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function textTitle(value?: string) {
  const cleaned = cleanText(value ?? "")
    .replace(/^\*+\s*/, "")
    .replace(/\s*\*+$/, "");
  return cleaned || DEFAULT_DAILY_REPORT_TITLE;
}

function textNotes(value?: string) {
  const source = (value ?? "").replace(/\r\n/g, "\n").trim();
  if (!source) return "";
  const lines = source.split("\n").map((line) => line.trim());
  while (lines[0] === "") lines.shift();
  while (lines.at(-1) === "") lines.pop();
  if (lines.length === 0) return "";
  const [first, ...rest] = lines;
  return [
    `  ${first}`,
    ...rest.map((line) => (line ? `  ${line}` : "")),
  ].join("\n");
}

export function formatDailyReportDate(date: string) {
  try {
    const parsed = parseISO(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return format(parsed, "EEEE, d MMMM yyyy", { locale: localeId });
  } catch {
    return date;
  }
}

/**
 * Teks laporan sengaja tidak memuat status pekerjaan/checklist. Pekerja hanya
 * menyalin bagian yang sudah selesai, sehingga label "selesai" tidak perlu
 * diulang dan tidak ada info pekerjaan yang masih berjalan. Setiap baris
 * digabung menjadi satu kalimat pendek: judul - lokasi.
 *
 * Judul dan catatan diisi manual. Catatan dipisahkan satu baris kosong dari
 * tanggal, tetap menjorok, dan tidak memakai label "Catatan lain". Nama tim,
 * dokumentasi, dan "Disiapkan oleh" juga tidak ditampilkan agar laporan
 * ringkas.
 *
 * Checklist memakai item spesifik di dalam template (mis. "Cek oli"), bukan
 * nama template yang berulang, dan selalu diawali "Monitoring". Baris yang
 * identik setelah dinormalisasi hanya ditampilkan sekali.
 */
export function buildDailyReportText(
  report: Pick<DailyReportData, "date" | "works" | "checklists">,
  options: DailyReportTextOptions = {},
) {
  const sections: string[] = [];

  const dateLabel = formatDailyReportDate(report.date);
  const identity = [
    `*${textTitle(options.title)}*`,
    dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
  ];
  const notes = textNotes(options.notes);
  if (notes) identity.push("", notes);
  sections.push(identity.join("\n"));

  const seen = new Set<string>();
  const checklistLines: string[] = [];
  for (const checklist of report.checklists) {
    const location = cleanText(checklist.locationName);
    const labels =
      checklist.items.length > 0 ? checklist.items : [checklist.templateName];
    for (const label of labels) {
      const cleaned = cleanText(label);
      if (!cleaned) continue;
      const prefixed = /^monitoring\b/i.test(cleaned)
        ? cleaned
        : `Monitoring ${cleaned}`;
      const line = [prefixed, location].filter(Boolean).join(" - ");
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      checklistLines.push(line);
    }
  }

  const items = [
    ...report.works.map((work) =>
      [cleanText(work.title), cleanText(work.locationName)]
        .filter(Boolean)
        .join(" - "),
    ),
    ...checklistLines,
  ];

  if (items.length > 0) {
    sections.push(items.map((item) => `- ${item}`).join("\n"));
  } else {
    sections.push(
      "Belum ada pekerjaan atau checklist yang tercatat pada tanggal ini.",
    );
  }

  return sections.join("\n\n");
}
