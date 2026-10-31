import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migration = {
  id: "024_checklist_item_locations",
  file: "../db/migrations/024_checklist_item_locations.sql",
  label: "lokasi item dan paket checklist",
  tables: [
    "checklist_template_items",
    "checklist_schedules",
    "checklist_inspection_packages",
    "checklist_inspections",
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

    const [columns] = (
      await connection.query(
        `SELECT count(*)::integer total FROM information_schema.columns
         WHERE (table_name='checklist_template_items' AND column_name='location_id')
            OR (table_name='checklist_schedules' AND column_name='distribution_mode')
            OR (table_name='checklist_inspections' AND column_name='package_id')`,
      )
    ).rows;
    assert.equal(columns.total, 3, "Kolom lokasi item belum lengkap.");

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          auditRowsPreserved: true,
          defaultDistributionMode: "tunggal",
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
