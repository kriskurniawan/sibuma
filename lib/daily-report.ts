import "server-only";
import { isObserver } from "./access";
import { query } from "./db";
import { getDailyReportSettings } from "./daily-report-settings";
import { sqlTimeZone } from "./sql-time-zone";
import { todayLocal } from "./time";
import type { SessionUser } from "./types";
import type {
  DailyReportChecklist,
  DailyReportData,
  DailyReportPhoto,
  DailyReportPhotoSource,
  DailyReportWork,
} from "./daily-report-types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface DailyReportScope {
  /** `true` untuk pengamat/super admin: seluruh perusahaan. */
  all: boolean;
  ownerId: string | null;
}

/**
 * Cakupan laporan selalu satu tim di bawah atasan yang sama. Berbeda dari
 * akses baca pekerjaan yang mengizinkan pekerja melihat lintas tim, laporan
 * harian tidak boleh mencampur pekerjaan dari atasan lain.
 */
export function dailyReportScope(
  user: Pick<SessionUser, "id" | "role" | "accessMode" | "supervisorId">,
): DailyReportScope {
  if (user.role === "super_admin" || isObserver(user)) {
    return { all: true, ownerId: null };
  }
  return {
    all: false,
    ownerId: user.role === "atasan" ? user.id : user.supervisorId,
  };
}

export function normalizeReportDate(value?: string | string[] | null) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !DATE_PATTERN.test(candidate)) return todayLocal();
  const [year, month, day] = candidate.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return todayLocal();
  }
  return candidate;
}

export function normalizeReportSeed(value?: string | string[] | null) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return "1";
  const cleaned = candidate.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  return cleaned || "1";
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: readonly T[], seed: string) {
  const result = [...items];
  let state = hashSeed(seed);
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
}

function toNameList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === "string",
        );
      }
    } catch {
      // Bukan JSON; nama tunggal tetap dipakai bila ada.
      return value.trim() ? [value.trim()] : [];
    }
  }
  return [];
}

function cleanLabel(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Grup hanya judul, jadi item tetap dibaca sebagai satu tugas: "Genset -
 * Cek oli". Bila prompt sudah memuat nama grup, grup tidak diulang.
 */
function checklistItemLabel(row: ChecklistItemRow) {
  const prompt = cleanLabel(row.prompt ?? "");
  const group = cleanLabel(row.group_path ?? "");
  if (!prompt) return group;
  if (!group) return prompt;
  const promptLower = prompt.toLowerCase();
  const groupLower = group.toLowerCase();
  const rest = promptLower.slice(groupLower.length);
  if (
    promptLower === groupLower ||
    (promptLower.startsWith(groupLower) && /^[\s\-–—:/(]/.test(rest))
  ) {
    return prompt;
  }
  return `${group} - ${prompt}`;
}

type WorkRow = {
  id: string;
  title: string;
  location_name: string;
  result_note: string;
  completed_at: unknown;
  assignees: unknown;
  photo_count: number;
};

type ChecklistRow = {
  id: string;
  template_name: string;
  location_name: string;
  completed_at: unknown;
  completed_by_name: string | null;
  photo_count: number;
};

type ChecklistItemRow = {
  inspection_id: string;
  prompt: string;
  group_path: string | null;
};

type WorkPhotoRow = {
  id: string;
  work_id: string;
  group_label: string;
  location_name: string;
  caption: string;
  created_at: unknown;
};

type ChecklistPhotoRow = {
  id: string;
  group_id: string;
  group_label: string;
  location_name: string;
  item_label: string | null;
  caption: string;
  created_at: unknown;
};

function toWorkPhoto(row: WorkPhotoRow): DailyReportPhoto {
  return {
    id: row.id,
    source: "pekerjaan",
    groupId: row.work_id,
    groupLabel: row.group_label,
    itemLabel: row.caption ?? "",
    locationName: row.location_name ?? "",
    createdAt: toIso(row.created_at),
    priority: 1,
    selected: true,
  };
}

function toChecklistPhoto(row: ChecklistPhotoRow): DailyReportPhoto {
  return {
    id: row.id,
    source: "checklist",
    groupId: row.group_id,
    groupLabel: row.group_label,
    itemLabel: row.item_label || row.caption || "",
    locationName: row.location_name ?? "",
    createdAt: toIso(row.created_at),
    priority: 2,
    selected: true,
  };
}

/**
 * Semua foto dikembalikan agar pekerja dapat menambah/mengganti pilihan tanpa
 * request baru. Urutan array adalah urutan prioritas yang dipakai UI dan
 * pembagian kolase.
 */
function orderPhotos(
  works: DailyReportWork[],
  workPhotos: WorkPhotoRow[],
  checklistPhotos: ChecklistPhotoRow[],
  seed: string,
) {
  const byWork = new Map<string, WorkPhotoRow[]>();
  for (const photo of workPhotos) {
    const list = byWork.get(photo.work_id) ?? [];
    list.push(photo);
    byWork.set(photo.work_id, list);
  }

  const selected: DailyReportPhoto[] = [];
  const used = new Set<string>();

  // Satu foto per pekerjaan, dipilih acak tetapi tetap deterministik per seed.
  for (const work of works) {
    const candidate = seededShuffle(
      byWork.get(work.id) ?? [],
      `${seed}:pekerjaan:${work.id}`,
    ).find((photo) => !used.has(photo.id));
    if (!candidate) continue;
    selected.push(toWorkPhoto(candidate));
    used.add(candidate.id);
  }

  // Seluruh foto checklist selesai pada tanggal laporan, diacak dengan seed.
  for (const photo of seededShuffle(checklistPhotos, `${seed}:checklist`)) {
    selected.push(toChecklistPhoto(photo));
  }

  // Sisa foto pekerjaan dibagi bergiliran agar setiap pekerjaan terwakili
  // merata sebelum foto kedua sebuah pekerjaan dipakai.
  const queues = works.map((work) =>
    seededShuffle(
      (byWork.get(work.id) ?? []).filter((photo) => !used.has(photo.id)),
      `${seed}:tambahan:${work.id}`,
    ),
  );
  let hasRemaining = queues.some((queue) => queue.length > 0);
  while (hasRemaining) {
    for (const queue of queues) {
      const next = queue.shift();
      if (!next) continue;
      selected.push({ ...toWorkPhoto(next), priority: 3 });
      used.add(next.id);
    }
    hasRemaining = queues.some((queue) => queue.length > 0);
  }

  return selected;
}

export async function getDailyReport(
  user: SessionUser,
  date: string,
  seed: string,
): Promise<DailyReportData> {
  const scope = dailyReportScope(user);
  const timeZone = sqlTimeZone();

  const [
    workRows,
    checklistRows,
    checklistItemRows,
    workPhotoRows,
    checklistPhotoRows,
    settings,
  ] = await Promise.all([
    query<WorkRow>(
      `SELECT w.id,w.title,w.location_name,w.result_note,w.completed_at,
              coalesce(asg.assignees,'[]'::json) assignees,
              coalesce(pc.photo_count,0)::integer photo_count
       FROM manual_works w
       LEFT JOIN LATERAL (
         SELECT json_agg(e.name ORDER BY e.name,e.id) assignees
         FROM manual_work_assignees mwa
         JOIN employees e ON e.id=mwa.employee_id
         WHERE mwa.work_id=w.id
       ) asg ON true
       LEFT JOIN LATERAL (
         SELECT count(*)::integer photo_count
         FROM manual_work_photos p
         WHERE p.work_id=w.id AND p.kind='photo'
       ) pc ON true
       WHERE w.status='selesai'
         AND (w.completed_at AT TIME ZONE ${timeZone})::date=$1::date
         AND ($2::boolean OR w.owner_id=$3::text)
       ORDER BY w.completed_at,w.id`,
      [date, scope.all, scope.ownerId],
    ),
    query<ChecklistRow>(
      `SELECT i.id,i.template_name,i.location_name,i.completed_at,
              coalesce(cb.name,own.name) completed_by_name,
              coalesce(pc.photo_count,0)::integer photo_count
       FROM checklist_inspections i
       JOIN employees own ON own.id=i.owner_id
       LEFT JOIN employees cb ON cb.id=i.completed_by
       LEFT JOIN LATERAL (
         SELECT count(*)::integer photo_count
         FROM checklist_photos p
         WHERE p.inspection_id=i.id AND p.kind='photo'
       ) pc ON true
       WHERE i.status='selesai'
         AND (i.completed_at AT TIME ZONE ${timeZone})::date=$1::date
         AND ($2::boolean OR i.owner_id=$3::text)
       ORDER BY i.completed_at,i.id`,
      [date, scope.all, scope.ownerId],
    ),
    query<ChecklistItemRow>(
      `SELECT a.inspection_id,a.prompt,a.group_path
       FROM checklist_answers a
       JOIN checklist_inspections i ON i.id=a.inspection_id
       WHERE i.status='selesai'
         AND a.condition IS NOT NULL
         AND (i.completed_at AT TIME ZONE ${timeZone})::date=$1::date
         AND ($2::boolean OR i.owner_id=$3::text)
       ORDER BY i.completed_at,i.id,a.position,a.id`,
      [date, scope.all, scope.ownerId],
    ),
    query<WorkPhotoRow>(
      `SELECT p.id,p.work_id,w.title group_label,w.location_name,
              p.caption,p.created_at
       FROM manual_work_photos p
       JOIN manual_works w ON w.id=p.work_id
       WHERE p.kind='photo'
         AND w.status='selesai'
         AND (w.completed_at AT TIME ZONE ${timeZone})::date=$1::date
         AND ($2::boolean OR w.owner_id=$3::text)
       ORDER BY p.created_at,p.id`,
      [date, scope.all, scope.ownerId],
    ),
    query<ChecklistPhotoRow>(
      `SELECT p.id,i.id group_id,i.template_name group_label,i.location_name,
              a.prompt item_label,p.caption,p.created_at
       FROM checklist_photos p
       JOIN checklist_inspections i ON i.id=p.inspection_id
       LEFT JOIN checklist_answers a ON a.id=p.answer_id
       WHERE p.kind='photo'
         AND i.status='selesai'
         AND (i.completed_at AT TIME ZONE ${timeZone})::date=$1::date
         AND ($2::boolean OR i.owner_id=$3::text)
       ORDER BY p.created_at,p.id`,
      [date, scope.all, scope.ownerId],
    ),
    getDailyReportSettings(scope.ownerId, date),
  ]);

  const works: DailyReportWork[] = workRows.map((row) => ({
    id: row.id,
    title: row.title,
    locationName: row.location_name ?? "",
    resultNote: row.result_note ?? "",
    completedAt: toIso(row.completed_at),
    assignees: toNameList(row.assignees),
    photoCount: Number(row.photo_count ?? 0),
  }));

  const checklistItems = new Map<string, string[]>();
  for (const row of checklistItemRows) {
    const label = checklistItemLabel(row);
    if (!label) continue;
    const items = checklistItems.get(row.inspection_id) ?? [];
    items.push(label);
    checklistItems.set(row.inspection_id, items);
  }

  const checklists: DailyReportChecklist[] = checklistRows.map((row) => ({
    id: row.id,
    templateName: row.template_name,
    locationName: row.location_name ?? "",
    completedAt: toIso(row.completed_at),
    completedBy: row.completed_by_name,
    photoCount: Number(row.photo_count ?? 0),
    items: checklistItems.get(row.id) ?? [],
  }));

  const photos = orderPhotos(
    works,
    workPhotoRows,
    checklistPhotoRows,
    seed,
  );

  const teamLabel = scope.all
    ? "Seluruh perusahaan"
    : user.role === "atasan"
      ? user.name
      : user.supervisorName ?? user.name;

  return {
    date,
    seed,
    teamLabel,
    scopeAll: scope.all,
    preparedBy: user.name,
    settings,
    canSaveSettings: scope.ownerId !== null && user.accessMode !== "read_only",
    works,
    checklists,
    photos,
    totals: {
      works: works.length,
      checklists: checklists.length,
      photos: photos.length,
    },
  };
}

export async function getDailyReportPhoto(
  user: SessionUser,
  source: DailyReportPhotoSource,
  photoId: string,
  date: string,
) {
  const scope = dailyReportScope(user);
  const timeZone = sqlTimeZone();

  if (source === "pekerjaan") {
    const [row] = await query<{
      storage_key: string;
      file_name: string;
      mime_type: string;
    }>(
      `SELECT p.storage_key,p.file_name,p.mime_type
       FROM manual_work_photos p
       JOIN manual_works w ON w.id=p.work_id
       WHERE p.id=$1 AND p.kind='photo'
         AND w.status='selesai'
         AND (w.completed_at AT TIME ZONE ${timeZone})::date=$4::date
         AND ($2::boolean OR w.owner_id=$3::text)`,
      [photoId, scope.all, scope.ownerId, date],
    );
    return row ?? null;
  }

  const [row] = await query<{
    storage_key: string;
    file_name: string;
    mime_type: string;
  }>(
    `SELECT p.storage_key,p.file_name,p.mime_type
     FROM checklist_photos p
     JOIN checklist_inspections i ON i.id=p.inspection_id
     WHERE p.id=$1 AND p.kind='photo'
       AND i.status='selesai'
       AND (i.completed_at AT TIME ZONE ${timeZone})::date=$4::date
       AND ($2::boolean OR i.owner_id=$3::text)`,
    [photoId, scope.all, scope.ownerId, date],
  );
  return row ?? null;
}
