import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migration = {
  id: "022_video_and_folders",
  file: "../db/migrations/022_video_and_folders.sql",
  label: "video dokumentasi dan folder dokumen kerja",
  tables: [
    "documentations",
    "checklist_photos",
    "manual_work_photos",
    "photo_limit_settings",
    "work_document_settings",
    "work_documents",
    "work_document_folders",
    "work_document_folder_shares",
  ],
};

const VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];

try {
  await connection.query("BEGIN");
  await connection.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('migration:relational',0))",
  );

  const existing = (
    await connection.query(
      "SELECT verification FROM schema_migrations WHERE id=$1",
      [migration.id],
    )
  ).rows[0];
  if (existing) {
    console.log(`Migrasi ${migration.label} sudah pernah diterapkan.`);
  } else {
    const [before] = (
      await connection.query("SELECT count(*)::integer total FROM audit_logs")
    ).rows;
    await connection.query(
      await readFile(new URL(migration.file, import.meta.url), "utf8"),
    );
    const [after] = (
      await connection.query("SELECT count(*)::integer total FROM audit_logs")
    ).rows;
    assert.equal(after.total, before.total, "Baris audit lama berubah.");

    const counts = {};
    for (const table of migration.tables) {
      const [row] = (
        await connection.query(`SELECT count(*)::integer count FROM ${table}`)
      ).rows;
      counts[table] = row.count;
    }

    for (const table of ["documentations", "checklist_photos", "manual_work_photos"]) {
      const { rows } = await connection.query(
        `SELECT mime_type FROM ${table} WHERE mime_type = ANY($1::text[]) LIMIT 1`,
        [VIDEO_MIME],
      );
      assert.equal(rows.length, 0, `${table} sudah berisi video sebelum migrasi.`);
      const [column] = (
        await connection.query(
          "SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='kind'",
          [table],
        )
      ).rows;
      assert(column, `Kolom kind belum ada di ${table}.`);
    }

    const [media] = (
      await connection.query(
        "SELECT video_enabled, max_video_bytes, spkl_videos, checklist_videos, work_videos FROM photo_limit_settings WHERE id='settings'",
      )
    ).rows;
    assert(media, "Pengaturan batas dokumentasi tidak terbentuk.");
    assert.equal(media.video_enabled, true, "Video tidak aktif secara default.");
    assert.equal(Number(media.max_video_bytes), 52428800, "Batas video awal berubah.");

    const [docs] = (
      await connection.query(
        "SELECT max_video_bytes, allowed_extensions FROM work_document_settings WHERE id='settings'",
      )
    ).rows;
    assert(docs, "Pengaturan dokumen kerja tidak terbentuk.");
    assert.equal(Number(docs.max_video_bytes), 104857600, "Batas video dokumen berubah.");
    assert(docs.allowed_extensions.includes("mp4"), "MP4 belum diizinkan.");

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [migration.id, JSON.stringify({ auditRowsPreserved: true, counts })],
    );
    console.log(
      `Migrasi ${migration.label} selesai. ${before.total} baris audit lama tetap identik.`,
    );
  }

  await connection.query("COMMIT");
} catch (error) {
  await connection.query("ROLLBACK");
  throw error;
} finally {
  connection.release();
  await pool.end();
}
