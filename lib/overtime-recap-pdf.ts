import "server-only";

import { jsPDF } from "jspdf";
import autoTable, { type CellDef, type UserOptions } from "jspdf-autotable";
import {
  RECAP_DOCUMENT,
  recapDocumentHours,
  recapDocumentName,
  recapDocumentNominal,
  recapDocumentPeriod,
} from "./overtime-recap-document";
import type {
  OvertimeRecapPreview,
  OvertimeRecapSigners,
} from "./overtime-recap-types";

const MARGIN = 24;
const { colors, headers } = RECAP_DOCUMENT;

function drawTitle(doc: jsPDF, preview: OvertimeRecapPreview) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFont("times", "bold").setFontSize(10).setTextColor(colors.ink);
  doc.text(RECAP_DOCUMENT.title, width / 2, 34, { align: "center" });
  doc.setFontSize(9);
  doc.text(recapDocumentPeriod(preview.periodLabel), width / 2, 45, {
    align: "center",
  });
  return 68;
}

function drawSignatures(
  doc: jsPDF,
  signers: OvertimeRecapSigners,
  tableEndY: number,
) {
  const contentWidth = doc.internal.pageSize.getWidth() - MARGIN * 2;
  const height = doc.internal.pageSize.getHeight();
  let startY = tableEndY + 32;
  if (startY + 90 > height - MARGIN) {
    doc.addPage();
    startY = MARGIN + 10;
  }

  const names = [signers.buildingManagerName, signers.managerName];
  const centers = [0.13, 0.844];
  RECAP_DOCUMENT.signatures.forEach((signature, index) => {
    const centerX = MARGIN + contentWidth * centers[index];
    doc.setTextColor(colors.ink).setFont("times", "normal").setFontSize(8);
    doc.text(signature.introduction, centerX, startY, { align: "center" });
    doc.setFont("times", "bold");
    doc.text(signature.department, centerX, startY + 12, { align: "center" });

    const name = recapDocumentName(names[index]);
    const nameY = startY + 74;
    doc.setFont("times", "normal");
    if (name) {
      doc.text(name, centerX, nameY, { align: "center" });
      const nameWidth = doc.getTextWidth(name);
      doc.setDrawColor(colors.ink).setLineWidth(0.4);
      doc.line(centerX - nameWidth / 2, nameY + 1, centerX + nameWidth / 2, nameY + 1);
    }
    doc.setFont("times", "bold");
    doc.text(signature.role, centerX, nameY + 13, { align: "center" });
  });
}

export interface OvertimeRecapPdfInput {
  preview: OvertimeRecapPreview;
  signers: OvertimeRecapSigners;
}

export function createOvertimeRecapPdf(input: OvertimeRecapPdfInput) {
  const { preview } = input;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const contentWidth = doc.internal.pageSize.getWidth() - MARGIN * 2;
  const referenceWidth = RECAP_DOCUMENT.columnWidths.reduce<number>(
    (sum, width) => sum + width,
    0,
  );
  const startY = drawTitle(doc, preview);

  const head: CellDef[][] = [
    [
      { content: headers.no, rowSpan: 2 },
      { content: headers.name, rowSpan: 2 },
      { content: headers.jobTitle, rowSpan: 2 },
      { content: headers.basicSalary, rowSpan: 2 },
      { content: headers.hourlyRate, rowSpan: 2 },
      { content: headers.days, colSpan: 2 },
      { content: headers.hours, colSpan: 2 },
      { content: headers.pay, colSpan: 2 },
      { content: headers.totalPay, rowSpan: 2 },
      { content: headers.remarks, rowSpan: 2 },
    ],
    [
      { content: headers.hk },
      { content: headers.hl },
      { content: headers.hk },
      { content: headers.hl },
      { content: headers.hkPay },
      { content: headers.hlPay },
    ],
  ];

  const body = preview.rows.map((row, index) => [
    index + 1,
    recapDocumentName(row.name),
    recapDocumentName(row.jobTitle ?? ""),
    recapDocumentNominal(row.basicSalary),
    recapDocumentNominal(row.hourlyRate),
    row.hkDays || "",
    row.hlDays || "",
    recapDocumentHours(row.hkMinutes, true),
    recapDocumentHours(row.hlMinutes, true),
    recapDocumentNominal(row.hkPay),
    recapDocumentNominal(row.hlPay),
    recapDocumentNominal(row.totalPay),
    recapDocumentHours(row.hkMinutes + row.hlMinutes),
  ]);

  const columnStyles: UserOptions["columnStyles"] = Object.fromEntries(
    RECAP_DOCUMENT.columnWidths.map((width, index) => [
      index,
      {
        cellWidth: (width / referenceWidth) * contentWidth,
        halign:
          index === 1
            ? "left"
            : index === 0 || index === 2 || (index >= 5 && index <= 8)
              ? "center"
              : "right",
      },
    ]),
  );

  autoTable(doc, {
    head,
    body,
    startY,
    margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
    tableWidth: contentWidth,
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "times",
      fontSize: 8,
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
      overflow: "linebreak",
      textColor: colors.ink,
      lineColor: colors.ink,
      lineWidth: 0.5,
      valign: "middle",
    },
    headStyles: {
      fillColor: colors.header,
      textColor: colors.ink,
      fontStyle: "bold",
      halign: "center",
      lineColor: colors.ink,
      fontSize: 7.5,
    },
    bodyStyles: { minCellHeight: 23 },
    columnStyles,
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index === 5 || data.column.index === 7) {
        data.cell.styles.fillColor = colors.hk;
      } else if (data.column.index === 6 || data.column.index === 8) {
        data.cell.styles.fillColor = colors.hl;
      } else if (data.column.index === 11) {
        data.cell.styles.fillColor = colors.total;
      }
    },
  });

  const tableDoc = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
  drawSignatures(doc, input.signers, tableDoc.lastAutoTable?.finalY ?? startY);
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
