import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migration = {
  id: "012_manual_works",
  file: "../db/migrations/012_manual_works.sql",
  label: "pekerjaan harian",
  tables: [
    "manual_works",
    "manual_work_assignees",
    "manual_work_photos",
    "manual_work_events",
  ],
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
