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
  const existing = (await connection.query("SELECT 1 FROM schema_migrations WHERE id='007_remove_demo_status'")).rows[0];
  if (existing) {
    console.log("Migrasi penghapusan status demo sudah pernah diterapkan.");
  } else {
    await connection.query(await readFile(new URL("../db/migrations/007_remove_demo_status.sql", import.meta.url), "utf8"));
    const [otp] = (await connection.query("SELECT count(*)::integer count FROM otp_records WHERE status='demo'")).rows;
    const [notifications] = (await connection.query("SELECT count(*)::integer count FROM notification_logs WHERE status='demo'")).rows;
    assert.equal(otp.count, 0, "Masih ada OTP berstatus demo.");
    assert.equal(notifications.count, 0, "Masih ada notifikasi berstatus demo.");
    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES('007_remove_demo_status',$1::jsonb)",
      [JSON.stringify({ demoStatusesRemoved: true })],
    );
    console.log("Migrasi 007 selesai. Status demo dihapus dari OTP dan notifikasi.");
  }
  await connection.query("COMMIT");
} catch (error) {
  await connection.query("ROLLBACK");
  throw error;
} finally {
  connection.release();
  await pool.end();
}
