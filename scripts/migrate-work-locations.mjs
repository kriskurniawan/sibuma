import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migration = {
  id: "013_work_locations",
  file: "../db/migrations/013_work_locations.sql",
  label: "titik lokasi absensi",
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

    const [locations] = (
      await connection.query(
        "SELECT count(*)::integer total, count(*) FILTER (WHERE active)::integer active FROM work_locations",
      )
    ).rows;
    assert(locations.total > 0, "Titik absensi default gagal dibuat.");
    assert(locations.active > 0, "Tidak ada titik absensi aktif.");

    const [linked] = (
      await connection.query(
        "SELECT count(*)::integer total, count(work_location_id)::integer linked FROM spkls",
      )
    ).rows;

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          auditRowsPreserved: true,
          locations: locations.total,
          activeLocations: locations.active,
          spkls: linked.total,
          linkedSpkls: linked.linked,
        }),
      ],
    );
    console.log(
      `Migrasi ${migration.label} selesai. ${locations.total} titik tersedia (${locations.active} aktif); ${linked.linked}/${linked.total} SPKL lama tertaut. ${before.total} baris audit lama tetap identik.`,
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
