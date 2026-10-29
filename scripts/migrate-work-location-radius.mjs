import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migration = {
  id: "016_work_location_radius",
  file: "../db/migrations/016_work_location_radius.sql",
  label: "radius titik absensi",
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
    const [spklBefore] = (
      await connection.query("SELECT count(*)::integer total FROM spkls")
    ).rows;
    await connection.query(
      await readFile(new URL(migration.file, import.meta.url), "utf8"),
    );
    const [after] = (
      await connection.query("SELECT count(*)::integer total FROM audit_logs")
    ).rows;
    const [spklAfter] = (
      await connection.query("SELECT count(*)::integer total FROM spkls")
    ).rows;
    assert.equal(after.total, before.total, "Baris audit lama berubah.");
    assert.equal(spklAfter.total, spklBefore.total, "Baris SPKL lama berubah.");

    const [column] = (
      await connection.query(
        `SELECT count(*)::integer total
         FROM information_schema.columns
         WHERE table_name='work_locations' AND column_name='radius_meters'`,
      )
    ).rows;
    assert.equal(column.total, 1, "Kolom radius_meters tidak tersedia.");

    const [invalid] = (
      await connection.query(
        `SELECT count(*)::integer total FROM work_locations
         WHERE radius_meters IS NULL
            OR radius_meters < 25 OR radius_meters > 1000`,
      )
    ).rows;
    assert.equal(invalid.total, 0, "Ada radius titik absensi di luar batas.");

    const [locations] = (
      await connection.query(
        "SELECT count(*)::integer total FROM work_locations",
      )
    ).rows;
    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          auditRowsPreserved: true,
          spklRowsPreserved: true,
          locations: locations.total,
        }),
      ],
    );
    console.log(
      `Migrasi ${migration.label} selesai. ${locations.total} titik memiliki radius; ${before.total} baris audit lama tetap identik.`,
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
