import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();
try {
  await connection.query("BEGIN");
  await connection.query("SELECT pg_advisory_xact_lock(hashtextextended('migration:relational',0))");
  const snapshot = async () => {
    const tables = ["employees", "divisions", "spkls", "spkl_workers", "attendances", "documentations", "policies", "otp_records", "notification_logs", "audit_logs"];
    const result = {};
    for (const table of tables) {
      const columns = (await connection.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position", [table])).rows.map(row => row.column_name);
      result[table] = { columns, rows: (await connection.query(`SELECT ${columns.map(c => `"${c}"`).join(",")} FROM ${table} ORDER BY 1,2`)).rows };
    }
    return result;
  };
  const before = await snapshot();
  await connection.query(await readFile(new URL("../db/migrations/003_employee_email_otp.sql", import.meta.url), "utf8"));
  for (const [table, value] of Object.entries(before)) {
    const rows = (await connection.query(`SELECT ${value.columns.map(c => `"${c}"`).join(",")} FROM ${table} ORDER BY 1,2`)).rows;
    assert.deepEqual(rows, value.rows, `Data asli berubah: ${table}`);
  }
  await connection.query("INSERT INTO schema_migrations(id,verification) VALUES('003_employee_email_otp',$1::jsonb) ON CONFLICT(id) DO NOTHING", [JSON.stringify({ existingRowsPreserved: true })]);
  await connection.query("COMMIT");
  console.log("Migrasi email/OTP selesai. Semua nilai kolom lama tetap identik.");
} catch (error) {
  await connection.query("ROLLBACK");
  throw error;
} finally {
  connection.release();
  await pool.end();
}
