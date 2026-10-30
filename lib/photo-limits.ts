import "server-only";
import { insertAudit } from "./audit";
import { pool, query, type Connection } from "./db";
import {
  DEFAULT_PHOTO_LIMITS,
  type PhotoLimits,
} from "./photo-limit-types";
import type { PhotoLimitsInput } from "./photo-limit-validation";

function positiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toPhotoLimits(row: Record<string, unknown>): PhotoLimits {
  return {
    checklistPhotos: Number(row.checklist_photos),
    workPhotos: Number(row.work_photos),
    spklPhotos: Number(row.spkl_photos),
    videoEnabled: row.video_enabled === undefined ? true : Boolean(row.video_enabled),
    maxVideoBytes: positiveNumber(
      row.max_video_bytes,
      DEFAULT_PHOTO_LIMITS.maxVideoBytes,
    ),
    spklVideos: positiveNumber(row.spkl_videos, DEFAULT_PHOTO_LIMITS.spklVideos),
    checklistVideos: positiveNumber(
      row.checklist_videos,
      DEFAULT_PHOTO_LIMITS.checklistVideos,
    ),
    workVideos: positiveNumber(row.work_videos, DEFAULT_PHOTO_LIMITS.workVideos),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
    updatedBy: (row.updated_by as string | null) ?? null,
  };
}

/** Pengaturan tunggal; baris default dibuat oleh migrasi 021 dan 022. */
export async function getPhotoLimits(
  connection: Connection = pool(),
): Promise<PhotoLimits> {
  const [row] = await query(
    "SELECT * FROM photo_limit_settings WHERE id='settings'",
    [],
    connection,
  );
  if (row) return toPhotoLimits(row);

  await query(
    `INSERT INTO photo_limit_settings
      (id,checklist_photos,work_photos,spkl_photos,video_enabled,max_video_bytes,
       spkl_videos,checklist_videos,work_videos,updated_at)
     VALUES ('settings',$1,$2,$3,$4,$5,$6,$7,$8,now())
     ON CONFLICT (id) DO NOTHING`,
    [
      DEFAULT_PHOTO_LIMITS.checklistPhotos,
      DEFAULT_PHOTO_LIMITS.workPhotos,
      DEFAULT_PHOTO_LIMITS.spklPhotos,
      DEFAULT_PHOTO_LIMITS.videoEnabled,
      DEFAULT_PHOTO_LIMITS.maxVideoBytes,
      DEFAULT_PHOTO_LIMITS.spklVideos,
      DEFAULT_PHOTO_LIMITS.checklistVideos,
      DEFAULT_PHOTO_LIMITS.workVideos,
    ],
    connection,
  );
  const [created] = await query(
    "SELECT * FROM photo_limit_settings WHERE id='settings'",
    [],
    connection,
  );
  if (!created) throw new Error("Pengaturan batas dokumentasi belum tersedia.");
  return toPhotoLimits(created);
}

export async function savePhotoLimits(
  connection: Connection,
  input: PhotoLimitsInput,
  actor: { id: string; name: string },
): Promise<PhotoLimits> {
  const [beforeRow] = await query(
    "SELECT * FROM photo_limit_settings WHERE id='settings' FOR UPDATE",
    [],
    connection,
  );
  if (!beforeRow) throw new Error("Pengaturan batas dokumentasi belum tersedia.");
  const before = toPhotoLimits(beforeRow);

  const now = new Date().toISOString();
  const maxVideoBytes = input.maxVideoMb * 1024 * 1024;
  await query(
    `UPDATE photo_limit_settings SET
      checklist_photos=$1,work_photos=$2,spkl_photos=$3,
      video_enabled=$4,max_video_bytes=$5,spkl_videos=$6,checklist_videos=$7,
      work_videos=$8,updated_by=$9,updated_at=$10
     WHERE id='settings'`,
    [
      input.checklistPhotos,
      input.workPhotos,
      input.spklPhotos,
      input.videoEnabled,
      maxVideoBytes,
      input.spklVideos,
      input.checklistVideos,
      input.workVideos,
      actor.id,
      now,
    ],
    connection,
  );

  const after: PhotoLimits = {
    checklistPhotos: input.checklistPhotos,
    workPhotos: input.workPhotos,
    spklPhotos: input.spklPhotos,
    videoEnabled: input.videoEnabled,
    maxVideoBytes,
    spklVideos: input.spklVideos,
    checklistVideos: input.checklistVideos,
    workVideos: input.workVideos,
    updatedAt: now,
    updatedBy: actor.id,
  };

  await insertAudit(connection, {
    actorId: actor.id,
    actorName: actor.name,
    action: "pengaturan_batas_foto_diubah",
    objectType: "kebijakan",
    objectId: "settings",
    summary: `${actor.name} memperbarui batas foto dan video dokumentasi.`,
    before,
    after,
  });

  return after;
}
