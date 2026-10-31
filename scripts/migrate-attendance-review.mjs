import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migration = {
  id: "024_attendance_review",
  file: "../db/migrations/024_attendance_review.sql",
  label: "persetujuan sesi absensi yang ditutup otomatis",
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
    const [attendancesBefore] = (
      await connection.query(
        "SELECT count(*)::integer total FROM attendances",
      )
    ).rows;
    await connection.query(
      await readFile(new URL(migration.file, import.meta.url), "utf8"),
    );
    const [after] = (
      await connection.query("SELECT count(*)::integer total FROM audit_logs")
    ).rows;
    const [attendancesAfter] = (
      await connection.query(
        "SELECT count(*)::integer total FROM attendances",
      )
    ).rows;
    assert.equal(after.total, before.total, "Baris audit lama berubah.");
    assert.equal(
      attendancesAfter.total,
      attendancesBefore.total,
      "Baris absensi lama berubah.",
    );

    const columns = (
      await connection.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema=current_schema()
           AND table_name='attendances'
           AND column_name IN ('reviewed_at','reviewed_by')
         ORDER BY column_name`,
      )
    ).rows.map((row) => row.column_name);
    assert.deepEqual(columns, ["reviewed_at", "reviewed_by"]);

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          auditRowsPreserved: true,
          attendanceRowsPreserved: true,
          attendances: attendancesAfter.total,
        }),
      ],
    );
    console.log(
      `Migrasi ${migration.label} selesai. ${attendancesAfter.total} absensi lama tetap identik.`,
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
