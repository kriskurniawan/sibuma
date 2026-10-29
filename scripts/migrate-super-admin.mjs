import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();
const id = "009_super_admin";

try {
  await connection.query("BEGIN");
  await connection.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('migration:relational',0))",
  );
  const existing = (
    await connection.query("SELECT verification FROM schema_migrations WHERE id=$1", [id])
  ).rows[0];
  if (existing) {
    console.log("Migrasi role super admin sudah pernah diterapkan.");
  } else {
    await connection.query(
      await readFile(new URL("../db/migrations/009_super_admin.sql", import.meta.url), "utf8"),
    );
    const [roles] = (
      await connection.query(
        `SELECT count(*)::integer super_admins FROM employees WHERE role='super_admin'`,
      )
    ).rows;
    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb)",
      [id, JSON.stringify({ roleCheck: "pekerja,atasan,super_admin", superAdmins: roles.super_admins })],
    );
    console.log("Migrasi role super admin selesai. Role super_admin sekarang diterima.");
  }
  await connection.query("COMMIT");
} catch (error) {
  await connection.query("ROLLBACK");
  throw error;
} finally {
  connection.release();
  await pool.end();
}
