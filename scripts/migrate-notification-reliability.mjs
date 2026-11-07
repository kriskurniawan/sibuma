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
  id: "041_notification_reliability",
  file: "../db/migrations/041_notification_reliability.sql",
  label: "idempotensi SPKL dan pengaman pengiriman notifikasi",
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

    const { rows: spklColumns } = await connection.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='spkls'`,
    );
    assert(
      spklColumns.some((row) => row.column_name === "request_id"),
      "Kolom spkls.request_id tidak ada.",
    );

    const { rows: outboxColumns } = await connection.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='notification_outbox'`,
    );
    assert(
      outboxColumns.some((row) => row.column_name === "delivery_attempted_at"),
      "Kolom notification_outbox.delivery_attempted_at tidak ada.",
    );

    const { rows: indexes } = await connection.query(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname='public' AND tablename='spkls'
         AND indexname='spkls_request_unique'`,
    );
    assert.equal(indexes.length, 1, "Indeks spkls_request_unique tidak ada.");
    assert(
      /\bUNIQUE\b/i.test(indexes[0].indexdef) &&
        /request_id/.test(indexes[0].indexdef) &&
        /created_by/.test(indexes[0].indexdef),
      "Indeks spkls_request_unique tidak unik per pembuat dan request_id.",
    );

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          columns: [
            "spkls.request_id",
            "notification_outbox.delivery_attempted_at",
          ],
          uniqueIndex: "spkls_request_unique",
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
