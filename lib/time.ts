import {
  addDays,
  parseISO,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getActiveTimeZone } from "./active-time-zone";
import type { AttendanceStatus, Spkl, SpklStatus } from "./types";

export { currentTimeZoneLabel, setActiveTimeZone } from "./active-time-zone";
export { getActiveTimeZone };

export function zonedToIso(date: string, time: string, timeZone = getActiveTimeZone()) {
  return fromZonedTime(`${date}T${time}:00`, timeZone).toISOString();
}

export function localDateTimeToIso(
  value: string,
  timeZone = getActiveTimeZone(),
) {
  return fromZonedTime(`${value}:00`, timeZone).toISOString();
}

export function toLocalDateInput(iso: string, timeZone = getActiveTimeZone()) {
  return formatInTimeZone(parseISO(iso), timeZone, "yyyy-MM-dd");
}

export function toLocalTimeInput(iso: string, timeZone = getActiveTimeZone()) {
  return formatInTimeZone(parseISO(iso), timeZone, "HH:mm");
}

export function formatDateHuman(
  iso: string,
  pattern = "EEEE, d MMMM yyyy",
  timeZone = getActiveTimeZone(),
) {
  return formatInTimeZone(parseISO(iso), timeZone, pattern, {
    locale: localeId,
  });
}

export function formatTime(iso: string, timeZone = getActiveTimeZone()) {
  return formatInTimeZone(parseISO(iso), timeZone, "HH:mm", {
    locale: localeId,
  });
}

export function formatDateTime(
  iso: string,
  pattern = "d MMM yyyy, HH:mm",
  timeZone = getActiveTimeZone(),
) {
  return formatInTimeZone(parseISO(iso), timeZone, pattern, {
    locale: localeId,
  });
}

export function formatDateShort(iso: string, timeZone = getActiveTimeZone()) {
  return formatInTimeZone(parseISO(iso), timeZone, "d MMM", {
    locale: localeId,
  });
}

export function formatDayName(iso: string, timeZone = getActiveTimeZone()) {
  return formatInTimeZone(parseISO(iso), timeZone, "EEEE", {
    locale: localeId,
  });
}

export function localDate(now = new Date(), timeZone = getActiveTimeZone()) {
  return formatInTimeZone(now, timeZone, "yyyy-MM-dd");
}

export function todayLocal(timeZone = getActiveTimeZone()) {
  return localDate(new Date(), timeZone);
}

export function currentMonthRange(timeZone = getActiveTimeZone()) {
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

export function checkInOpensAt(date: string, timeZone = getActiveTimeZone()) {
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

export interface OvertimeRoundingPolicy {
  overtimeRoundingEnabled: boolean;
  overtimeRoundingToleranceMinutes: number;
  overtimeRoundingEffectiveMonth: string;
}

/**
 * Jam lembur yang diperhitungkan untuk satu sesi final.
 *
 * Durasi aktual tetap dibatasi jadwal SPKL dan disimpan apa adanya. Mulai bulan
 * yang ditetapkan, kekurangan sampai toleransi dihitung penuh; kekurangan yang
 * lebih besar dibulatkan ke bawah per jam penuh. Sesi berjalan, sesi tanpa
 * checkout, dan SPKL batal tidak pernah mendapat tambahan jam dari aturan ini.
 */
export function overtimePayableMinutes(input: {
  checkInAt: string | null;
  checkOutAt: string | null;
  status: AttendanceStatus;
  storedMinutes?: number | null;
  spklStartAt: string;
  spklEndAt: string;
  spklDate: string;
  spklCanceledAt?: string | null;
  policy: OvertimeRoundingPolicy;
  now?: Date;
}) {
  if (input.status === "tidak_hadir") return 0;
  if (!input.checkInAt) {
    return Math.max(0, Math.round(input.storedMinutes ?? 0));
  }

  // Sesi berjalan boleh memakai waktu sekarang; sesi final tanpa checkout
  // tidak boleh mendapat jam penuh hanya karena jadwal sudah berakhir.
  if (!input.checkOutAt && input.status !== "berjalan") return 0;

  const actual = attendanceMinutes({
    checkInAt: input.checkInAt,
    checkOutAt: input.checkOutAt,
    spklStartAt: input.spklStartAt,
    spklEndAt: input.spklEndAt,
    now: input.now,
  });

  if (!input.checkOutAt || input.spklCanceledAt) return actual;
  if (
    !input.policy.overtimeRoundingEnabled ||
    input.spklDate.slice(0, 7) <
      input.policy.overtimeRoundingEffectiveMonth.slice(0, 7)
  ) {
    return actual;
  }

  const scheduled = Math.max(
    0,
    Math.round(
      (new Date(input.spklEndAt).getTime() -
        new Date(input.spklStartAt).getTime()) /
        60_000,
    ),
  );
  const tolerance = Math.max(
    0,
    Math.round(input.policy.overtimeRoundingToleranceMinutes),
  );
  const shortfall = Math.max(0, scheduled - actual);
  if (shortfall <= tolerance) return scheduled;

  const deduction = Math.ceil((shortfall - tolerance) / 60) * 60;
  return Math.max(0, scheduled - deduction);
}

export function isSameLocalDay(a: string, b: string, timeZone = getActiveTimeZone()) {
  return (
    formatInTimeZone(parseISO(a), timeZone, "yyyy-MM-dd") ===
    formatInTimeZone(parseISO(b), timeZone, "yyyy-MM-dd")
  );
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

/** Selisih dua waktu ISO dalam menit, dibulatkan dan tidak pernah negatif. */
export function minutesBetween(startAt: string, endAt: string) {
  return Math.max(
    0,
    Math.round(
      (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000,
    ),
  );
}

export function durationClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

export function greeting(timeZone = getActiveTimeZone()) {
  const hour = Number(formatInTimeZone(new Date(), timeZone, "H"));
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}

export function dayLabel(iso: string, timeZone = getActiveTimeZone()) {
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
