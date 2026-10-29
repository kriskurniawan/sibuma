import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migrations = [
  {
    id: "004_checklists",
    file: "../db/migrations/004_checklists.sql",
    label: "checklist",
    tables: [
      "checklist_locations",
      "checklist_templates",
      "checklist_template_versions",
      "checklist_template_items",
      "checklist_schedules",
      "checklist_schedule_assignees",
      "checklist_inspections",
      "checklist_inspection_assignees",
      "checklist_answers",
      "checklist_follow_ups",
      "checklist_follow_up_events",
      "checklist_photos",
    ],
  },
  {
    id: "005_checklist_public",
    file: "../db/migrations/005_checklist_public.sql",
    label: "QR publik checklist",
    tables: ["checklist_qr_codes"],
  },
  {
    id: "006_checklist_item_groups",
    file: "../db/migrations/006_checklist_item_groups.sql",
    label: "grup item checklist",
    tables: ["checklist_template_items", "checklist_answers"],
  },
  {
    id: "008_checklist_conditions",
    file: "../db/migrations/008_checklist_conditions.sql",
    label: "status checklist",
    tables: ["checklist_conditions", "checklist_answers"],
  },
];

try {
  await connection.query("BEGIN");
  await connection.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('migration:relational',0))",
  );

  for (const migration of migrations) {
    const existing = (
      await connection.query(
        "SELECT verification FROM schema_migrations WHERE id=$1",
        [migration.id],
      )
    ).rows[0];
    if (existing) {
      console.log(`Migrasi ${migration.label} sudah pernah diterapkan.`);
      continue;
    }

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
