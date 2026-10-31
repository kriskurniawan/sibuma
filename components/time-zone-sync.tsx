"use client";

import { setActiveTimeZone } from "@/lib/active-time-zone";

/**
 * Menyiapkan zona waktu modul sebelum komponen lain merender. Nilai ini bukan
 * state React; perubahan zona dilakukan lewat reload setelah policy disimpan.
 */
export function TimeZoneSync({ timeZone }: { timeZone: string }) {
  if (typeof window !== "undefined") {
    window.__SIBUMA_TIME_ZONE__ = timeZone;
  }
  setActiveTimeZone(timeZone);
  return null;
}
