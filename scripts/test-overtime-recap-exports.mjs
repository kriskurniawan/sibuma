import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { unzipSync, strFromU8 } from "fflate";
import { createOvertimeRecapPdf } from "../lib/overtime-recap-pdf.ts";
import {
  buildOvertimeRecapSheet,
  overtimeRecapExcelResponse,
} from "../lib/overtime-recap-excel.ts";
import {
  RECAP_DOCUMENT,
  recapDocumentHours,
  recapDocumentNominal,
} from "../lib/overtime-recap-document.ts";
import { isRecapHoliday } from "../lib/overtime-recap-days.ts";

function fixture(rowCount = 5) {
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const hkMinutes = index === 0 || index === 3 ? 180 : 0;
    const hlMinutes = [600, 1080, 1260, 1560, 780][index % 5];
    const hourlyRate = 3_841_000 / 173;
    const hkPay = (hkMinutes / 60) * hourlyRate * 1.5;
    const hlPay = (hlMinutes / 60) * hourlyRate * 2;
    return {
      employeeId: `fixture-${index}`,
      name: `Pekerja Contoh ${index + 1}`,
      jobTitle: "Teknisi Contoh",
      basicSalary: 3_841_000,
      hourlyRate,
      hkDays: hkMinutes ? 1 : 0,
      hlDays: [2, 3, 3, 4, 2][index % 5],
      hkMinutes,
      hlMinutes,
      hkPay,
      hlPay,
      totalPay: hkPay + hlPay,
    };
  });
  return {
    owner: { id: "fixture-owner", name: "TIM TIDAK BOLEH DICETAK", active: true },
    from: "2026-10-01",
    to: "2026-10-31",
    periodLabel: "1–31 Oktober 2026",
    rows,
    totals: {
      employees: rows.length,
      hkDays: 0,
      hlDays: 0,
      hkMinutes: 0,
      hlMinutes: 0,
      totalPay: 0,
    },
    signers: { buildingManagerName: "Penandatangan A", managerName: "Penandatangan B" },
    canManageSigners: true,
    blockers: [],
    missingPayroll: [],
    holidayYearAvailable: true,
    generatedAt: "2026-11-05T00:00:00.000Z",
  };
}

function pdfText(buffer) {
  const streams = buffer.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g);
  const texts = [];
  for (const stream of streams) {
    let content;
    try {
      content = inflateSync(Buffer.from(stream[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    for (const token of content.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
      texts.push(token[1].replace(/\\([()\\])/g, "$1"));
    }
  }
  return texts;
}

const holidayDates = new Set(["2026-11-09"]);
assert.equal(isRecapHoliday("2026-11-07", holidayDates), true, "Sabtu dihitung HL");
assert.equal(isRecapHoliday("2026-11-08", holidayDates), true, "Minggu dihitung HL");
assert.equal(isRecapHoliday("2026-11-09", holidayDates), true, "Libur nasional dihitung HL");
assert.equal(isRecapHoliday("2026-11-06", holidayDates), false, "Jumat dihitung HK");

const preview = fixture();
const input = { preview, signers: preview.signers };
const doc = createOvertimeRecapPdf(input);
const pdf = Buffer.from(doc.output("arraybuffer"));
const text = pdfText(pdf);
assert.equal(doc.getNumberOfPages(), 1);
for (const value of [
  "REKAPITULASI LEMBUR", "PERIODE : 1 - 31 OKTOBER 2026",
  "3,841,000", "22,202", "543,957", "13", "-",
  "JUMLAH LEMBUR (RP)", "Diketahui Oleh,", "Disetujui Oleh,",
  "BUILDING MANAGEMENT", "UNIT MANAJEMEN INTERN",
  "PENANDATANGAN A", "PENANDATANGAN B", "BUILDING MANAGER", "MANAGER",
]) assert(text.includes(value), `Teks PDF hilang: ${value}`);
assert.equal(text.filter((value) => value === "TOTAL").length, 1, "TOTAL hanya ada pada header kolom, tanpa baris tambahan.");
assert(!/Rp|\bjam\b|SIBUMA|Tim:|Diekspor|TIM TIDAK BOLEH/.test(text.join(" ")));
assert.equal(recapDocumentNominal(0), "-");
assert.equal(recapDocumentHours(300), "5");
assert.equal(recapDocumentHours(75), "1.25");
assert.equal(recapDocumentHours(0, true), "");

const sheet = buildOvertimeRecapSheet(input);
const first = sheet.data[4];
const second = sheet.data[5];
assert.equal(sheet.data[0][0].value, "REKAPITULASI LEMBUR\nPERIODE : 1 - 31 OKTOBER 2026");
assert.equal(first[3].value, 3_841_000);
assert.equal(first[4].value, "=D5/173");
assert.equal(first[9].value, "=E5*H5*1.5");
assert.equal(first[10].value, "=E5*I5*2");
assert.equal(first[11].value, "=SUM(J5:K5)");
assert.equal(first[12].value, "=H5+I5");
assert.equal(first[12].format, "General");
assert.equal(first[7].value, 3);
assert.equal(second[7].value, 0);
for (const index of [5, 7]) assert.equal(first[index].backgroundColor, RECAP_DOCUMENT.colors.hk);
for (const index of [6, 8]) assert.equal(first[index].backgroundColor, RECAP_DOCUMENT.colors.hl);
assert.equal(first[11].backgroundColor, RECAP_DOCUMENT.colors.total);
assert.equal(first[12].backgroundColor, undefined);
assert.equal(sheet.data[2][11].backgroundColor, RECAP_DOCUMENT.colors.header);
assert.equal(sheet.stickyRowsCount, 4);
const cells = sheet.data.flat().filter((cell) => cell && typeof cell === "object");
assert(!cells.some((cell) => cell.value === "TOTAL"));
assert(!cells.some((cell) => typeof cell.value === "string" && /Rp|\bjam\b|SIBUMA|Tim:|Diekspor|TIM TIDAK BOLEH/.test(cell.value)));
assert(!cells.some((cell) => cell.format?.includes('" jam"')));

const response = await overtimeRecapExcelResponse(input);
const xlsx = Buffer.from(await response.arrayBuffer());
const zip = unzipSync(xlsx);
const xml = strFromU8(zip["xl/worksheets/sheet1.xml"]);
const styles = strFromU8(zip["xl/styles.xml"]);
assert(xml.includes('orientation="landscape"'));
assert(xml.includes('paperSize="9"'));
assert(xml.includes("<f>=D5/173</f>"));
assert(xml.includes("<f>=H5+I5</f>"));
assert(styles.includes("Times New Roman"));
assert(!styles.includes(" jam"));
assert(styles.includes('#&quot;,&quot;000'));
assert(styles.includes('<dxfs count="5">'));
assert(xml.includes('sqref="D5:E9 J5:L9"'));
assert(xml.includes('fitToWidth="1"'));

const largePreview = fixture(60);
const largeDoc = createOvertimeRecapPdf({ preview: largePreview, signers: largePreview.signers });
assert(largeDoc.getNumberOfPages() > 1);
assert(pdfText(Buffer.from(largeDoc.output("arraybuffer"))).includes("PENANDATANGAN B"));
console.log("PASS: klasifikasi Sabtu/Minggu/libur sebagai HL, format PDF, sel/formula/warna XLSX, tanpa tambahan, dan PDF multi-halaman.");

if (process.argv.includes("--render")) {
  const base = path.join(process.env.LOCALAPPDATA, "Temp", "opencode");
  const directory = await mkdtemp(path.join(base, "recap-export-"));
  await writeFile(path.join(directory, "recap.pdf"), pdf);
  await writeFile(path.join(directory, "recap.xlsx"), xlsx);
  console.log(`RENDER_DIR=${directory}`);
}
