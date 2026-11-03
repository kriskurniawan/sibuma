export type DailyReportPhotoSource = "pekerjaan" | "checklist";

/**
 * Urutan prioritas pemilihan foto:
 * 1. satu foto dari setiap pekerjaan selesai,
 * 2. foto dari checklist selesai pada tanggal laporan,
 * 3. foto tambahan dari pekerjaan secara bergiliran.
 */
export type DailyReportPhotoPriority = 1 | 2 | 3;

export interface DailyReportWork {
  id: string;
  title: string;
  locationName: string;
  resultNote: string;
  completedAt: string;
  assignees: string[];
  photoCount: number;
}

export interface DailyReportChecklist {
  id: string;
  templateName: string;
  locationName: string;
  completedAt: string;
  /** Nama pekerja yang menyelesaikan pemeriksaan. */
  completedBy: string | null;
  photoCount: number;
  /**
   * Item spesifik yang diperiksa pada checklist ini, sudah memuat nama grup
   * bila ada. Kosong berarti laporan memakai nama template sebagai cadangan.
   */
  items: string[];
}

export interface DailyReportPhoto {
  id: string;
  source: DailyReportPhotoSource;
  groupId: string;
  groupLabel: string;
  itemLabel: string;
  locationName: string;
  createdAt: string;
  priority: DailyReportPhotoPriority;
  selected: boolean;
}

export interface DailyReportSettings {
  title: string;
  notes: string;
  /** Tanggal laporan tempat judul/catatan tersimpan; null bila belum ada. */
  sourceDate: string | null;
  /** True bila nilai berasal dari tanggal lain dan belum disimpan untuk tanggal ini. */
  inherited: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface DailyReportData {
  date: string;
  seed: string;
  teamLabel: string;
  /** Pengamat dan super admin melihat seluruh perusahaan. */
  scopeAll: boolean;
  preparedBy: string;
  /** Judul dan catatan dibagi ke seluruh pekerja dalam tim yang sama. */
  settings: DailyReportSettings;
  canSaveSettings: boolean;
  works: DailyReportWork[];
  checklists: DailyReportChecklist[];
  photos: DailyReportPhoto[];
  totals: {
    works: number;
    checklists: number;
    photos: number;
  };
}
