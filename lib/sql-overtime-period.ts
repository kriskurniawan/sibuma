import "server-only";

import { getActiveOvertimePeriodStartDay } from "./active-overtime-period";
import { getActiveTimeZone } from "./active-time-zone";
import { overtimePeriodRange } from "./overtime-period";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Batas periode akumulasi lembur sebagai literal SQL. Tanggal dibentuk dari
 * angka tahun/bulan/hari, bukan input pengguna, dan divalidasi sebelum dipakai.
 */
export function sqlOvertimePeriod() {
  const range = overtimePeriodRange(
    new Date(),
    getActiveOvertimePeriodStartDay(),
    getActiveTimeZone(),
  );
  if (!DATE_PATTERN.test(range.from) || !DATE_PATTERN.test(range.to)) {
    throw new Error("Periode akumulasi lembur tidak valid.");
  }
  return {
    ...range,
    fromSql: `'${range.from}'`,
    toSql: `'${range.to}'`,
  };
}
