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
  id: "038_checklist_equipment",
  file: "../db/migrations/038_checklist_equipment.sql",
  label: "peralatan checklist dan riwayat perawatan",
};

const expectedTables = {
  checklist_equipment: [
    "id",
    "owner_id",
    "location_id",
    "code",
    "name",
    "category",
    "public_enabled",
    "active",
    "created_by",
    "created_at",
    "updated_at",
  ],
  checklist_equipment_maintenance: [
    "id",
    "equipment_id",
    "owner_id",
    "activity",
    "component",
    "quantity",
    "unit",
    "hour_meter",
    "performed_date",
    "performed_by",
    "description",
    "public_visible",
    "created_by",
    "created_at",
    "updated_at",
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
    await connection.query(
      await readFile(new URL(migration.file, import.meta.url), "utf8"),
    );

    for (const [table, expectedColumns] of Object.entries(expectedTables)) {
      const { rows: tables } = await connection.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema='public' AND table_name=$1`,
        [table],
      );
      assert.equal(
        tables[0]?.table_name,
        table,
        `Tabel ${table} tidak ditemukan.`,
      );

      const { rows: columns } = await connection.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1`,
        [table],
      );
      const names = new Set(columns.map((row) => row.column_name));
      for (const column of expectedColumns) {
        assert(names.has(column), `Kolom ${table}.${column} tidak ada.`);
      }
    }

    const { rows: codeIndex } = await connection.query(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname='public' AND tablename='checklist_equipment'
         AND indexname='checklist_equipment_code'`,
    );
    assert(codeIndex[0], "Indeks kode peralatan tidak ditemukan.");

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          tables: Object.keys(expectedTables),
          uniqueCode: ["owner_id", "lower(code)"],
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
