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
  id: "039_overtime_rounding",
  file: "../db/migrations/039_overtime_rounding.sql",
  label: "kebijakan pembulatan jam lembur",
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

    const { rows: columns } = await connection.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='policies'`,
    );
    const names = new Set(columns.map((row) => row.column_name));
    for (const column of [
      "overtime_rounding_enabled",
      "overtime_rounding_tolerance_minutes",
      "overtime_rounding_effective_month",
    ]) {
      assert(names.has(column), `Kolom policies.${column} tidak ada.`);
    }

    const { rows: functions } = await connection.query(
      `SELECT pg_get_functiondef(oid) definition
       FROM pg_proc
       WHERE proname='overtime_payable_minutes'`,
    );
    assert.equal(
      functions.length,
      1,
      "Fungsi overtime_payable_minutes tidak ditemukan.",
    );
    assert(
      functions[0].definition.includes("overtime_rounding_effective_month"),
      "Fungsi overtime_payable_minutes tidak memakai kebijakan pembulatan.",
    );

    const [policy] = (
      await connection.query(
        `SELECT overtime_rounding_enabled,
                overtime_rounding_tolerance_minutes,
                overtime_rounding_effective_month::text
         FROM policies WHERE id='policy'`,
      )
    ).rows;
    assert(policy, "Kebijakan utama tidak ditemukan.");
    assert.equal(policy.overtime_rounding_enabled, true);
    assert.equal(policy.overtime_rounding_tolerance_minutes, 30);
    assert.match(policy.overtime_rounding_effective_month, /^\d{4}-\d{2}-01$/);

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          columns: [
            "overtime_rounding_enabled",
            "overtime_rounding_tolerance_minutes",
            "overtime_rounding_effective_month",
          ],
          toleranceMinutes: 30,
          effectiveMonth: policy.overtime_rounding_effective_month,
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
