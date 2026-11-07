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
  id: "040_saturday_piket",
  file: "../db/migrations/040_saturday_piket.sql",
  label: "piket hari Sabtu",
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
       WHERE table_schema='public' AND table_name='attendances'`,
    );
    assert(
      columns.some((row) => row.column_name === "piket_start_at"),
      "Kolom attendances.piket_start_at tidak ada.",
    );

    const { rows: functions } = await connection.query(
      `SELECT pg_get_function_identity_arguments(oid) arguments,
              pg_get_functiondef(oid) definition
       FROM pg_proc
       WHERE proname='overtime_payable_minutes'`,
    );
    assert.equal(
      functions.length,
      1,
      "Fungsi overtime_payable_minutes harus memiliki satu signature.",
    );
    assert(
      functions[0].arguments.includes("p_piket_start_at"),
      "Fungsi overtime_payable_minutes belum menerima batas piket.",
    );
    assert(
      functions[0].definition.includes("v_scheduled_start"),
      "Fungsi overtime_payable_minutes belum memakai batas piket.",
    );

    const [piket] = (
      await connection.query(
        `SELECT overtime_payable_minutes(
           NULL,'selesai',
           '2026-11-07T08:00:00+07'::timestamptz,
           '2026-11-07T17:00:00+07'::timestamptz,
           '2026-11-07T12:00:00+07'::timestamptz,
           '2026-11-07T08:00:00+07'::timestamptz,
           '2026-11-07T17:00:00+07'::timestamptz,
           '2026-11-07'::date,NULL,now()
         ) AS minutes`,
      )
    ).rows;
    assert.equal(
      Number(piket.minutes),
      300,
      "Piket Sabtu harus dihitung mulai pukul 12.00.",
    );

    const [normal] = (
      await connection.query(
        `SELECT overtime_payable_minutes(
           NULL,'selesai',
           '2026-11-07T08:00:00+07'::timestamptz,
           '2026-11-07T17:00:00+07'::timestamptz,
           NULL,
           '2026-11-07T08:00:00+07'::timestamptz,
           '2026-11-07T17:00:00+07'::timestamptz,
           '2026-11-07'::date,NULL,now()
         ) AS minutes`,
      )
    ).rows;
    assert.equal(
      Number(normal.minutes),
      540,
      "Sesi biasa tanpa piket tidak boleh berubah.",
    );

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          column: "attendances.piket_start_at",
          function: "overtime_payable_minutes",
          piketMinutes: 300,
          normalMinutes: 540,
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
