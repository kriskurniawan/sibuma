import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");

const dryRun = process.argv.includes("--dry-run");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15000,
});
const connection = await pool.connect();

const migration = {
  id: "032_note_photos",
  file: "../db/migrations/032_note_photos.sql",
  label: "foto catatan lebih dari satu",
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
       WHERE table_name='note_attachments'`,
    );
    const names = new Set(columns.map((row) => row.column_name));
    for (const column of ["id", "note_id", "sort_order", "storage_key"]) {
      assert(names.has(column), `Kolom note_attachments.${column} tidak ada.`);
    }

    const { rows: primaryKey } = await connection.query(
      `SELECT a.attname
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.conrelid='note_attachments'::regclass AND c.contype='p'`,
    );
    assert.deepEqual(
      primaryKey.map((row) => row.attname),
      ["id"],
      "Primary key note_attachments harus memakai id.",
    );

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          table: "note_attachments",
          primaryKey: "id",
          columns: ["sort_order"],
        }),
      ],
    );
    console.log(`Migrasi ${migration.label} selesai.`);
  }

  if (dryRun) {
    await connection.query("ROLLBACK");
    console.log("Mode dry-run: perubahan dibatalkan.");
  } else {
    await connection.query("COMMIT");
  }
} catch (error) {
  await connection.query("ROLLBACK");
  throw error;
} finally {
  connection.release();
  await pool.end();
}
