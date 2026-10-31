import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migration = {
  id: "028_checklist_schedule_windows",
  file: "../db/migrations/028_checklist_schedule_windows.sql",
  label: "hari dan jam jadwal checklist",
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
      await connection.query("SELECT count(*)::integer total FROM checklist_schedules")
    ).rows;
    await connection.query(
      await readFile(new URL(migration.file, import.meta.url), "utf8"),
    );
    const [after] = (
      await connection.query("SELECT count(*)::integer total FROM checklist_schedules")
    ).rows;
    assert.equal(after.total, before.total, "Jadwal lama berubah.");

    const [missingRows] = (
      await connection.query(
        `SELECT count(*)::integer total
         FROM checklist_schedules s
         WHERE (SELECT count(*) FROM checklist_schedule_days d WHERE d.schedule_id=s.id) <> 7`,
      )
    ).rows;
    assert.equal(
      missingRows.total,
      0,
      "Setiap jadwal harus memiliki tujuh baris pengaturan hari.",
    );

    const column = (
      await connection.query(
        `SELECT is_nullable
         FROM information_schema.columns
         WHERE table_schema='public' AND table_name='checklist_inspections'
           AND column_name='opens_at'`,
      )
    ).rows[0];
    assert(column, "Kolom opens_at tidak ditemukan.");
    assert.equal(column.is_nullable, "NO", "Kolom opens_at harus NOT NULL.");

    if (before.total > 0) {
      await connection.query("SAVEPOINT checklist_windows_probe");
      try {
        await connection.query(
          `UPDATE checklist_schedule_days
           SET start_time='09:00', end_time='08:00'
           WHERE schedule_id=(SELECT id FROM checklist_schedules ORDER BY id LIMIT 1)
             AND weekday=1`,
        );
        assert.fail("Jam selesai sebelum mulai seharusnya ditolak.");
      } catch (error) {
        if (error?.code !== "23514") throw error;
      } finally {
        await connection.query("ROLLBACK TO SAVEPOINT checklist_windows_probe");
        await connection.query("RELEASE SAVEPOINT checklist_windows_probe");
      }
    }

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          schedulesPreserved: before.total,
          defaultWeekdays: 7,
          defaultWindow: "00:00-23:59",
          opensAtBackfilled: true,
        }),
      ],
    );
    console.log(
      `Migrasi ${migration.label} selesai. ${before.total} jadwal tetap utuh; hari default 00:00-23:59.`,
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
