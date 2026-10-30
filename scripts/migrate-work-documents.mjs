import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migration = {
  id: "020_work_documents",
  file: "../db/migrations/020_work_documents.sql",
  label: "dokumen kerja",
  tables: ["work_document_settings", "work_documents", "work_document_shares"],
};

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
    const [settings] = (
      await connection.query(
        "SELECT uploads_enabled, max_file_bytes, quota_bytes FROM work_document_settings WHERE id='settings'",
      )
    ).rows;
    assert(settings, "Pengaturan dokumen kerja tidak terbentuk.");

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [migration.id, JSON.stringify({ auditRowsPreserved: true, counts })],
    );
    console.log(
      `Migrasi ${migration.label} selesai. ${migration.tables.length} tabel tersedia; ${before.total} baris audit lama tetap identik.`,
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
