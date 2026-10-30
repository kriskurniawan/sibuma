import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migration = {
  id: "023_document_share_targets",
  file: "../db/migrations/023_document_share_targets.sql",
  label: "target berbagi dokumen kerja",
  tables: [
    "work_document_share_targets",
    "work_document_folder_share_targets",
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

    for (const table of migration.tables) {
      const columns = (
        await connection.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_name=$1 AND column_name=ANY($2::text[])`,
          [table, ["audience", "target_id", "created_by", "created_at"]],
        )
      ).rows.map((row) => row.column_name);
      assert.equal(
        columns.length,
        4,
        `Kolom target berbagi belum lengkap di ${table}.`,
      );
    }

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          auditRowsPreserved: true,
          legacySharesPreserved: true,
          counts,
        }),
      ],
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
