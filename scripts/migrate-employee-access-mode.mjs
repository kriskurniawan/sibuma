import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();
const id = "011_employee_access_mode";

try {
  await connection.query("BEGIN");
  await connection.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('migration:relational',0))",
  );
  const existing = (
    await connection.query("SELECT verification FROM schema_migrations WHERE id=$1", [id])
  ).rows[0];
  if (existing) {
    console.log("Migrasi mode akses atasan sudah pernah diterapkan.");
  } else {
    await connection.query(
      await readFile(new URL("../db/migrations/011_employee_access_mode.sql", import.meta.url), "utf8"),
    );
    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb)",
      [id, JSON.stringify({ employeesAccessMode: true })],
    );
    console.log("Migrasi mode akses atasan selesai. Kolom employees.access_mode tersedia.");
  }
  await connection.query("COMMIT");
} catch (error) {
  await connection.query("ROLLBACK");
  throw error;
} finally {
  connection.release();
  await pool.end();
}
