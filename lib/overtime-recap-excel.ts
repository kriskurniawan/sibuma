import "server-only";

import writeXlsxFile, {
  type CellObject,
  type Sheet,
  type SheetData,
} from "write-excel-file/node";
import type {
  OvertimeRecapPreview,
  OvertimeRecapSigners,
} from "./overtime-recap-types";

const HEADER_BG = "#E2E8F0";
const HK_BG = "#FEF3C7";
const HL_BG = "#DBEAFE";
const TOTAL_BG = "#FDE047";
const GRAND_TOTAL_BG = "#FEF9C3";
const BORDER_COLOR = "#94A3B8";
const MUTED_TEXT = "#64748B";
const INK_TEXT = "#1E293B";

const COLUMN_WIDTHS = [5, 30, 22, 15, 16, 8, 8, 9, 9, 14, 14, 17, 12];

const RUPIAH_FORMAT = '#,##0';
const HOURS_FORMAT = '#,##0.##';
const KET_FORMAT = '#,##0.##" jam"';

function emptyRow(): SheetData[number] {
  return Array.from({ length: 13 }, () => null);
}

function textCell(
  value: string,
  options: Partial<CellObject> = {},
): CellObject {
  return {
    value,
    type: String,
    fontSize: 10,
    textColor: INK_TEXT,
    borderColor: BORDER_COLOR,
    borderStyle: "thin",
    alignVertical: "center",
    ...options,
  };
}

function numberCell(
  value: number,
  format: string,
  options: Partial<CellObject> = {},
): CellObject {
  return {
    value,
    type: Number,
    format,
    fontSize: 10,
    textColor: INK_TEXT,
    borderColor: BORDER_COLOR,
    borderStyle: "thin",
    align: "right",
    alignVertical: "center",
    ...options,
  };
}

function formulaCell(
  value: string,
  format: string,
  options: Partial<CellObject> = {},
): CellObject {
  return {
    value,
    type: "Formula",
    format,
    fontSize: 10,
    textColor: INK_TEXT,
    borderColor: BORDER_COLOR,
    borderStyle: "thin",
    align: "right",
    alignVertical: "center",
    ...options,
  };
}

function mergedCell(
  value: string,
  columnSpan: number,
  options: Partial<CellObject> = {},
): CellObject {
  return {
    value,
    columnSpan,
    fontSize: 10,
    textColor: INK_TEXT,
    alignVertical: "center",
    ...options,
  };
}

function headerCells(): SheetData {
  const top = emptyRow();
  top[0] = textCell("No", {
    rowSpan: 2,
    fontWeight: "bold",
    align: "center",
    backgroundColor: HEADER_BG,
    height: 28,
  });
  top[1] = textCell("Nama", {
    rowSpan: 2,
    fontWeight: "bold",
    align: "center",
    backgroundColor: HEADER_BG,
  });
  top[2] = textCell("Jabatan", {
    rowSpan: 2,
    fontWeight: "bold",
    align: "center",
    backgroundColor: HEADER_BG,
  });
  top[3] = textCell("Basic Salary", {
    rowSpan: 2,
    fontWeight: "bold",
    align: "center",
    backgroundColor: HEADER_BG,
    wrap: true,
  });
  top[4] = textCell("Tarif Lembur per Jam", {
    rowSpan: 2,
    fontWeight: "bold",
    align: "center",
    backgroundColor: HEADER_BG,
    wrap: true,
  });
  top[5] = textCell("Jumlah Hari", {
    columnSpan: 2,
    fontWeight: "bold",
    align: "center",
    backgroundColor: HEADER_BG,
    height: 24,
  });
  top[6] = null;
  top[7] = textCell("Jumlah Jam", {
    columnSpan: 2,
    fontWeight: "bold",
    align: "center",
    backgroundColor: HEADER_BG,
  });
  top[8] = null;
  top[9] = textCell("Jumlah Lembur", {
    columnSpan: 2,
    fontWeight: "bold",
    align: "center",
    backgroundColor: HEADER_BG,
  });
  top[10] = null;
  top[11] = textCell("Total Lembur", {
    rowSpan: 2,
    fontWeight: "bold",
    align: "center",
    backgroundColor: TOTAL_BG,
    wrap: true,
  });
  top[12] = textCell("KET", {
    rowSpan: 2,
    fontWeight: "bold",
    align: "center",
    backgroundColor: HEADER_BG,
    wrap: true,
  });

  const bottom = emptyRow();
  bottom[5] = textCell("HK", {
    fontWeight: "bold",
    align: "center",
    backgroundColor: HK_BG,
  });
  bottom[6] = textCell("HL", {
    fontWeight: "bold",
    align: "center",
    backgroundColor: HL_BG,
  });
  bottom[7] = textCell("HK", {
    fontWeight: "bold",
    align: "center",
    backgroundColor: HK_BG,
  });
  bottom[8] = textCell("HL", {
    fontWeight: "bold",
    align: "center",
    backgroundColor: HL_BG,
  });
  bottom[9] = textCell("Hari Kerja", {
    fontWeight: "bold",
    align: "center",
    backgroundColor: HK_BG,
  });
  bottom[10] = textCell("Hari Libur", {
    fontWeight: "bold",
    align: "center",
    backgroundColor: HL_BG,
  });

  return [top, bottom];
}

function signatureRows(
  signers: OvertimeRecapSigners,
): SheetData {
  const labels = emptyRow();
  labels[1] = mergedCell("Building Manager,", 4, {
    align: "center",
    fontSize: 10,
    height: 22,
  });
  labels[7] = mergedCell("Manager,", 4, {
    align: "center",
    fontSize: 10,
  });

  const spacer = emptyRow();
  spacer[1] = { value: "", height: 24 };

  const names = emptyRow();
  names[1] = mergedCell(
    `( ${signers.buildingManagerName.trim() || "............................"} )`,
    4,
    {
      align: "center",
      fontWeight: "bold",
      fontSize: 10,
      height: 30,
    },
  );
  names[7] = mergedCell(
    `( ${signers.managerName.trim() || "............................"} )`,
    4,
    {
      align: "center",
      fontWeight: "bold",
      fontSize: 10,
    },
  );

  return [labels, spacer, names];
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

  data.push([
    mergedCell("REKAPITULASI LEMBUR", 13, {
      fontSize: 15,
      fontWeight: "bold",
      align: "center",
      height: 30,
    }),
    ...Array.from({ length: 12 }, () => null),
  ]);
  data.push([
    mergedCell(
      `Periode: ${preview.periodLabel}`,
      13,
      {
        fontSize: 10,
        textColor: MUTED_TEXT,
        align: "center",
        height: 20,
      },
    ),
    ...Array.from({ length: 12 }, () => null),
  ]);
  data.push(emptyRow());
  data.push(...headerCells());

  const firstDataRow = 6;
  preview.rows.forEach((row, index) => {
    const excelRow = firstDataRow + index;
    const cells = emptyRow();
    cells[0] = numberCell(index + 1, "0", { align: "center" });
    cells[1] = textCell(row.name, { wrap: true });
    cells[2] = textCell(row.jobTitle ?? "-", { wrap: true });
    cells[3] = numberCell(row.basicSalary ?? 0, RUPIAH_FORMAT);
    cells[4] = formulaCell(`=D${excelRow}/173`, RUPIAH_FORMAT);
    cells[5] = numberCell(row.hkDays, "0", { align: "center" });
    cells[6] = numberCell(row.hlDays, "0", { align: "center" });
    cells[7] = numberCell(row.hkMinutes / 60, HOURS_FORMAT);
    cells[8] = numberCell(row.hlMinutes / 60, HOURS_FORMAT);
    cells[9] = formulaCell(`=E${excelRow}*H${excelRow}*1.5`, RUPIAH_FORMAT);
    cells[10] = formulaCell(`=E${excelRow}*I${excelRow}*2`, RUPIAH_FORMAT);
    cells[11] = formulaCell(
      `=J${excelRow}+K${excelRow}`,
      RUPIAH_FORMAT,
      { backgroundColor: GRAND_TOTAL_BG },
    );
    cells[12] = formulaCell(`=H${excelRow}+I${excelRow}`, KET_FORMAT, {
      align: "right",
    });
    data.push(cells);
  });

  const lastDataRow = firstDataRow + preview.rows.length - 1;
  const total = emptyRow();
  total[0] = mergedCell("TOTAL", 5, {
    fontWeight: "bold",
    align: "left",
    backgroundColor: GRAND_TOTAL_BG,
    height: 22,
  });
  total[5] = formulaCell(`=SUM(F${firstDataRow}:F${lastDataRow})`, "0", {
    fontWeight: "bold",
    align: "center",
    backgroundColor: GRAND_TOTAL_BG,
  });
  total[6] = formulaCell(`=SUM(G${firstDataRow}:G${lastDataRow})`, "0", {
    fontWeight: "bold",
    align: "center",
    backgroundColor: GRAND_TOTAL_BG,
  });
  total[7] = formulaCell(
    `=SUM(H${firstDataRow}:H${lastDataRow})`,
    HOURS_FORMAT,
    { fontWeight: "bold", backgroundColor: GRAND_TOTAL_BG },
  );
  total[8] = formulaCell(
    `=SUM(I${firstDataRow}:I${lastDataRow})`,
    HOURS_FORMAT,
    { fontWeight: "bold", backgroundColor: GRAND_TOTAL_BG },
  );
  total[9] = formulaCell(
    `=SUM(J${firstDataRow}:J${lastDataRow})`,
    RUPIAH_FORMAT,
    { fontWeight: "bold", backgroundColor: GRAND_TOTAL_BG },
  );
  total[10] = formulaCell(
    `=SUM(K${firstDataRow}:K${lastDataRow})`,
    RUPIAH_FORMAT,
    { fontWeight: "bold", backgroundColor: GRAND_TOTAL_BG },
  );
  total[11] = formulaCell(
    `=SUM(L${firstDataRow}:L${lastDataRow})`,
    RUPIAH_FORMAT,
    { fontWeight: "bold", backgroundColor: TOTAL_BG },
  );
  total[12] = formulaCell(
    `=SUM(M${firstDataRow}:M${lastDataRow})`,
    KET_FORMAT,
    { fontWeight: "bold", backgroundColor: TOTAL_BG },
  );
  data.push(total);

  data.push(emptyRow(), ...signatureRows(input.signers));

  return {
    sheet: "Rekapitulasi Lembur",
    data,
    columns: COLUMN_WIDTHS.map((width) => ({ width })),
    stickyRowsCount: 5,
    showGridLines: false,
    orientation: "landscape",
  };
}

export async function overtimeRecapExcelResponse(
  input: OvertimeRecapExcelInput,
) {
  const buffer = await writeXlsxFile([buildOvertimeRecapSheet(input)], {
    fontFamily: "Calibri",
    fontSize: 10,
  }).toBuffer();

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rekapitulasi-lembur-${input.preview.month}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
