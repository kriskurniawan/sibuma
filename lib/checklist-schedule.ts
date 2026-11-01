import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, getISODay, parseISO } from "date-fns";
import { formatDateHuman, formatDateTime, zonedToIso } from "./time";
import {
  CHECKLIST_WEEKDAYS,
  CHECKLIST_WEEKDAY_LABEL,
  defaultChecklistScheduleDays,
  type ChecklistIntervalUnit,
  type ChecklistSchedule,
  type ChecklistScheduleDay,
  type ChecklistWeekday,
} from "./checklist-types";

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

export function normalizeScheduleTime(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function weekdayOf(date: string): ChecklistWeekday {
  return getISODay(asDate(date)) as ChecklistWeekday;
}

export function resolvedScheduleDays(
  days:
    | Array<{
        weekday: number;
        enabled: boolean;
        startTime: string;
        endTime: string;
      }>
    | null
    | undefined,
): ChecklistScheduleDay[] {
  if (!days || days.length === 0) return defaultChecklistScheduleDays();
  const byWeekday = new Map(days.map((day) => [day.weekday, day]));
  return CHECKLIST_WEEKDAYS.map((weekday) => {
    const day = byWeekday.get(weekday);
    return day
      ? { ...day, weekday }
      : {
          weekday,
          enabled: false,
          startTime: "00:00",
          endTime: "23:59",
        };
  });
}

export function scheduleDayFor(
  days: ChecklistScheduleDay[] | null | undefined,
  date: string,
) {
  const weekday = weekdayOf(date);
  return (
    resolvedScheduleDays(days).find((day) => day.weekday === weekday) ?? null
  );
}

export function checklistOpensAt(occurrenceDate: string, startTime = "00:00") {
  return zonedToIso(
    occurrenceDate.slice(0, 10),
    normalizeScheduleTime(startTime),
  );
}

export function checklistDueAt(
  occurrenceDate: string,
  dueDays: number,
  endTime = "23:59",
) {
  const dueDate = shiftDate(occurrenceDate, Math.max(0, Math.trunc(dueDays)));
  return zonedToIso(dueDate, normalizeScheduleTime(endTime));
}

/**
 * Tenggat mengikuti hari aktif jadwal. `dueDays` tetap dihitung sebagai hari
 * kalender, lalu hari libur dilewati agar deadline tidak pernah jatuh pada hari
 * nonaktif. Jam selesai diambil dari hari tenggat, bukan hari occurrence.
 */
export function checklistDueFor(
  occurrenceDate: string,
  dueDays: number,
  days: ChecklistScheduleDay[] | null | undefined,
) {
  const resolved = resolvedScheduleDays(days);
  let dueDate = shiftDate(occurrenceDate, Math.max(0, Math.trunc(dueDays)));
  let endTime = "23:59";
  // Bounded so a schedule with no active day cannot loop forever.
  for (let step = 0; step < 366; step += 1) {
    const day = resolved[weekdayOf(dueDate) - 1];
    if (day?.enabled) {
      endTime = day.endTime;
      break;
    }
    dueDate = shiftDate(dueDate, 1);
  }
  return { dueDate, endTime, dueAt: checklistDueAt(dueDate, 0, endTime) };
}

/**
 * Pemeriksaan dibuat beberapa hari lebih awal agar terlihat di daftar, tetapi
 * baru boleh diisi sejak jam mulai jadwal pada tanggal occurrence tiba.
 */
export function checklistHasOpened(
  opensAt: string | Date,
  now = new Date(),
) {
  return new Date(opensAt).getTime() <= now.getTime();
}

export function checklistNotOpenedMessage(opensAt: string | Date) {
  const iso =
    opensAt instanceof Date ? opensAt.toISOString() : opensAt;
  const localTime = formatDateTime(iso, "HH:mm");
  if (localTime === "00:00") {
    return `Checklist ini baru dapat diisi mulai ${formatDateHuman(iso, "d MMMM yyyy")}.`;
  }
  return `Checklist ini baru dapat diisi mulai ${formatDateTime(iso, "d MMMM yyyy, HH:mm")}.`;
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
    "anchorDate" | "intervalUnit" | "intervalCount" | "active" | "days"
  >,
  from: string,
  to: string,
) {
  if (!schedule.active) return [];
  const days = resolvedScheduleDays(schedule.days);
  return scheduledDates({
    anchorDate: schedule.anchorDate,
    unit: schedule.intervalUnit,
    count: schedule.intervalCount,
    from,
    to,
  }).filter((date) => days[weekdayOf(date) - 1]?.enabled);
}

function weekdayRanges(weekdays: ChecklistWeekday[]) {
  const sorted = [...weekdays].sort((left, right) => left - right);
  const ranges: string[] = [];
  let start: ChecklistWeekday | null = null;
  let previous: ChecklistWeekday | null = null;

  const flush = () => {
    if (start === null || previous === null) return;
    ranges.push(
      start === previous
        ? CHECKLIST_WEEKDAY_LABEL[start]
        : `${CHECKLIST_WEEKDAY_LABEL[start]}–${CHECKLIST_WEEKDAY_LABEL[previous]}`,
    );
  };

  for (const day of sorted) {
    if (start === null || previous === null) {
      start = day;
      previous = day;
      continue;
    }
    if (day === previous + 1) {
      previous = day;
      continue;
    }
    flush();
    start = day;
    previous = day;
  }
  flush();
  return ranges;
}

/** Ringkasan untuk daftar jadwal: jam per kelompok hari dan hari libur. */
export function checklistScheduleDaysSummary(
  days: ChecklistScheduleDay[] | null | undefined,
) {
  const resolved = resolvedScheduleDays(days);
  const enabled = resolved.filter((day) => day.enabled);
  if (enabled.length === 0) return "Tidak ada hari aktif";

  const allSameHours = enabled.every(
    (day) =>
      day.startTime === enabled[0].startTime &&
      day.endTime === enabled[0].endTime,
  );
  if (enabled.length === CHECKLIST_WEEKDAYS.length && allSameHours) {
    return `Setiap hari ${enabled[0].startTime}–${enabled[0].endTime}`;
  }

  const byHours = new Map<string, ChecklistWeekday[]>();
  for (const day of enabled) {
    const key = `${day.startTime}|${day.endTime}`;
    const list = byHours.get(key) ?? [];
    list.push(day.weekday);
    byHours.set(key, list);
  }
  const parts = [...byHours.entries()].map(
    ([key, weekdays]) =>
      `${weekdayRanges(weekdays).join(", ")} ${key.replace("|", "–")}`,
  );
  const disabled = resolved
    .filter((day) => !day.enabled)
    .map((day) => day.weekday);
  if (disabled.length > 0) {
    parts.push(`${weekdayRanges(disabled).join(", ")} libur`);
  }
  return parts.join(" · ");
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
