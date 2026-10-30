export const APP_NAME = "SIBUMA";
export const APP_TAGLINE = "Sistem Building Management";
export const APP_TIMEZONE =
  process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Jakarta";
export const SESSION_COOKIE = "lembur_session";
export const SESSION_DAYS = 30;
export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LOCK_MINUTES = 15;
export const UPLOAD_MAX_BYTES = 1.5 * 1024 * 1024;
export const MAX_WEEKLY_MINUTES = 40 * 60;
export const MAX_DAILY_MINUTES = 8 * 60;

export const DEFAULT_MAP_CENTER = {
  latitude: -6.2439,
  longitude: 106.7989,
  address: "Menara Sentraya, Jakarta Selatan",
};

export const ROLE_LABEL = {
  pekerja: "Pekerja",
  atasan: "Atasan",
  super_admin: "Super admin",
} as const;

export const ACCESS_MODE_LABEL = {
  full: "Akses penuh",
  read_only: "Hanya lihat",
} as const;

export const ATTENDANCE_STATUS_LABEL = {
  berjalan: "Sedang lembur",
  selesai: "Selesai",
  ditutup_otomatis: "Ditutup otomatis",
  tidak_hadir: "Tidak hadir",
  dikoreksi: "Dikoreksi",
} as const;

export const SPKL_STATUS_LABEL = {
  terjadwal: "Terjadwal",
  berlangsung: "Berlangsung",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
} as const;
