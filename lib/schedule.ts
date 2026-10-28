import { addDays, parseISO, startOfWeek } from "date-fns";
import { APP_TIMEZONE } from "./constants";
import { toLocalDateInput } from "./time";

export interface ScheduledItem {
  employeeId: string;
  spklId: string;
  title: string;
  startAt: string;
  endAt: string;
  canceled?: boolean;
}

export interface ScheduleWarning {
  employeeId: string;
  type: "overlap" | "daily" | "weekly";
  message: string;
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) {
  return (
    new Date(aStart).getTime() < new Date(bEnd).getTime() &&
    new Date(aEnd).getTime() > new Date(bStart).getTime()
  );
}

function minutes(startAt: string, endAt: string) {
  return Math.max(
    0,
    Math.round(
      (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000,
    ),
  );
}

export function scheduleWarnings(input: {
  employeeIds: string[];
  startAt: string;
  endAt: string;
  dailyLimitMinutes: number;
  weeklyLimitMinutes: number;
  schedules: ScheduledItem[];
  excludeSpklId?: string;
}): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  const newStart = parseISO(input.startAt);
  const newEnd = parseISO(input.endAt);
  const day = toLocalDateInput(input.startAt, APP_TIMEZONE);
  const weekStart = startOfWeek(newStart, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const duration = minutes(input.startAt, input.endAt);

  for (const employeeId of input.employeeIds) {
    const existing = input.schedules.filter(
      (item) =>
        item.employeeId === employeeId &&
        !item.canceled &&
        item.spklId !== input.excludeSpklId,
    );

    const collision = existing.find((item) =>
      overlaps(input.startAt, input.endAt, item.startAt, item.endAt),
    );
    if (collision) {
      warnings.push({
        employeeId,
        type: "overlap",
        message: `Jadwal bertabrakan dengan SPKL “${collision.title}”.`,
      });
    }

    const dailyExisting = existing.filter(
      (item) => toLocalDateInput(item.startAt, APP_TIMEZONE) === day,
    );
    const dailyTotal =
      dailyExisting.reduce(
        (total, item) => total + minutes(item.startAt, item.endAt),
        0,
      ) + duration;
    if (dailyTotal > input.dailyLimitMinutes) {
      warnings.push({
        employeeId,
        type: "daily",
        message: `Total lembur hari ini menjadi ${Math.floor(dailyTotal / 60)} j ${dailyTotal % 60} m, melewati batas ${Math.floor(input.dailyLimitMinutes / 60)} jam per hari.`,
      });
    }

    const weeklyExisting = existing.filter((item) => {
      const start = parseISO(item.startAt);
      return start >= weekStart && start < weekEnd;
    });
    const weeklyTotal =
      weeklyExisting.reduce(
        (total, item) => total + minutes(item.startAt, item.endAt),
        0,
      ) + duration;
    if (weeklyTotal > input.weeklyLimitMinutes) {
      warnings.push({
        employeeId,
        type: "weekly",
        message: `Total lembur minggu ini menjadi ${Math.floor(weeklyTotal / 60)} j ${weeklyTotal % 60} m, melewati batas ${Math.floor(input.weeklyLimitMinutes / 60)} jam per minggu.`,
      });
    }
  }

  return warnings;
}
