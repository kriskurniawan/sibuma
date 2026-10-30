import "server-only";
import { insertAudit } from "./audit";
import { pool, query, type Connection } from "./db";
import type { WorkDocumentSettingsInput } from "./work-document-validation";
import {
  WORK_DOCUMENT_DEFAULT_MAX_BYTES,
  WORK_DOCUMENT_DEFAULT_MAX_VIDEO_BYTES,
  WORK_DOCUMENT_DEFAULT_QUOTA_BYTES,
  type WorkDocumentExtension,
  type WorkDocumentSettings,
} from "./work-document-types";
import { toIsoString } from "./work-document-record";

function toSettings(row: Record<string, unknown>): WorkDocumentSettings {
  return {
    uploadsEnabled: Boolean(row.uploads_enabled),
    maxFileBytes: Number(row.max_file_bytes),
    maxVideoBytes: Number(
      row.max_video_bytes ?? WORK_DOCUMENT_DEFAULT_MAX_VIDEO_BYTES,
    ),
    quotaBytes: Number(row.quota_bytes),
    allowedExtensions: (row.allowed_extensions as string[]) as WorkDocumentExtension[],
    trashRetentionDays: Number(row.trash_retention_days),
    shareToDivision: Boolean(row.share_to_division),
    shareToSupervisor: Boolean(row.share_to_supervisor),
    updatedAt: toIsoString(row.updated_at),
    updatedBy: (row.updated_by as string | null) ?? null,
  };
}

/** Pengaturan tunggal; baris default dibuat oleh migrasi 020. */
export async function getWorkDocumentSettings(
  connection: Connection = pool(),
): Promise<WorkDocumentSettings> {
  const [row] = await query(
    "SELECT * FROM work_document_settings WHERE id='settings'",
    [],
    connection,
  );
  if (row) return toSettings(row);

  await query(
    `INSERT INTO work_document_settings
      (id,uploads_enabled,max_file_bytes,quota_bytes,allowed_extensions,trash_retention_days,
       share_to_division,share_to_supervisor,updated_at,max_video_bytes)
     VALUES ('settings',true,$1,$2,$3,30,true,true,now(),$4)
     ON CONFLICT (id) DO NOTHING`,
    [
      WORK_DOCUMENT_DEFAULT_MAX_BYTES,
      WORK_DOCUMENT_DEFAULT_QUOTA_BYTES,
      ["pdf", "jpg", "jpeg", "png", "docx", "xlsx", "pptx", "mp4", "webm", "mov"],
      WORK_DOCUMENT_DEFAULT_MAX_VIDEO_BYTES,
    ],
    connection,
  );
  const [created] = await query(
    "SELECT * FROM work_document_settings WHERE id='settings'",
    [],
    connection,
  );
  if (!created) throw new Error("Pengaturan dokumen kerja belum tersedia.");
  return toSettings(created);
}

export async function saveWorkDocumentSettings(
  connection: Connection,
  input: WorkDocumentSettingsInput,
  actor: { id: string; name: string },
): Promise<WorkDocumentSettings> {
  const [beforeRow] = await query(
    "SELECT * FROM work_document_settings WHERE id='settings' FOR UPDATE",
    [],
    connection,
  );
  if (!beforeRow) throw new Error("Pengaturan dokumen kerja belum tersedia.");
  const before = toSettings(beforeRow);

  const now = new Date().toISOString();
  await query(
    `UPDATE work_document_settings SET
      uploads_enabled=$1,max_file_bytes=$2,quota_bytes=$3,allowed_extensions=$4,
      trash_retention_days=$5,share_to_division=$6,share_to_supervisor=$7,
      updated_by=$8,updated_at=$9,max_video_bytes=$10
     WHERE id='settings'`,
    [
      input.uploadsEnabled,
      input.maxFileMb * 1024 * 1024,
      input.quotaMb * 1024 * 1024,
      input.allowedExtensions,
      input.trashRetentionDays,
      input.shareToDivision,
      input.shareToSupervisor,
      actor.id,
      now,
      input.maxVideoMb * 1024 * 1024,
    ],
    connection,
  );

  const after: WorkDocumentSettings = {
    uploadsEnabled: input.uploadsEnabled,
    maxFileBytes: input.maxFileMb * 1024 * 1024,
    maxVideoBytes: input.maxVideoMb * 1024 * 1024,
    quotaBytes: input.quotaMb * 1024 * 1024,
    allowedExtensions: input.allowedExtensions,
    trashRetentionDays: input.trashRetentionDays,
    shareToDivision: input.shareToDivision,
    shareToSupervisor: input.shareToSupervisor,
    updatedAt: now,
    updatedBy: actor.id,
  };

  await insertAudit(connection, {
    actorId: actor.id,
    actorName: actor.name,
    action: "pengaturan_dokumen_diubah",
    objectType: "dokumen",
    objectId: "settings",
    summary: `${actor.name} memperbarui pengaturan dokumen kerja.`,
    before,
    after,
  });

  return after;
}
