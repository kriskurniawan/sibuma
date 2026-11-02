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
  id: "034_notifications",
  file: "../db/migrations/034_notifications.sql",
  label: "notifikasi aplikasi dan Web Push",
};

const expectedTables = [
  "app_notifications",
  "push_deliveries",
  "push_subscriptions",
];

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
       WHERE table_schema='public' AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [expectedTables],
    );
    assert.deepEqual(
      tables.map((row) => row.table_name),
      [...expectedTables].sort(),
      "Tabel notifikasi tidak lengkap.",
    );

    const { rows: notificationColumns } = await connection.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='app_notifications'`,
    );
    const notificationNames = new Set(
      notificationColumns.map((row) => row.column_name),
    );
    for (const column of [
      "id",
      "recipient_id",
      "kind",
      "title",
      "body",
      "href",
      "actor_id",
      "source_type",
      "source_id",
      "dedupe_key",
      "read_at",
      "created_at",
    ]) {
      assert(
        notificationNames.has(column),
        `Kolom app_notifications.${column} tidak ada.`,
      );
    }

    const { rows: subscriptionColumns } = await connection.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='push_subscriptions'`,
    );
    const subscriptionNames = new Set(
      subscriptionColumns.map((row) => row.column_name),
    );
    for (const column of ["id", "employee_id", "endpoint", "p256dh", "auth"]) {
      assert(
        subscriptionNames.has(column),
        `Kolom push_subscriptions.${column} tidak ada.`,
      );
    }

    const { rows: deliveryColumns } = await connection.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='push_deliveries'`,
    );
    const deliveryNames = new Set(deliveryColumns.map((row) => row.column_name));
    for (const column of [
      "id",
      "notification_id",
      "subscription_id",
      "status",
      "attempts",
      "next_attempt_at",
      "locked_until",
      "last_error",
      "sent_at",
    ]) {
      assert(
        deliveryNames.has(column),
        `Kolom push_deliveries.${column} tidak ada.`,
      );
    }

    const { rows: jobs } = await connection.query(
      `SELECT id FROM automation_jobs WHERE id='push_deliveries'`,
    );
    assert(jobs[0], "Jadwal otomasi push_deliveries belum dibuat.");

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          tables: expectedTables,
          automationJob: "push_deliveries",
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
