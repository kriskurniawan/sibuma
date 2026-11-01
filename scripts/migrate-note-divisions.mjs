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
  id: "031_note_divisions",
  file: "../db/migrations/031_note_divisions.sql",
  label: "penerima catatan lintas divisi",
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

    const { rows: tables } = await connection.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name='note_divisions'`,
    );
    assert.equal(tables.length, 1, "Tabel note_divisions tidak ditemukan.");

    const { rows: columns } = await connection.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='note_divisions'`,
    );
    const names = new Set(columns.map((row) => row.column_name));
    for (const column of ["note_id", "division_id", "division_name"]) {
      assert(names.has(column), `Kolom note_divisions.${column} tidak ada.`);
    }

    const { rows: audienceConstraint } = await connection.query(
      `SELECT pg_get_constraintdef(oid) definition
       FROM pg_constraint
       WHERE conrelid='notes'::regclass
         AND conname='notes_audience_type_check'`,
    );
    assert(audienceConstraint[0], "Constraint jenis penerima tidak ditemukan.");
    for (const value of ["division", "divisions", "employees"]) {
      assert(
        audienceConstraint[0].definition.includes(value),
        `Constraint jenis penerima belum menerima ${value}.`,
      );
    }

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          table: "note_divisions",
          audiences: ["division", "divisions", "employees"],
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
