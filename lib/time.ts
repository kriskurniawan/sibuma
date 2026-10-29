import {
  addDays,
  parseISO,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "./constants";
import type { Spkl, SpklStatus } from "./types";

export function zonedToIso(date: string, time: string, timeZone = APP_TIMEZONE) {
  return fromZonedTime(`${date}T${time}:00`, timeZone).toISOString();
}

export function localDateTimeToIso(
  value: string,
  timeZone = APP_TIMEZONE,
) {
  return fromZonedTime(`${value}:00`, timeZone).toISOString();
}

export function toLocalDateInput(iso: string, timeZone = APP_TIMEZONE) {
  return formatInTimeZone(parseISO(iso), timeZone, "yyyy-MM-dd");
}

export function toLocalTimeInput(iso: string, timeZone = APP_TIMEZONE) {
  return formatInTimeZone(parseISO(iso), timeZone, "HH:mm");
}

export function formatDateHuman(
  iso: string,
  pattern = "EEEE, d MMMM yyyy",
  timeZone = APP_TIMEZONE,
) {
  return formatInTimeZone(parseISO(iso), timeZone, pattern, {
    locale: localeId,
  });
}

export function formatTime(iso: string, timeZone = APP_TIMEZONE) {
  return formatInTimeZone(parseISO(iso), timeZone, "HH:mm", {
    locale: localeId,
  });
}

export function formatDateTime(
  iso: string,
  pattern = "d MMM yyyy, HH:mm",
  timeZone = APP_TIMEZONE,
) {
  return formatInTimeZone(parseISO(iso), timeZone, pattern, {
    locale: localeId,
  });
}

export function formatDateShort(iso: string, timeZone = APP_TIMEZONE) {
  return formatInTimeZone(parseISO(iso), timeZone, "d MMM", {
    locale: localeId,
  });
}

export function formatDayName(iso: string, timeZone = APP_TIMEZONE) {
  return formatInTimeZone(parseISO(iso), timeZone, "EEEE", {
    locale: localeId,
  });
}

export function localDate(now = new Date(), timeZone = APP_TIMEZONE) {
  return formatInTimeZone(now, timeZone, "yyyy-MM-dd");
}

export function todayLocal(timeZone = APP_TIMEZONE) {
  return localDate(new Date(), timeZone);
}

export function currentMonthRange(timeZone = APP_TIMEZONE) {
  const today = todayLocal(timeZone);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${today.slice(0, 7)}-01`,
    to: `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function spklStatus(spkl: Spkl, now = new Date()): SpklStatus {
  if (spkl.canceledAt) return "dibatalkan";
  const nowMs = now.getTime();
  const start = parseISO(spkl.startAt).getTime();
  const end = parseISO(spkl.endAt).getTime();
  if (nowMs < start) return "terjadwal";
  if (nowMs <= end) return "berlangsung";
  return "selesai";
}

export function checkInOpensAt(date: string, timeZone = APP_TIMEZONE) {
  return zonedToIso(date, "00:00", timeZone);
}

export function isCheckInOpen(
  spkl: Pick<Spkl, "date" | "endAt" | "canceledAt">,
  now = new Date(),
) {
  if (spkl.canceledAt) return false;
  const opensAt = new Date(checkInOpensAt(spkl.date)).getTime();
  const nowMs = now.getTime();
  return nowMs >= opensAt && nowMs <= new Date(spkl.endAt).getTime();
}

export function isEarlyCheckIn(checkInAt: string, spklStartAt: string) {
  return new Date(checkInAt).getTime() < new Date(spklStartAt).getTime();
}

/**
 * Waktu mulai yang dihitung sebagai lembur. Absen lebih awal tetap dicatat
 * pada checkInAt, tetapi durasi resmi dimulai saat jadwal SPKL dimulai.
 */
export function attendanceStartAt(checkInAt: string, spklStartAt: string) {
  const start = Math.max(
    new Date(checkInAt).getTime(),
    new Date(spklStartAt).getTime(),
  );
  return new Date(start).toISOString();
}

export function attendanceMinutes(input: {
  checkInAt: string;
  checkOutAt?: string | null;
  spklStartAt: string;
  spklEndAt: string;
  now?: Date;
}) {
  const start = new Date(
    attendanceStartAt(input.checkInAt, input.spklStartAt),
  ).getTime();
  const endSource =
    input.checkOutAt ?? (input.now ?? new Date()).toISOString();
  const end = Math.min(
    new Date(endSource).getTime(),
    new Date(input.spklEndAt).getTime(),
  );
  return Math.max(0, Math.round((end - start) / 60_000));
}

export function isSameLocalDay(a: string, b: string, timeZone = APP_TIMEZONE) {
  return (
    formatInTimeZone(parseISO(a), timeZone, "yyyy-MM-dd") ===
    formatInTimeZone(parseISO(b), timeZone, "yyyy-MM-dd")
  );
}

export function roundDuration(minutes: number, roundingMinutes: number) {
  if (!roundingMinutes || roundingMinutes <= 0) return Math.round(minutes);
  return Math.round(minutes / roundingMinutes) * roundingMinutes;
}

export function durationLabel(minutes: number | null) {
  if (minutes === null || minutes === undefined) return "—";
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m} mnt`;
  if (m === 0) return `${h} jam`;
  return `${h} j ${m} m`;
}

export function durationClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

export function greeting(timeZone = APP_TIMEZONE) {
  const hour = Number(formatInTimeZone(new Date(), timeZone, "H"));
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}

export function dayLabel(iso: string, timeZone = APP_TIMEZONE) {
  const today = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
  const target = toLocalDateInput(iso, timeZone);
  if (today === target) return "Hari ini";
  if (toLocalDateInput(addDays(new Date(), 1).toISOString(), timeZone) === target)
    return "Besok";
  if (
    toLocalDateInput(addDays(new Date(), -1).toISOString(), timeZone) === target
  )
    return "Kemarin";
  return formatDateHuman(iso, "EEEE, d MMM", timeZone);
}

export function relativeDayLabel(dateString: string) {
  const today = todayLocal();
  if (dateString === today) return "Hari ini";
  const tomorrow = toLocalDateInput(addDays(new Date(), 1).toISOString());
  if (dateString === tomorrow) return "Besok";
  return formatDateHuman(`${dateString}T12:00:00`, "EEEE, d MMM");
}
