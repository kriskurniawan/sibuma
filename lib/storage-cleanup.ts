import "server-only";

import { query } from "./db";
import { deleteObject } from "./storage";

interface CleanupRow {
  storage_key: string;
}

interface CleanupFailure {
  key: string;
  error: unknown;
}

const MAX_ERROR_LENGTH = 500;

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ERROR_LENGTH);
}

async function removeObjects(keys: string[]) {
  const deleted: string[] = [];
  const failed: CleanupFailure[] = [];
  await Promise.all(
    keys.map(async (key) => {
      try {
        await deleteObject(key, "s3");
        deleted.push(key);
      } catch (error) {
        failed.push({ key, error });
      }
    }),
  );
  return { deleted, failed };
}

async function enqueueFailures(failures: CleanupFailure[]) {
  await Promise.all(
    failures.map(({ key, error }) =>
      query(
        `INSERT INTO storage_cleanup_queue
          (storage_key,storage_provider,attempts,last_error)
         VALUES ($1,'s3',1,$2)
         ON CONFLICT (storage_key) DO UPDATE SET
           attempts=storage_cleanup_queue.attempts+1,
           last_error=EXCLUDED.last_error,
           updated_at=now()`,
        [key, errorMessage(error)],
      ).catch((queueError) => {
        console.error(
          `Gagal mencatat pembersihan storage ${key}:`,
          queueError,
        );
      }),
    ),
  );
}

/** Coba ulang antrean pembersihan yang tertinggal dari permintaan sebelumnya. */
export async function drainStorageCleanupQueue(limit = 20) {
  let rows: CleanupRow[];
  try {
    rows = await query<CleanupRow>(
      `SELECT storage_key FROM storage_cleanup_queue
       ORDER BY updated_at, created_at
       LIMIT $1`,
      [limit],
    );
  } catch (error) {
    console.error("Gagal membaca antrean pembersihan storage:", error);
    return;
  }
  if (rows.length === 0) return;

  const { deleted, failed } = await removeObjects(
    rows.map((row) => row.storage_key),
  );

  if (deleted.length > 0) {
    await query(
      `DELETE FROM storage_cleanup_queue WHERE storage_key = ANY($1::text[])`,
      [deleted],
    ).catch((error) => {
      console.error("Gagal membersihkan antrean storage yang sudah dihapus:", error);
    });
  }

  await Promise.all(
    failed.map(({ key, error }) =>
      query(
        `UPDATE storage_cleanup_queue SET
           attempts=attempts+1,
           last_error=$2,
           updated_at=now()
         WHERE storage_key=$1`,
        [key, errorMessage(error)],
      ).catch((queueError) => {
        console.error(`Gagal memperbarui antrean storage ${key}:`, queueError);
      }),
    ),
  );
}

/**
 * Hapus objek storage tanpa memblokir respons. Kegagalan permanen disimpan di
 * database agar dapat diulang pada permintaan berikutnya.
 */
export async function cleanupObjects(keys: string[]) {
  const unique = [
    ...new Set(keys.filter((key): key is string => Boolean(key))),
  ];
  await drainStorageCleanupQueue().catch((error) => {
    console.error("Gagal mengulang antrean pembersihan storage:", error);
  });
  if (unique.length === 0) return;

  const { failed } = await removeObjects(unique);
  if (failed.length > 0) await enqueueFailures(failed);
}
