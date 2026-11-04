import "server-only";

import { jsPDF } from "jspdf";
import autoTable, {
  type CellDef,
  type RowInput,
  type UserOptions,
} from "jspdf-autotable";
import {
  formatRecapHours,
  formatRecapRupiah,
} from "./overtime-recap-format";
import type {
  OvertimeRecapPreview,
  OvertimeRecapSigners,
} from "./overtime-recap-types";

const MARGIN = 24;
const TOP_MARGIN = 48;
const BOTTOM_MARGIN = 44;

const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const BORDER: [number, number, number] = [148, 163, 184];
const HEADER_BG: [number, number, number] = [226, 232, 240];
const HK_BG: [number, number, number] = [254, 243, 199];
const HL_BG: [number, number, number] = [219, 234, 254];
const TOTAL_BG: [number, number, number] = [253, 224, 71];
const GRAND_TOTAL_BG: [number, number, number] = [254, 249, 195];

const COLUMN_WIDTHS = [
  22, 164, 120, 78, 78, 25, 25, 28, 28, 54, 54, 74, 43.8,
];

function clean(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u00b7\u2022]/g, "-");
}

function pageSize(doc: jsPDF) {
  return {
    width: doc.internal.pageSize.getWidth(),
    height: doc.internal.pageSize.getHeight(),
  };
}

function drawSlimHeader(doc: jsPDF, subtitle: string) {
  const { width } = pageSize(doc);
  doc
    .setFont("helvetica", "normal")
    .setFontSize(6.5)
    .setTextColor(...MUTED);
  doc.text("SIBUMA - Sistem Building Management", MARGIN, 22);
  doc.text(clean(subtitle), width - MARGIN, 22, { align: "right" });
  doc
    .setDrawColor(...BORDER)
    .setLineWidth(0.6)
    .line(MARGIN, 30, width - MARGIN, 30);
}

function drawTitle(doc: jsPDF, preview: OvertimeRecapPreview) {
  const { width } = pageSize(doc);
  doc
    .setFont("helvetica", "bold")
    .setFontSize(7)
    .setTextColor(...MUTED);
  doc.text("SIBUMA - SISTEM BUILDING MANAGEMENT", MARGIN, 34);

  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...INK);
  doc.text("REKAPITULASI LEMBUR", width / 2, 57, { align: "center" });

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  doc.text(
    clean(`Periode: ${preview.periodLabel}`),
    width / 2,
    72,
    { align: "center" },
  );
  doc.text(
    clean(`Tim: ${preview.owner.name}`),
    width / 2,
    84,
    { align: "center" },
  );

  doc
    .setDrawColor(...BORDER)
    .setLineWidth(0.8)
    .line(MARGIN, 94, width - MARGIN, 94);

  return 108;
}

function drawFooters(doc: jsPDF, exportedAt: string) {
  const { width, height } = pageSize(doc);
  const total = doc.getNumberOfPages();

  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc
      .setDrawColor(...BORDER)
      .setLineWidth(0.6)
      .line(MARGIN, height - 28, width - MARGIN, height - 28);
    doc
      .setFont("helvetica", "normal")
      .setFontSize(6.3)
      .setTextColor(...MUTED);
    doc.text("SIBUMA - Sistem Building Management", MARGIN, height - 17);
    doc.text(
      `Diekspor ${exportedAt}  |  Halaman ${page} dari ${total}`,
      width - MARGIN,
      height - 17,
      { align: "right" },
    );
  }
}

function ensureSpace(doc: jsPDF, y: number, needed: number, title: string) {
  const { height } = pageSize(doc);
  if (y + needed <= height - BOTTOM_MARGIN) return y;
  doc.addPage();
  drawSlimHeader(doc, title);
  return TOP_MARGIN;
}

function signatureName(value: string) {
  const name = value.replace(/\s+/g, " ").trim();
  return name || "............................";
}

function drawSignatures(
  doc: jsPDF,
  preview: OvertimeRecapPreview,
  signers: OvertimeRecapSigners,
  y: number,
  title: string,
) {
  const { width } = pageSize(doc);
  const contentWidth = width - MARGIN * 2;
  const startY = ensureSpace(doc, y + 26, 92, title);
  const blockWidth = contentWidth * 0.3;
  const leftX = MARGIN + contentWidth * 0.1;
  const rightX = MARGIN + contentWidth * 0.58;

  const drawBlock = (
    x: number,
    label: string,
    name: string,
    date: string,
  ) => {
    doc
      .setFont("helvetica", "normal")
      .setFontSize(8.5)
      .setTextColor(...INK);
    doc.text(label, x + blockWidth / 2, startY, { align: "center" });
    doc.text(date, x + blockWidth / 2, startY + 13, { align: "center" });

    doc
      .setDrawColor(...BORDER)
      .setLineWidth(0.6)
      .line(x, startY + 55, x + blockWidth, startY + 55);

    doc
      .setFont("helvetica", "bold")
      .setFontSize(8.5)
      .setTextColor(...INK);
    doc.text(
      clean(`( ${signatureName(name)} )`),
      x + blockWidth / 2,
      startY + 68,
      { align: "center" },
    );
  };

  const exportedDate = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  drawBlock(leftX, "Building Manager,", signers.buildingManagerName, exportedDate);
  drawBlock(rightX, "Manager,", signers.managerName, exportedDate);
  return startY + 86;
}

function totalRow(
  preview: OvertimeRecapPreview,
): RowInput {
  const hkPay = preview.rows.reduce((total, row) => total + row.hkPay, 0);
  const hlPay = preview.rows.reduce((total, row) => total + row.hlPay, 0);
  return [
    { content: "TOTAL", colSpan: 5, styles: { halign: "left" } },
    preview.totals.hkDays,
    preview.totals.hlDays,
    formatRecapHours(preview.totals.hkMinutes),
    formatRecapHours(preview.totals.hlMinutes),
    formatRecapRupiah(hkPay),
    formatRecapRupiah(hlPay),
    formatRecapRupiah(preview.totals.totalPay),
    `${formatRecapHours(preview.totals.hkMinutes + preview.totals.hlMinutes)} jam`,
  ];
}

export interface OvertimeRecapPdfInput {
  preview: OvertimeRecapPreview;
  signers: OvertimeRecapSigners;
  exportedAt: string;
}

export function createOvertimeRecapPdf(input: OvertimeRecapPdfInput) {
  const { preview } = input;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const { width } = pageSize(doc);
  const contentWidth = width - MARGIN * 2;
  const headedPages = new Set<number>([1]);
  const title = `Rekapitulasi Lembur ${preview.monthLabel}`;
  let startY = drawTitle(doc, preview);

  const head: CellDef[][] = [
    [
      { content: "No", rowSpan: 2 },
      { content: "Nama", rowSpan: 2 },
      { content: "Jabatan", rowSpan: 2 },
      { content: "Basic Salary", rowSpan: 2 },
      { content: "Tarif Lembur per Jam", rowSpan: 2 },
      { content: "Jumlah Hari", colSpan: 2 },
      { content: "Jumlah Jam", colSpan: 2 },
      { content: "Jumlah Lembur", colSpan: 2 },
      { content: "Total Lembur", rowSpan: 2 },
      { content: "KET", rowSpan: 2 },
    ],
    [
      { content: "HK", styles: { fillColor: HK_BG } },
      { content: "HL", styles: { fillColor: HL_BG } },
      { content: "HK", styles: { fillColor: HK_BG } },
      { content: "HL", styles: { fillColor: HL_BG } },
      { content: "Hari Kerja", styles: { fillColor: HK_BG } },
      { content: "Hari Libur", styles: { fillColor: HL_BG } },
    ],
  ];

  const body = preview.rows.map((row, index) => [
    index + 1,
    row.name,
    row.jobTitle ?? "-",
    formatRecapRupiah(row.basicSalary),
    formatRecapRupiah(row.hourlyRate),
    row.hkDays,
    row.hlDays,
    formatRecapHours(row.hkMinutes),
    formatRecapHours(row.hlMinutes),
    formatRecapRupiah(row.hkPay),
    formatRecapRupiah(row.hlPay),
    formatRecapRupiah(row.totalPay),
    `${formatRecapHours(row.hkMinutes + row.hlMinutes)} jam`,
  ]);

  const columnStyles: UserOptions["columnStyles"] = Object.fromEntries(
    COLUMN_WIDTHS.map((cellWidth, index) => [
      String(index),
      {
        cellWidth,
        halign:
          index === 1 || index === 2
            ? "left"
            : index === 0
              ? "center"
              : "right",
      },
    ]),
  );

  autoTable(doc, {
    head,
    body,
    foot: [totalRow(preview)],
    startY,
    margin: {
      top: TOP_MARGIN,
      right: MARGIN,
      bottom: BOTTOM_MARGIN,
      left: MARGIN,
    },
    tableWidth: contentWidth,
    theme: "grid",
    showHead: "everyPage",
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: { top: 4, right: 3.5, bottom: 4, left: 3.5 },
      overflow: "linebreak",
      textColor: INK,
      lineColor: BORDER,
      lineWidth: 0.4,
      valign: "middle",
    },
    headStyles: {
      fillColor: HEADER_BG,
      textColor: INK,
      fontStyle: "bold",
      halign: "center",
      lineColor: BORDER,
      fontSize: 6.8,
    },
    footStyles: {
      fillColor: GRAND_TOTAL_BG,
      textColor: INK,
      fontStyle: "bold",
      lineColor: BORDER,
    },
    columnStyles,
    didParseCell: (data) => {
      if (data.section === "foot" && data.column.index === 11) {
        data.cell.styles.fillColor = TOTAL_BG;
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1 && !headedPages.has(data.pageNumber)) {
        drawSlimHeader(doc, title);
        headedPages.add(data.pageNumber);
      }
    },
  });

  const tableDoc = doc as jsPDF & {
    lastAutoTable?: { finalY?: number };
  };
  let lastY = tableDoc.lastAutoTable?.finalY ?? startY;

  doc
    .setFont("helvetica", "italic")
    .setFontSize(6.6)
    .setTextColor(...MUTED);
  const notes = [
    "Tarif per jam = gaji pokok / 173. HK = jam HK x tarif x 1,5; HL = jam HL x tarif x 2.",
    "HL otomatis untuk hari Minggu dan libur nasional resmi; cuti bersama tidak termasuk HL.",
    "Nominal dihitung dengan nilai penuh dan dibulatkan saat ditampilkan.",
  ];
  for (const note of notes) {
    lastY = ensureSpace(doc, lastY + 10, 12, title);
    const lines = doc.splitTextToSize(clean(note), contentWidth);
    doc.text(lines, MARGIN, lastY + 8);
    lastY += lines.length * 9 + 2;
  }

  drawSignatures(doc, preview, input.signers, lastY + 16, title);
  drawFooters(doc, input.exportedAt);
  return doc;
}

export function overtimeRecapPdfResponse(input: OvertimeRecapPdfInput) {
  const doc = createOvertimeRecapPdf(input);
  const bytes = Buffer.from(doc.output("arraybuffer"));

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rekapitulasi-lembur-${input.preview.month}.pdf"`,
      "Cache-Control": "no-store",
      "Content-Length": String(bytes.byteLength),
    },
  });
}
