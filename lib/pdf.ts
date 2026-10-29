import "server-only";

import { jsPDF } from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";

export type PdfCell = string | number | null | undefined;
export type PdfAlign = "left" | "center" | "right";

export interface PdfColumn {
  header: string;
  /** Bobot lebar relatif terhadap kolom lain. Default 1. */
  width?: number;
  align?: PdfAlign;
}

export interface PdfTableInput {
  title?: string;
  columns: PdfColumn[];
  rows: PdfCell[][];
  totals?: PdfCell[];
  notes?: string[];
}

export interface PdfKpi {
  label: string;
  value: string | number;
  hint?: string;
}

export interface PdfReportInput {
  title: string;
  subtitle?: string;
  meta?: string[];
  kpis?: PdfKpi[];
  tables: PdfTableInput[];
  filename: string;
  orientation?: "portrait" | "landscape";
  /** Waktu ekspor yang sudah diformat, ditampilkan di footer. */
  exportedAt?: string;
}

const MARGIN = 24;
const TOP_MARGIN = 48;
const BOTTOM_MARGIN = 44;

const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const BORDER: [number, number, number] = [226, 232, 240];
const ZEBRA: [number, number, number] = [248, 250, 252];
const HEADER_BG: [number, number, number] = [30, 41, 59];
const TOTAL_BG: [number, number, number] = [226, 232, 240];

/**
 * jsPDF memakai font standar Helvetica dengan encoding WinAnsi. Normalisasi
 * karakter tipografis agar teks Indonesia tetap tercetak sebagai teks biasa.
 */
function clean(value: PdfCell) {
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

function drawSlimHeader(doc: jsPDF, title: string) {
  const { width } = pageSize(doc);
  doc
    .setFont("helvetica", "normal")
    .setFontSize(6.5)
    .setTextColor(...MUTED);
  doc.text("SIBUMA - Sistem Building Management", MARGIN, 22);
  doc.text(clean(title), width - MARGIN, 22, { align: "right" });
  doc
    .setDrawColor(...BORDER)
    .setLineWidth(0.6)
    .line(MARGIN, 30, width - MARGIN, 30);
}

function drawFirstHeader(doc: jsPDF, input: PdfReportInput) {
  const { width } = pageSize(doc);
  const contentWidth = width - MARGIN * 2;
  let y = 28;

  doc
    .setFont("helvetica", "bold")
    .setFontSize(6.5)
    .setTextColor(...MUTED);
  doc.text("SIBUMA - SISTEM BUILDING MANAGEMENT", MARGIN, y);

  y += 18;
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...INK);
  const titleLines = doc.splitTextToSize(clean(input.title), contentWidth);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 18;

  if (input.subtitle) {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    const subtitleLines = doc.splitTextToSize(clean(input.subtitle), contentWidth);
    doc.text(subtitleLines, MARGIN, y);
    y += subtitleLines.length * 12;
  }

  if (input.meta?.length) {
    doc.setFont("helvetica", "normal").setFontSize(6.8).setTextColor(...MUTED);
    const metaLines = doc.splitTextToSize(
      input.meta.map(clean).join("  |  "),
      contentWidth,
    );
    doc.text(metaLines, MARGIN, y);
    y += metaLines.length * 10;
  }

  y += 6;
  doc
    .setDrawColor(...BORDER)
    .setLineWidth(0.8)
    .line(MARGIN, y, width - MARGIN, y);
  y += 10;

  if (input.kpis?.length) {
    const perRow = Math.min(Math.max(input.kpis.length, 1), 4);
    const gap = 8;
    const boxWidth = (contentWidth - gap * (perRow - 1)) / perRow;
    const boxHeight = 46;
    input.kpis.forEach((kpi, index) => {
      const row = Math.floor(index / perRow);
      const column = index % perRow;
      const x = MARGIN + column * (boxWidth + gap);
      const top = y + row * (boxHeight + gap);

      doc.setFillColor(...ZEBRA).setDrawColor(...BORDER).setLineWidth(0.5);
      doc.rect(x, top, boxWidth, boxHeight, "FD");

      doc
        .setFont("helvetica", "normal")
        .setFontSize(5.8)
        .setTextColor(...MUTED);
      doc.text(clean(kpi.label).toUpperCase().slice(0, 48), x + 7, top + 12);

      doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...INK);
      doc.text(clean(kpi.value).slice(0, 28), x + 7, top + 27);

      if (kpi.hint) {
        doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(...MUTED);
        doc.text(clean(kpi.hint).slice(0, 46), x + 7, top + 39);
      }
    });

    y +=
      Math.ceil(input.kpis.length / perRow) * boxHeight +
      (Math.ceil(input.kpis.length / perRow) - 1) * gap +
      12;
  }

  return y;
}

function ensureSpace(
  doc: jsPDF,
  y: number,
  needed: number,
  title: string,
) {
  const { height } = pageSize(doc);
  if (y + needed <= height - BOTTOM_MARGIN) return y;
  doc.addPage();
  drawSlimHeader(doc, title);
  return TOP_MARGIN;
}

function drawNotes(
  doc: jsPDF,
  notes: string[],
  y: number,
  title: string,
) {
  const { width } = pageSize(doc);
  const contentWidth = width - MARGIN * 2;
  let nextY = y;
  doc.setFont("helvetica", "italic").setFontSize(6.6).setTextColor(...MUTED);

  for (const note of notes) {
    const lines = doc.splitTextToSize(`- ${clean(note)}`, contentWidth);
    const needed = lines.length * 9 + 4;
    nextY = ensureSpace(doc, nextY, needed, title);
    doc.text(lines, MARGIN, nextY);
    nextY += lines.length * 9 + 4;
  }

  return nextY;
}

function drawFooters(doc: jsPDF, input: PdfReportInput) {
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
    const right = input.exportedAt
      ? `${input.exportedAt} WIB  |  Halaman ${page} dari ${total}`
      : `Halaman ${page} dari ${total}`;
    doc.text(right, width - MARGIN, height - 17, { align: "right" });
  }
}

function columnStyles(
  columns: PdfColumn[],
  tableWidth: number,
): Record<string, { cellWidth: number; halign: PdfAlign }> {
  const weights = columns.map((column) => Math.max(0.2, column.width ?? 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  return Object.fromEntries(
    columns.map((column, index) => [
      String(index),
      {
        cellWidth: (weights[index] / totalWeight) * tableWidth,
        halign: column.align ?? "left",
      },
    ]),
  );
}

export function createReportPdf(input: PdfReportInput) {
  const doc = new jsPDF({
    orientation: input.orientation ?? "landscape",
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const { width } = pageSize(doc);
  const contentWidth = width - MARGIN * 2;
  const headedPages = new Set<number>([1]);
  let lastY = drawFirstHeader(doc, input);

  for (const table of input.tables) {
    lastY = ensureSpace(doc, lastY, table.title ? 58 : 44, input.title);

    if (table.title) {
      doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...INK);
      doc.text(clean(table.title), MARGIN, lastY);
      lastY += 14;
    }

    if (table.rows.length === 0) {
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
      doc.text("Tidak ada data pada periode ini.", MARGIN, lastY + 10);
      lastY += 24;
      continue;
    }

    const options: UserOptions = {
      head: [table.columns.map((column) => clean(column.header))],
      body: table.rows.map((row) => row.map(clean)),
      foot: table.totals ? [table.totals.map(clean)] : undefined,
      startY: lastY,
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
        fontSize: table.columns.length > 10 ? 6.2 : 7.2,
        cellPadding: 2.8,
        overflow: "linebreak",
        textColor: INK,
        lineColor: BORDER,
        lineWidth: 0.4,
        valign: "top",
      },
      headStyles: {
        fillColor: HEADER_BG,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        lineColor: HEADER_BG,
      },
      footStyles: {
        fillColor: TOTAL_BG,
        textColor: INK,
        fontStyle: "bold",
        lineColor: BORDER,
      },
      alternateRowStyles: { fillColor: ZEBRA },
      columnStyles: columnStyles(table.columns, contentWidth),
      didDrawPage: (data) => {
        if (data.pageNumber > 1 && !headedPages.has(data.pageNumber)) {
          drawSlimHeader(doc, input.title);
          headedPages.add(data.pageNumber);
        }
      },
    };

    autoTable(doc, options);
    const tableDoc = doc as jsPDF & {
      lastAutoTable?: { finalY?: number };
    };
    lastY = tableDoc.lastAutoTable?.finalY ?? lastY;

    if (table.notes?.length) {
      lastY = drawNotes(doc, table.notes, lastY + 12, input.title) + 8;
    } else {
      lastY += 16;
    }
  }

  drawFooters(doc, input);
  return doc;
}

export function pdfFileResponse(input: PdfReportInput) {
  const doc = createReportPdf(input);
  const bytes = Buffer.from(doc.output("arraybuffer"));

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${input.filename}"`,
      "Cache-Control": "no-store",
      "Content-Length": String(bytes.byteLength),
    },
  });
}
