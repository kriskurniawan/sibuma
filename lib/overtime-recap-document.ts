/** Format dokumen resmi mengikuti contoh, terpisah dari format panel aplikasi. */
export const RECAP_DOCUMENT = {
  title: "REKAPITULASI LEMBUR",
  headers: {
    no: "NO",
    name: "NAMA",
    jobTitle: "JABATAN",
    basicSalary: "BASIC SALARY",
    hourlyRate: "TARIF\nLEMBUR\nPERJAM",
    days: "JML HARI",
    hours: "JML JAM",
    pay: "JUMLAH LEMBUR (RP)",
    totalPay: "TOTAL\nLEMBUR (RP)",
    remarks: "KET",
    hk: "HK",
    hl: "HL",
    hkPay: "HARI KERJA",
    hlPay: "HARI LIBUR",
  },
  colors: {
    ink: "#000000",
    header: "#C9C9C9",
    hk: "#FCE4D6",
    hl: "#5B9BD5",
    total: "#FFFF00",
  },
  // Proporsi 13 kolom pada gambar acuan, dari NO sampai KET.
  columnWidths: [28, 184, 111, 84, 87, 37, 37, 37, 37, 77, 86, 79, 52],
  signatures: [
    {
      introduction: "Diketahui Oleh,",
      department: "BUILDING MANAGEMENT",
      role: "BUILDING MANAGER",
    },
    {
      introduction: "Disetujui Oleh,",
      department: "UNIT MANAJEMEN INTERN",
      role: "MANAGER",
    },
  ],
} as const;

const nominalFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const hoursFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  useGrouping: false,
});

export function recapDocumentPeriod(periodLabel: string) {
  const period = periodLabel
    .replace(/[\u2013\u2014-]/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("id-ID");
  return `PERIODE : ${period}`;
}

export function recapDocumentFileName(
  from: string,
  to: string,
  format: "pdf" | "xlsx",
) {
  return `rekapitulasi-lembur-${from}_${to}.${format}`;
}

/** Satuan RP hanya di header, bukan di setiap nominal. Nol tampil sebagai '-'. */
export function recapDocumentNominal(value: number | null | undefined) {
  const rounded = Math.round(Math.max(0, value ?? 0));
  return Number.isFinite(rounded) && rounded > 0
    ? nominalFormat.format(rounded)
    : "-";
}

/** KET dan jumlah jam berupa angka saja. Kolom HK/HL kosong bila nol. */
export function recapDocumentHours(minutes: number, blankZero = false) {
  if (blankZero && minutes === 0) return "";
  return hoursFormat.format(Math.max(0, minutes) / 60);
}

export function recapDocumentName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleUpperCase("id-ID");
}
