import { getDay, parseISO } from "date-fns";

/**
 * Hari libur untuk tarif lembur HL: Sabtu, Minggu, dan libur nasional resmi.
 * Sabtu tetap HL meskipun pekerja tidak mencentang piket; batas pukul 12.00
 * hanya memengaruhi jumlah jam yang diperhitungkan, bukan tarifnya.
 */
export function isRecapHoliday(
  date: string,
  holidayDates: ReadonlySet<string>,
) {
  if (holidayDates.has(date)) return true;
  const day = getDay(parseISO(`${date}T12:00:00`));
  return day === 0 || day === 6;
}
