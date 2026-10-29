import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migration = {
  id: "018_follow_up_safety",
  file: "../db/migrations/018_follow_up_safety.sql",
  label: "Petugas safety tindak lanjut",
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
    const [followUpsBefore] = (
      await connection.query(
        "SELECT count(*)::integer total FROM checklist_follow_ups",
      )
    ).rows;
    await connection.query(
      await readFile(new URL(migration.file, import.meta.url), "utf8"),
    );
    const [after] = (
      await connection.query("SELECT count(*)::integer total FROM audit_logs")
    ).rows;
    const [followUpsAfter] = (
      await connection.query(
        "SELECT count(*)::integer total FROM checklist_follow_ups",
      )
    ).rows;
    assert.equal(after.total, before.total, "Baris audit lama berubah.");
    assert.equal(
      followUpsAfter.total,
      followUpsBefore.total,
      "Baris tindak lanjut lama berubah.",
    );

    const [column] = (
      await connection.query(
        `SELECT count(*)::integer total
         FROM information_schema.columns
         WHERE table_schema=current_schema()
           AND table_name='checklist_follow_ups'
           AND column_name='safety_name'`,
      )
    ).rows;
    assert.equal(column.total, 1, "Kolom safety_name tidak tersedia.");

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          auditRowsPreserved: true,
          followUpRowsPreserved: true,
          followUps: followUpsAfter.total,
        }),
      ],
    );
    console.log(
      `Migrasi ${migration.label} selesai. ${followUpsAfter.total} tindak lanjut lama tetap identik.`,
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
