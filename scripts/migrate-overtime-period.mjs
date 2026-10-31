import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migration = {
  id: "027_overtime_period",
  file: "../db/migrations/027_overtime_period.sql",
  label: "periode akumulasi lembur",
};

async function probe(startDay) {
  await connection.query("SAVEPOINT overtime_period_probe");
  try {
    await connection.query(
      "UPDATE policies SET overtime_period_start_day=$1 WHERE id='policy'",
      [startDay],
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error.code };
  } finally {
    await connection.query("ROLLBACK TO SAVEPOINT overtime_period_probe");
    await connection.query("RELEASE SAVEPOINT overtime_period_probe");
  }
}

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
      await connection.query("SELECT count(*)::integer total FROM policies")
    ).rows;
    await connection.query(
      await readFile(new URL(migration.file, import.meta.url), "utf8"),
    );
    const [after] = (
      await connection.query("SELECT count(*)::integer total FROM policies")
    ).rows;
    assert.equal(after.total, before.total, "Baris kebijakan lama berubah.");

    const column = (
      await connection.query(
        `SELECT is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema='public' AND table_name='policies'
           AND column_name='overtime_period_start_day'`,
      )
    ).rows[0];
    assert(column, "Kolom overtime_period_start_day tidak ditemukan.");
    assert.equal(column.is_nullable, "NO", "Kolom baru harus NOT NULL.");
    assert(
      String(column.column_default).includes("1"),
      "Default periode harus 1 (bulan kalender).",
    );

    const constraint = (
      await connection.query(
        `SELECT pg_get_constraintdef(oid) definition
         FROM pg_constraint
         WHERE conrelid='policies'::regclass
           AND conname='policies_overtime_period_start_day_check'`,
      )
    ).rows[0];
    assert(constraint, "Constraint periode lembur tidak ditemukan.");
    assert(
      /1/.test(constraint.definition) && /31/.test(constraint.definition),
      "Constraint harus membatasi tanggal 1 sampai 31.",
    );

    const [policy] = (
      await connection.query(
        "SELECT overtime_period_start_day FROM policies WHERE id='policy'",
      )
    ).rows;
    assert(policy, "Kebijakan belum tersedia.");
    assert(
      policy.overtime_period_start_day >= 1 &&
        policy.overtime_period_start_day <= 31,
      "Tanggal mulai periode kebijakan saat ini di luar rentang 1-31.",
    );

    const accepted = await probe(31);
    assert(accepted.ok, "Tanggal 31 seharusnya diterima constraint.");
    const rejected = await probe(0);
    assert.equal(
      rejected.code,
      "23514",
      "Tanggal 0 seharusnya ditolak constraint.",
    );

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          policyRowsPreserved: true,
          overtimePeriodStartDay: policy.overtime_period_start_day,
          allowed: [1, 31],
        }),
      ],
    );
    console.log(
      `Migrasi ${migration.label} selesai. Tanggal mulai aktif: ${policy.overtime_period_start_day}.`,
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
