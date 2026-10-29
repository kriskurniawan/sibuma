import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, parseISO } from "date-fns";
import { formatDateHuman, localDate, zonedToIso } from "./time";
import type { ChecklistIntervalUnit, ChecklistSchedule } from "./checklist-types";

export const CHECKLIST_GENERATION_DAYS_BACK = 45;
export const CHECKLIST_GENERATION_DAYS_AHEAD = 14;

function asDate(value: string) {
  return parseISO(`${value.slice(0, 10)}T12:00:00`);
}

export function dateString(value: Date) {
  return format(value, "yyyy-MM-dd");
}

export function shiftDate(value: string, days: number) {
  return dateString(addDays(asDate(value), days));
}

export function addInterval(value: string, unit: ChecklistIntervalUnit, count: number) {
  const date = asDate(value);
  if (unit === "hari") return dateString(addDays(date, count));
  if (unit === "minggu") return dateString(addWeeks(date, count));
  return dateString(addMonths(date, count));
}

/**
 * Calendar-anchored occurrences. Late completion never shifts later dates,
 * and month steps clamp 29–31 to the last day of shorter months.
 */
export function scheduledDates(input: {
  anchorDate: string;
  unit: ChecklistIntervalUnit;
  count: number;
  from: string;
  to: string;
}) {
  const count = Math.max(1, Math.trunc(input.count));
  const anchor = input.anchorDate.slice(0, 10);
  const from = input.from.slice(0, 10);
  const to = input.to.slice(0, 10);
  if (to < anchor || to < from) return [];

  const gap = differenceInCalendarDays(asDate(from), asDate(anchor));
  const stepDays = input.unit === "hari" ? count : input.unit === "minggu" ? count * 7 : count * 28;
  let index = gap > 0 ? Math.max(0, Math.floor(gap / stepDays) - 1) : 0;
  const dates: string[] = [];
  // Bounds guard against corrupted interval data while still covering years.
  while (index < 10_000) {
    const value = addInterval(anchor, input.unit, index * count);
    if (value > to) break;
    if (value >= from) dates.push(value);
    index += 1;
  }
  return dates;
}

export function checklistDueAt(occurrenceDate: string, dueDays: number) {
  const dueDate = shiftDate(occurrenceDate, Math.max(0, Math.trunc(dueDays)));
  return zonedToIso(dueDate, "23:59");
}

/**
 * Pemeriksaan dibuat beberapa hari lebih awal agar terlihat di daftar, tetapi
 * baru boleh diisi sejak tanggal jadwalnya tiba (zona waktu aplikasi).
 */
export function checklistHasStarted(occurrenceDate: string, now = new Date()) {
  return occurrenceDate.slice(0, 10) <= localDate(now);
}

export function checklistNotStartedMessage(occurrenceDate: string) {
  const date = occurrenceDate.slice(0, 10);
  return `Checklist ini baru dapat diisi mulai ${formatDateHuman(`${date}T12:00:00`, "d MMMM yyyy")}.`;
}

export function checklistIntervalLabel(unit: ChecklistIntervalUnit, count: number) {
  if (count === 1 && unit === "hari") return "Harian";
  if (count === 1 && unit === "minggu") return "Mingguan";
  if (count === 2 && unit === "minggu") return "2 mingguan";
  if (count === 1 && unit === "bulan") return "Bulanan";
  if (count === 3 && unit === "bulan") return "3 bulanan";
  return `Setiap ${count} ${unit}`;
}

export function scheduleOccurrences(
  schedule: Pick<
    ChecklistSchedule,
    "anchorDate" | "intervalUnit" | "intervalCount" | "active"
  >,
  from: string,
  to: string,
) {
  if (!schedule.active) return [];
  return scheduledDates({
    anchorDate: schedule.anchorDate,
    unit: schedule.intervalUnit,
    count: schedule.intervalCount,
    from,
    to,
  });
}

export function isChecklistOverdue(
  input: Pick<ChecklistSchedule, "active"> & {
    status: string;
    dueAt: string;
  },
  now = new Date(),
) {
  return (
    input.status !== "selesai" &&
    input.status !== "dilewati" &&
    new Date(input.dueAt).getTime() < now.getTime()
  );
}
