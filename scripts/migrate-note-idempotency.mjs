import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");

const dryRun = !process.argv.includes("--apply");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15000,
});
const connection = await pool.connect();

const migration = {
  id: "033_note_idempotency_cleanup",
  file: "../db/migrations/033_note_idempotency_cleanup.sql",
  label: "idempotensi catatan dan antrean pembersihan storage",
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
    await connection.query(
      await readFile(new URL(migration.file, import.meta.url), "utf8"),
    );

    const { rows: columns } = await connection.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='notes'`,
    );
    const names = new Set(columns.map((row) => row.column_name));
    assert(
      names.has("client_request_id"),
      "Kolom notes.client_request_id tidak ditemukan.",
    );

    const { rows: indexes } = await connection.query(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname='public' AND tablename='notes'`,
    );
    assert(
      indexes.some((row) => row.indexname === "notes_client_request_unique"),
      "Indeks idempotensi catatan tidak ditemukan.",
    );

    const { rows: tables } = await connection.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name='storage_cleanup_queue'`,
    );
    assert.equal(
      tables.length,
      1,
      "Tabel storage_cleanup_queue tidak ditemukan.",
    );

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          table: "notes",
          column: "client_request_id",
          uniqueIndex: "notes_client_request_unique",
          cleanupTable: "storage_cleanup_queue",
        }),
      ],
    );
    console.log(`Migrasi ${migration.label} selesai.`);
  }

  if (dryRun) {
    await connection.query("ROLLBACK");
    console.log("Mode dry-run: perubahan dibatalkan. Gunakan --apply untuk menyimpan.");
  } else {
    await connection.query("COMMIT");
    console.log("Perubahan disimpan.");
  }
} catch (error) {
  await connection.query("ROLLBACK");
  throw error;
} finally {
  connection.release();
  await pool.end();
}
