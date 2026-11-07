import type { Employee, Spkl } from "./types";

/** Perbandingan himpunan ID tanpa memedulikan urutan pilihan di form. */
export function sameIdSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const ids = new Set(left);
  return right.every((id) => ids.has(id));
}

export interface SpklEditSnapshot {
  title: string;
  description: string;
  date: string;
  startAt: string;
  endAt: string;
  divisionId: string | null;
  workLocationId: string | null;
  radiusMeters: number;
  requiresDocumentation: boolean;
  workerIds: string[];
}

/**
 * Menentukan apakah PATCH tidak mengubah apa pun. Simpan tanpa perubahan tidak
 * boleh menambah audit atau mengirim ulang notifikasi.
 */
export function isUnchangedSpklEdit(
  spkl: Spkl,
  next: SpklEditSnapshot,
  currentWorkerIds: string[],
) {
  return (
    spkl.title === next.title &&
    spkl.description === next.description &&
    spkl.date === next.date &&
    spkl.startAt === next.startAt &&
    spkl.endAt === next.endAt &&
    spkl.divisionId === next.divisionId &&
    spkl.workLocationId === next.workLocationId &&
    spkl.radiusMeters === next.radiusMeters &&
    spkl.requiresDocumentation === next.requiresDocumentation &&
    sameIdSet(currentWorkerIds, next.workerIds)
  );
}

/**
 * Memisahkan pekerja baru dan yang dikeluarkan. Pekerja yang sudah tercatat
 * tidak perlu divalidasi ulang sebagai anggota tim aktif.
 */
export function splitWorkerIds(currentIds: string[], nextIds: string[]) {
  const current = new Set(currentIds);
  const next = new Set(nextIds);
  return {
    added: nextIds.filter((id) => !current.has(id)),
    removed: currentIds.filter((id) => !next.has(id)),
  };
}

/**
 * Pekerja lama yang nonaktif atau sudah di luar tim saat ini tetap ditampilkan
 * tetapi dikunci agar tidak terhapus diam-diam saat edit.
 */
export function lockedAssignedWorkerIds(
  workers: Employee[],
  teamIds: Set<string>,
) {
  return workers
    .filter((worker) => !worker.active || !teamIds.has(worker.id))
    .map((worker) => worker.id);
}
