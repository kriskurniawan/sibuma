import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

const migration = {
  id: "026_policy_timezone",
  file: "../db/migrations/026_policy_timezone.sql",
  label: "zona waktu kebijakan",
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
      await connection.query("SELECT count(*)::integer total FROM policies")
    ).rows;
    await connection.query(
      await readFile(new URL(migration.file, import.meta.url), "utf8"),
    );
    const [after] = (
      await connection.query("SELECT count(*)::integer total FROM policies")
    ).rows;
    assert.equal(after.total, before.total, "Baris kebijakan lama berubah.");

    const constraint = (
      await connection.query(
        `SELECT pg_get_constraintdef(oid) definition
         FROM pg_constraint
         WHERE conrelid='policies'::regclass
           AND conname='policies_timezone_check'`,
      )
    ).rows[0];
    assert(constraint, "Constraint policies_timezone_check tidak ditemukan.");
    for (const zone of ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]) {
      assert(
        constraint.definition.includes(zone),
        `Constraint belum menerima ${zone}.`,
      );
    }

    const [policy] = (
      await connection.query("SELECT timezone FROM policies WHERE id='policy'")
    ).rows;
    assert(policy, "Kebijakan belum tersedia.");
    assert(
      ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"].includes(
        policy.timezone,
      ),
      "Zona waktu kebijakan saat ini di luar allowlist.",
    );

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          policyRowsPreserved: true,
          timezone: policy.timezone,
          allowed: ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"],
        }),
      ],
    );
    console.log(
      `Migrasi ${migration.label} selesai. Zona aktif: ${policy.timezone}.`,
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
