import { APP_TIMEZONE } from "./constants";
import { isAppTimeZone, timeZoneLabel, type AppTimeZone } from "./time-zone";

declare global {
  interface Window {
    __SIBUMA_TIME_ZONE__?: string;
  }
}

let activeTimeZone: AppTimeZone | null = null;

/**
 * Nilai zona aktif berasal dari policy database dan di-set ulang pada setiap
 * request server. Di browser, bootstrap layout menulis nilai yang sama ke
 * window sebelum komponen lain membaca formatter.
 */
export function setActiveTimeZone(value: string) {
  if (isAppTimeZone(value)) activeTimeZone = value;
}

export function getActiveTimeZone(): AppTimeZone {
  if (activeTimeZone) return activeTimeZone;
  if (
    typeof window !== "undefined" &&
    isAppTimeZone(window.__SIBUMA_TIME_ZONE__)
  ) {
    return window.__SIBUMA_TIME_ZONE__;
  }
  return APP_TIMEZONE;
}

export function currentTimeZoneLabel() {
  return timeZoneLabel(getActiveTimeZone());
}
