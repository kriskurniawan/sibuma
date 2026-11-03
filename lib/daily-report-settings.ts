import "server-only";
import { query } from "./db";
import { DEFAULT_DAILY_REPORT_TITLE } from "./daily-report-text";
import type { DailyReportSettings } from "./daily-report-types";

type SettingsRow = {
  report_date: unknown;
  title: string | null;
  notes: string | null;
  updated_at: unknown;
  updated_by_name?: string | null;
};

function toDateString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function cleanTitle(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function cleanNotes(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function emptySettings(): DailyReportSettings {
  return {
    title: DEFAULT_DAILY_REPORT_TITLE,
    notes: "",
    sourceDate: null,
    inherited: false,
    updatedAt: null,
    updatedBy: null,
  };
}

/**
 * Judul dan catatan disimpan per tim (pemilik data) dan tanggal laporan.
 * Bila tanggal yang dibuka belum pernah disimpan, nilai terakhir dari tanggal
 * sebelumnya dipakai sebagai awalan agar pekerja tidak mengetik ulang.
 */
export async function getDailyReportSettings(
  ownerId: string | null,
  date: string,
): Promise<DailyReportSettings> {
  if (!ownerId) return emptySettings();

  const [row] = await query<SettingsRow>(
    `SELECT s.report_date,s.title,s.notes,s.updated_at,e.name updated_by_name
     FROM daily_report_settings s
     LEFT JOIN employees e ON e.id=s.updated_by
     WHERE s.owner_id=$1 AND s.report_date <= $2::date
     ORDER BY s.report_date DESC, s.updated_at DESC
     LIMIT 1`,
    [ownerId, date],
  );
  if (!row) return emptySettings();

  const sourceDate = toDateString(row.report_date);
  return {
    title: cleanTitle(row.title) || DEFAULT_DAILY_REPORT_TITLE,
    notes: cleanNotes(row.notes),
    sourceDate,
    inherited: sourceDate !== date,
    updatedAt: toIso(row.updated_at),
    updatedBy: row.updated_by_name ?? null,
  };
}

/**
 * Upsert satu baris per tim dan tanggal. Semua pekerja di bawah atasan yang
 * sama memakai `ownerId` yang sama, sehingga simpanan satu pekerja langsung
 * terlihat oleh pekerja lain.
 */
export async function saveDailyReportSettings(input: {
  ownerId: string;
  date: string;
  title: string;
  notes: string;
  actor: { id: string; name: string };
}): Promise<DailyReportSettings> {
  const title = cleanTitle(input.title) || DEFAULT_DAILY_REPORT_TITLE;
  const notes = cleanNotes(input.notes);

  const [row] = await query<SettingsRow>(
    `INSERT INTO daily_report_settings
       (owner_id,report_date,title,notes,updated_by,updated_at)
     VALUES ($1,$2::date,$3,$4,$5,now())
     ON CONFLICT (owner_id,report_date) DO UPDATE SET
       title=EXCLUDED.title,
       notes=EXCLUDED.notes,
       updated_by=EXCLUDED.updated_by,
       updated_at=EXCLUDED.updated_at
     RETURNING report_date,title,notes,updated_at`,
    [input.ownerId, input.date, title, notes, input.actor.id],
  );
  if (!row) throw new Error("Judul dan catatan laporan gagal disimpan.");

  return {
    title: cleanTitle(row.title) || DEFAULT_DAILY_REPORT_TITLE,
    notes: cleanNotes(row.notes),
    sourceDate: toDateString(row.report_date),
    inherited: false,
    updatedAt: toIso(row.updated_at),
    updatedBy: input.actor.name,
  };
}
