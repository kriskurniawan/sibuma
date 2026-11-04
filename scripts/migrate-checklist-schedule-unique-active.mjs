import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migration = {
  id: "036_checklist_schedule_unique_active",
  file: "../db/migrations/036_checklist_schedule_unique_active.sql",
  label: "jadwal checklist aktif unik",
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
    const duplicates = await connection.query(
      `SELECT owner_id, template_id, location_id, interval_unit, interval_count,
              count(*)::integer AS total, array_agg(id ORDER BY created_at) AS ids
         FROM checklist_schedules
        WHERE active
        GROUP BY owner_id, template_id, location_id, interval_unit, interval_count
       HAVING count(*) > 1`,
    );
    assert.equal(
      duplicates.rows.length,
      0,
      `Masih ada ${duplicates.rows.length} kombinasi jadwal aktif duplikat. Nonaktifkan salah satunya terlebih dahulu.`,
    );

    const [before] = (
      await connection.query(
        "SELECT count(*)::integer total FROM checklist_schedules",
      )
    ).rows;
    await connection.query(
      await readFile(new URL(migration.file, import.meta.url), "utf8"),
    );

    const index = (
      await connection.query(
        `SELECT indexdef FROM pg_indexes
          WHERE schemaname='public' AND indexname='checklist_schedules_active_unique'`,
      )
    ).rows[0];
    assert(index, "Indeks jadwal aktif unik tidak ditemukan.");
    assert.match(index.indexdef, /UNIQUE INDEX/i, "Indeks harus unik.");
    assert.match(
      index.indexdef,
      /WHERE active/i,
      "Indeks harus parsial untuk jadwal aktif.",
    );

    const [after] = (
      await connection.query(
        "SELECT count(*)::integer total FROM checklist_schedules",
      )
    ).rows;
    assert.equal(after.total, before.total, "Jumlah jadwal berubah.");

    const probe = (
      await connection.query(
        "SELECT * FROM checklist_schedules WHERE active ORDER BY id LIMIT 1",
      )
    ).rows[0];
    if (probe) {
      await connection.query("SAVEPOINT checklist_schedule_unique_probe");
      try {
        await connection.query(
          `INSERT INTO checklist_schedules
             (id,owner_id,template_id,location_id,distribution_mode,interval_unit,
              interval_count,anchor_date,due_days,active,created_by,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,now(),now())`,
          [
            `cs_unique_probe_${Date.now()}`,
            probe.owner_id,
            probe.template_id,
            probe.location_id,
            probe.distribution_mode,
            probe.interval_unit,
            probe.interval_count,
            probe.anchor_date,
            probe.due_days,
            probe.created_by,
          ],
        );
        assert.fail("Jadwal aktif duplikat seharusnya ditolak.");
      } catch (error) {
        if (error?.code !== "23505") throw error;
      } finally {
        await connection.query(
          "ROLLBACK TO SAVEPOINT checklist_schedule_unique_probe",
        );
        await connection.query("RELEASE SAVEPOINT checklist_schedule_unique_probe");
      }
    }

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          schedulesPreserved: before.total,
          activeDuplicateGroups: 0,
          partialUniqueIndex: true,
        }),
      ],
    );
    console.log(
      `Migrasi ${migration.label} selesai. ${before.total} jadwal tetap utuh.`,
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
