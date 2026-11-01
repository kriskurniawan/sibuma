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
  id: "030_notes",
  file: "../db/migrations/030_notes.sql",
  label: "catatan dan lampiran foto",
};

const expectedTables = ["notes", "note_recipients", "note_attachments"];

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
       WHERE table_schema='public' AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [expectedTables],
    );
    assert.deepEqual(
      tables.map((row) => row.table_name),
      [...expectedTables].sort(),
      "Tabel catatan tidak lengkap.",
    );

    const { rows: columns } = await connection.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='notes'`,
    );
    const names = new Set(columns.map((row) => row.column_name));
    for (const column of [
      "id",
      "author_id",
      "author_name",
      "title",
      "body",
      "audience_type",
      "division_id",
      "division_name",
      "created_at",
      "updated_at",
    ]) {
      assert(names.has(column), `Kolom notes.${column} tidak ada.`);
    }

    const { rows: audienceConstraint } = await connection.query(
      `SELECT pg_get_constraintdef(oid) definition
       FROM pg_constraint
       WHERE conrelid='notes'::regclass
         AND conname='notes_audience_type_check'`,
    );
    assert(audienceConstraint[0], "Constraint jenis penerima tidak ditemukan.");
    for (const value of ["division", "employees"]) {
      assert(
        audienceConstraint[0].definition.includes(value),
        `Constraint jenis penerima belum menerima ${value}.`,
      );
    }

    const { rows: auditConstraint } = await connection.query(
      `SELECT pg_get_constraintdef(oid) definition
       FROM pg_constraint
       WHERE conrelid='audit_logs'::regclass
         AND conname='audit_logs_object_type_check'`,
    );
    assert(auditConstraint[0], "Constraint tipe objek audit tidak ditemukan.");
    assert(
      auditConstraint[0].definition.includes("catatan"),
      "Constraint audit belum menerima catatan.",
    );

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          tables: expectedTables,
          audiences: ["division", "employees"],
          auditObjectType: "catatan",
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
