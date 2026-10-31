import { formatDateHuman } from "./time";
import { getActiveTimeZone } from "./active-time-zone";

export interface OvertimePeriodRange {
  /** Tanggal awal periode, inklusif (yyyy-MM-dd). */
  from: string;
  /** Tanggal akhir periode, inklusif (yyyy-MM-dd). */
  to: string;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Tanggal `day` pada bulan tertentu, dijepit ke akhir bulan bila lebih pendek. */
function monthDay(year: number, monthIndex: number, day: number) {
  const base = new Date(Date.UTC(year, monthIndex, 1));
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const clamped = Math.min(Math.max(1, Math.trunc(day)), daysInMonth(y, m));
  return `${y}-${pad(m + 1)}-${pad(clamped)}`;
}

function shiftDay(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
}

/**
 * Rentang akumulasi lembur yang memuat `now`.
 *
 * `startDay = 1` berarti bulan kalender. `startDay = 26` berarti periode
 * 26 bulan lalu sampai 25 bulan berjalan. Tanggal yang melebihi panjang bulan
 * dijepit (mis. 31 menjadi 28/29 di Februari).
 */
export function overtimePeriodRange(
  now: Date = new Date(),
  startDay = 1,
  timeZone = getActiveTimeZone(),
): OvertimePeriodRange {
  const today = formatDateHuman(now.toISOString(), "yyyy-MM-dd", timeZone);
  const [year, month, day] = today.split("-").map(Number);
  const safeStartDay = Number.isFinite(startDay)
    ? Math.min(31, Math.max(1, Math.trunc(startDay)))
    : 1;
  const currentStartDay = Math.min(
    safeStartDay,
    daysInMonth(year, month - 1),
  );

  let startYear = year;
  let startMonth = month - 1;
  if (day < currentStartDay) {
    startMonth -= 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }

  const from = monthDay(startYear, startMonth, safeStartDay);
  const next = monthDay(startYear, startMonth + 1, safeStartDay);
  return { from, to: shiftDay(next, -1) };
}

/** Label ringkas, mis. "26 Okt – 25 Nov 2026" atau "Oktober 2026". */
export function overtimePeriodLabel(
  range: OvertimePeriodRange = overtimePeriodRange(),
  timeZone = getActiveTimeZone(),
) {
  const [year, month] = range.to.split("-").map(Number);
  const lastDay = daysInMonth(year, month - 1);
  if (range.from.endsWith("-01") && Number(range.to.slice(8)) === lastDay) {
    return formatDateHuman(`${range.from}T12:00:00Z`, "MMMM yyyy", timeZone);
  }
  return `${formatDateHuman(`${range.from}T12:00:00Z`, "d MMM", timeZone)} – ${formatDateHuman(
    `${range.to}T12:00:00Z`,
    "d MMM yyyy",
    timeZone,
  )}`;
}
