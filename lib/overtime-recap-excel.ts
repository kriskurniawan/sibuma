import "server-only";

import writeXlsxFile, {
  type CellObject,
  type Sheet,
  type SheetData,
} from "write-excel-file/node";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  RECAP_DOCUMENT,
  recapDocumentName,
  recapDocumentPeriod,
} from "./overtime-recap-document";
import type {
  OvertimeRecapPreview,
  OvertimeRecapSigners,
} from "./overtime-recap-types";

const { colors, headers } = RECAP_DOCUMENT;
const AMOUNT_FORMAT = '0;-0;"-"';
const DAYS_FORMAT = "0;-0;;@";
// General tidak meninggalkan tanda desimal pada jam bulat (misalnya '5,').
const HOURS_FORMAT = "General;General;;@";
const KET_FORMAT = "General";

function emptyRow(): SheetData[number] {
  return Array.from({ length: 13 }, () => null);
}

function tableCell(
  value: string | number,
  type: CellObject["type"],
  options: Partial<CellObject> = {},
): CellObject {
  return {
    value,
    type,
    fontSize: 8,
    textColor: colors.ink,
    borderColor: colors.ink,
    borderStyle: "thin",
    alignVertical: "center",
    ...options,
  };
}

function numberCell(
  value: number,
  format: string,
  options: Partial<CellObject> = {},
) {
  return tableCell(value, Number, { format, align: "right", ...options });
}

function formulaCell(
  value: string,
  format: string,
  options: Partial<CellObject> = {},
) {
  return tableCell(value, "Formula", { format, align: "right", ...options });
}

function headerCells(): SheetData {
  const top = emptyRow();
  const bottom = emptyRow();
  const columns = [
    { index: 0, label: headers.no },
    { index: 1, label: headers.name },
    { index: 2, label: headers.jobTitle },
    { index: 3, label: headers.basicSalary },
    { index: 4, label: headers.hourlyRate },
    { index: 5, label: headers.days, columnSpan: 2 },
    { index: 7, label: headers.hours, columnSpan: 2 },
    { index: 9, label: headers.pay, columnSpan: 2 },
    { index: 11, label: headers.totalPay },
    { index: 12, label: headers.remarks },
  ];
  for (const column of columns) {
    top[column.index] = tableCell(column.label, String, {
      ...(column.columnSpan ? { columnSpan: column.columnSpan } : { rowSpan: 2 }),
      fontWeight: "bold",
      align: "center",
      backgroundColor: colors.header,
      wrap: true,
      height: 22,
    });
  }
  const labels = [
    headers.hk,
    headers.hl,
    headers.hk,
    headers.hl,
    headers.hkPay,
    headers.hlPay,
  ];
  labels.forEach((label, index) => {
    bottom[5 + index] = tableCell(label, String, {
      fontWeight: "bold",
      align: "center",
      backgroundColor: colors.header,
      height: 22,
    });
  });
  return [top, bottom];
}

function signatureRows(signers: OvertimeRecapSigners): SheetData {
  const rows: SheetData = [];
  const names = [signers.buildingManagerName, signers.managerName];
  const positions = [
    { column: 1, span: 1 },
    { column: 9, span: 4 },
  ];
  const addRow = (
    values: readonly string[],
    options: Partial<CellObject> = {},
  ) => {
    const row = emptyRow();
    positions.forEach((position, index) => {
      row[position.column] = {
        value: values[index],
        type: String,
        columnSpan: position.span,
        fontSize: 8,
        textColor: colors.ink,
        align: "center",
        alignVertical: "center",
        height: 14,
        ...options,
      };
    });
    rows.push(row);
  };

  addRow(RECAP_DOCUMENT.signatures.map((signature) => signature.introduction));
  addRow(RECAP_DOCUMENT.signatures.map((signature) => signature.department), {
    fontWeight: "bold",
  });
  const space = emptyRow();
  space[0] = { value: "", height: 48 };
  rows.push(space);
  addRow(names.map(recapDocumentName), { textDecoration: { underline: true } });
  addRow(RECAP_DOCUMENT.signatures.map((signature) => signature.role), {
    fontWeight: "bold",
  });
  return rows;
}

export interface OvertimeRecapExcelInput {
  preview: OvertimeRecapPreview;
  signers: OvertimeRecapSigners;
}

export function buildOvertimeRecapSheet(
  input: OvertimeRecapExcelInput,
): Sheet<Buffer> {
  const { preview } = input;
  const data: SheetData = [];
  const title = emptyRow();
  title[0] = {
    value: `${RECAP_DOCUMENT.title}\n${recapDocumentPeriod(preview.periodLabel)}`,
    type: String,
    columnSpan: 13,
    fontSize: 8,
    fontWeight: "bold",
    textColor: colors.ink,
    align: "center",
    alignVertical: "center",
    wrap: true,
    height: 26,
  };
  const titleGap = emptyRow();
  titleGap[0] = { value: "", height: 20 };
  data.push(title, titleGap, ...headerCells());

  const firstDataRow = data.length + 1;
  preview.rows.forEach((row, index) => {
    const excelRow = firstDataRow + index;
    data.push([
      numberCell(index + 1, "0", { align: "center", height: 20.25 }),
      tableCell(recapDocumentName(row.name), String, { wrap: true }),
      tableCell(recapDocumentName(row.jobTitle ?? ""), String, {
        align: "center",
        wrap: true,
      }),
      numberCell(row.basicSalary ?? 0, AMOUNT_FORMAT),
      formulaCell(`=D${excelRow}/173`, AMOUNT_FORMAT),
      numberCell(row.hkDays, DAYS_FORMAT, {
        align: "center",
        backgroundColor: colors.hk,
      }),
      numberCell(row.hlDays, DAYS_FORMAT, {
        align: "center",
        backgroundColor: colors.hl,
      }),
      numberCell(row.hkMinutes / 60, HOURS_FORMAT, {
        align: "center",
        backgroundColor: colors.hk,
      }),
      numberCell(row.hlMinutes / 60, HOURS_FORMAT, {
        align: "center",
        backgroundColor: colors.hl,
      }),
      formulaCell(`=E${excelRow}*H${excelRow}*1.5`, AMOUNT_FORMAT),
      formulaCell(`=E${excelRow}*I${excelRow}*2`, AMOUNT_FORMAT),
      formulaCell(`=SUM(J${excelRow}:K${excelRow})`, AMOUNT_FORMAT, {
        backgroundColor: colors.total,
      }),
      formulaCell(`=H${excelRow}+I${excelRow}`, KET_FORMAT),
    ]);
  });

  // Contoh resmi langsung diikuti tanda tangan, tanpa baris TOTAL tambahan.
  const signatureGap = emptyRow();
  signatureGap[0] = { value: "", height: 24 };
  data.push(signatureGap, ...signatureRows(input.signers));

  return {
    sheet: "Rekapitulasi Lembur",
    data,
    columns: RECAP_DOCUMENT.columnWidths.map((width) => ({ width: width / 5.5 })),
    stickyRowsCount: 4,
    showGridLines: false,
    orientation: "landscape",
  };
}

/**
 * Koma bawaan format '#,##0' mengikuti locale Excel pengguna. Format bersyarat
 * dengan koma literal mempertahankan format contoh tanpa mengubah nilai/rumus.
 * Batas desimal mencegah nominal yang dibulatkan naik kehilangan grup ribuan.
 */
function literalGroupingFormats() {
  return Array.from({ length: 5 }, (_, index) => {
    const groups = index + 1;
    return {
      threshold: 10 ** (groups * 3) - 0.5,
      code: `#${'","000'.repeat(groups)}`,
    };
  });
}

function applyDocumentNumberFormats(buffer: Buffer, rowCount: number) {
  const files = unzipSync(buffer);
  let styles = strFromU8(files["xl/styles.xml"]);
  let sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
  const formats = literalGroupingFormats();
  const existingIds = [...styles.matchAll(/numFmtId="(\d+)"/g)].map((match) => Number(match[1]));
  const firstId = Math.max(163, ...existingIds) + 1;
  const numberFormats = formats.map((format, index) =>
    `<numFmt numFmtId="${firstId + index}" formatCode="${format.code.replaceAll('"', "&quot;")}"/>`,
  );
  if (styles.includes("</numFmts>")) {
    styles = styles.replace(/<numFmts count="(\d+)">/, (_, count) =>
      `<numFmts count="${Number(count) + formats.length}">`,
    ).replace("</numFmts>", `${numberFormats.join("")}</numFmts>`);
  } else {
    styles = styles.replace("<fonts", `<numFmts count="${formats.length}">${numberFormats.join("")}</numFmts><fonts`);
  }
  const differentialStyles = formats.map((_, index) =>
    `<dxf>${numberFormats[index]}</dxf>`,
  ).join("");
  styles = styles.replace("</styleSheet>", `<dxfs count="${formats.length}">${differentialStyles}</dxfs></styleSheet>`);

  if (rowCount > 0) {
    const lastRow = 4 + rowCount;
    const rules = formats.map((format, index) =>
      `<cfRule type="cellIs" dxfId="${index}" priority="${formats.length - index}" stopIfTrue="1" operator="greaterThanOrEqual"><formula>${format.threshold}</formula></cfRule>`,
    ).reverse().join("");
    sheet = sheet.replace("<pageMargins", `<conditionalFormatting sqref="D5:E${lastRow} J5:L${lastRow}">${rules}</conditionalFormatting><pageMargins`);
  }
  // Seluruh tabel harus muat pada lebar satu halaman saat dicetak dari Excel.
  sheet = sheet.replace(/(<worksheet\b[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
  sheet = sheet.replace("<pageSetup ", '<pageSetup fitToWidth="1" fitToHeight="0" ');
  files["xl/styles.xml"] = strToU8(styles);
  files["xl/worksheets/sheet1.xml"] = strToU8(sheet);
  return zipSync(files);
}

export async function overtimeRecapExcelResponse(
  input: OvertimeRecapExcelInput,
) {
  const buffer = await writeXlsxFile([buildOvertimeRecapSheet(input)], {
    fontFamily: "Times New Roman",
    fontSize: 8,
  }).toBuffer();
  const file = applyDocumentNumberFormats(buffer, input.preview.rows.length);

  return new Response(file, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rekapitulasi-lembur-${input.preview.month}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
