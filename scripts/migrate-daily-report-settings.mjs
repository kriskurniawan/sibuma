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
  id: "035_daily_report_settings",
  file: "../db/migrations/035_daily_report_settings.sql",
  label: "judul dan catatan laporan harian",
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
       WHERE table_schema='public' AND table_name='daily_report_settings'`,
    );
    assert.equal(
      tables[0]?.table_name,
      "daily_report_settings",
      "Tabel pengaturan laporan harian tidak ditemukan.",
    );

    const { rows: columns } = await connection.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='daily_report_settings'`,
    );
    const names = new Set(columns.map((row) => row.column_name));
    for (const column of [
      "owner_id",
      "report_date",
      "title",
      "notes",
      "updated_by",
      "updated_at",
    ]) {
      assert(names.has(column), `Kolom daily_report_settings.${column} tidak ada.`);
    }

    const { rows: primaryKey } = await connection.query(
      `SELECT pg_get_constraintdef(oid) definition
       FROM pg_constraint
       WHERE conrelid='daily_report_settings'::regclass
         AND contype='p'`,
    );
    assert(primaryKey[0], "Primary key pengaturan laporan harian tidak ditemukan.");
    for (const column of ["owner_id", "report_date"]) {
      assert(
        primaryKey[0].definition.includes(column),
        `Primary key belum memuat ${column}.`,
      );
    }

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          table: "daily_report_settings",
          primaryKey: ["owner_id", "report_date"],
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
