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
  id: "037_overtime_recap",
  file: "../db/migrations/037_overtime_recap.sql",
  label: "data penggajian dan rekap lembur bulanan",
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

    const { rows: tables } = await connection.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public'
         AND table_name=ANY($1::text[])
       ORDER BY table_name`,
      [["employee_payrolls", "national_holidays", "team_report_signers"]],
    );
    assert.deepEqual(
      tables.map((row) => row.table_name),
      ["employee_payrolls", "national_holidays", "team_report_signers"],
      "Tabel rekap lembur tidak lengkap.",
    );

    const { rows: payrollColumns } = await connection.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='employee_payrolls'`,
    );
    const payrollNames = new Set(
      payrollColumns.map((row) => row.column_name),
    );
    for (const column of [
      "employee_id",
      "effective_month",
      "job_title",
      "basic_salary",
      "updated_by",
      "updated_at",
    ]) {
      assert(
        payrollNames.has(column),
        `Kolom employee_payrolls.${column} tidak ada.`,
      );
    }

    const { rows: signerColumns } = await connection.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='team_report_signers'`,
    );
    const signerNames = new Set(signerColumns.map((row) => row.column_name));
    for (const column of [
      "owner_id",
      "building_manager_name",
      "manager_name",
      "updated_by",
      "updated_at",
    ]) {
      assert(
        signerNames.has(column),
        `Kolom team_report_signers.${column} tidak ada.`,
      );
    }

    const { rows: payrollKey } = await connection.query(
      `SELECT pg_get_constraintdef(oid) definition
       FROM pg_constraint
       WHERE conrelid='employee_payrolls'::regclass
         AND contype='p'`,
    );
    assert(
      payrollKey[0]?.definition.includes("employee_id") &&
        payrollKey[0]?.definition.includes("effective_month"),
      "Primary key employee_payrolls tidak sesuai.",
    );

    const { rows: holidayRows } = await connection.query(
      `SELECT extract(year FROM holiday_date)::integer AS year,
              count(*)::integer AS total
       FROM national_holidays
       WHERE extract(year FROM holiday_date) IN (2025, 2026)
       GROUP BY 1 ORDER BY 1`,
    );
    assert.equal(
      holidayRows.find((row) => row.year === 2025)?.total,
      17,
      "Libur nasional 2025 belum lengkap.",
    );
    assert.equal(
      holidayRows.find((row) => row.year === 2026)?.total,
      17,
      "Libur nasional 2026 belum lengkap.",
    );

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          tables: [
            "employee_payrolls",
            "team_report_signers",
            "national_holidays",
          ],
          payrollKey: ["employee_id", "effective_month"],
          holidays: { 2025: 17, 2026: 17 },
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
