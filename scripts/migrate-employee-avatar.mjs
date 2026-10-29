import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();
const id = "010_employee_avatar";

try {
  await connection.query("BEGIN");
  await connection.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('migration:relational',0))",
  );
  const existing = (
    await connection.query("SELECT verification FROM schema_migrations WHERE id=$1", [id])
  ).rows[0];
  if (existing) {
    console.log("Migrasi foto profil sudah pernah diterapkan.");
  } else {
    await connection.query(
      await readFile(new URL("../db/migrations/010_employee_avatar.sql", import.meta.url), "utf8"),
    );
    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb)",
      [id, JSON.stringify({ employeesAvatarKey: true })],
    );
    console.log("Migrasi foto profil selesai. Kolom employees.avatar_key tersedia.");
  }
  await connection.query("COMMIT");
} catch (error) {
  await connection.query("ROLLBACK");
  throw error;
} finally {
  connection.release();
  await pool.end();
}
