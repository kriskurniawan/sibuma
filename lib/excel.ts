import "server-only";
import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import writeXlsxFile, {
  type CellObject,
  type Sheet,
  type SheetData,
} from "write-excel-file/node";
import { APP_TIMEZONE } from "./constants";

export type ExcelCellValue = string | number | Date | null;

export interface ExcelColumn {
  header: string;
  width?: number;
  align?: "left" | "center" | "right";
  type?: "text" | "number" | "date" | "datetime";
}

export interface ExcelSheetInput {
  /** Nama tab, maksimal 31 karakter. */
  name: string;
  title: string;
  subtitle?: string;
  columns: ExcelColumn[];
  rows: ExcelCellValue[][];
  totals?: ExcelCellValue[];
  notes?: string[];
}

const HEADER_FILL = "#1E293B";
const HEADER_TEXT = "#FFFFFF";
const BORDER_COLOR = "#E2E8F0";
const ZEBRA_FILL = "#F8FAFC";
const TOTAL_FILL = "#E2E8F0";
const MUTED_TEXT = "#64748B";
const TITLE_TEXT = "#0F172A";

/**
 * Tanggal tanpa zona waktu (yyyy-MM-dd) menjadi serial date Excel.
 * write-excel-file membaca komponen UTC dari Date, jadi tengah malam UTC
 * menghasilkan tanggal yang sama di spreadsheet.
 */
export function excelDate(value: string | null | undefined) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return new Date(`${date}T00:00:00.000Z`);
}

/**
 * Timestamp ISO menjadi tanggal + jam dinding WIB. Date dibentuk dari
 * komponen UTC agar Excel menampilkan jam yang sama dengan aplikasi.
 */
export function excelDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return null;
  const wallClock = formatInTimeZone(
    date,
    APP_TIMEZONE,
    "yyyy-MM-dd'T'HH:mm:ss",
  );
  return new Date(`${wallClock}Z`);
}

function buildCell(
  value: ExcelCellValue,
  column: ExcelColumn,
  zebra: boolean,
  total = false,
): CellObject {
  const isNumber = typeof value === "number";
  const isDate = value instanceof Date;
  const cell: CellObject = {
    value: value ?? "",
    fontSize: 10,
    alignVertical: "center",
    height: 18,
    borderColor: BORDER_COLOR,
    bottomBorderStyle: "hair",
  };

  if (column.align) cell.align = column.align;
  else if (isNumber || isDate) cell.align = "right";

  if (zebra) cell.backgroundColor = ZEBRA_FILL;
  if (total) {
    cell.fontWeight = "bold";
    cell.backgroundColor = TOTAL_FILL;
    cell.topBorderStyle = "thin";
    cell.topBorderColor = "#94A3B8";
  }
  if (isNumber) {
    cell.type = Number;
    if (column.type === "number") cell.format = "#,##0";
  }
  if (isDate) {
    cell.type = Date;
    cell.format =
      column.type === "datetime" ? "dd/mm/yyyy hh:mm" : "dd/mm/yyyy";
  }

  return cell;
}

export function buildExcelSheet(input: ExcelSheetInput): Sheet<Buffer> {
  const columnCount = input.columns.length;
  const data: SheetData = [
    [
      {
        value: input.title,
        columnSpan: columnCount,
        fontSize: 15,
        fontWeight: "bold",
        textColor: TITLE_TEXT,
        height: 26,
        alignVertical: "center",
      },
    ],
  ];

  if (input.subtitle) {
    data.push([
      {
        value: input.subtitle,
        columnSpan: columnCount,
        fontSize: 10,
        textColor: MUTED_TEXT,
        height: 18,
      },
    ]);
  } else {
    data.push([]);
  }

  data.push([]);
  data.push(
    input.columns.map((column) => ({
      value: column.header,
      fontWeight: "bold" as const,
      fontSize: 10,
      textColor: HEADER_TEXT,
      backgroundColor: HEADER_FILL,
      align: column.align ?? "left",
      alignVertical: "center" as const,
      height: 24,
    })),
  );

  input.rows.forEach((row, index) => {
    data.push(
      input.columns.map((column, columnIndex) =>
        buildCell(row[columnIndex] ?? null, column, index % 2 === 1),
      ),
    );
  });

  if (input.totals) {
    const totals = input.totals;
    data.push(
      input.columns.map((column, index) =>
        buildCell(totals[index] ?? null, column, false, true),
      ),
    );
  }

  if (input.notes?.length) {
    data.push([]);
    for (const note of input.notes) {
      data.push([
        {
          value: note,
          columnSpan: columnCount,
          fontSize: 9,
          textColor: MUTED_TEXT,
          height: 16,
        },
      ]);
    }
  }

  return {
    sheet: input.name,
    data,
    columns: input.columns.map((column) => ({ width: column.width ?? 16 })),
    stickyRowsCount: input.subtitle ? 4 : 3,
    showGridLines: false,
    orientation: columnCount >= 8 ? "landscape" : undefined,
  };
}

export async function excelFileResponse(input: {
  filename: string;
  sheets: ExcelSheetInput[];
}) {
  const buffer = await writeXlsxFile(input.sheets.map(buildExcelSheet), {
    fontFamily: "Calibri",
    fontSize: 10,
  }).toBuffer();

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${input.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
