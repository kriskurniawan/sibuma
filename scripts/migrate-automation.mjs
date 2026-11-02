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
  id: "029_automation",
  file: "../db/migrations/029_automation.sql",
  label: "otomasi terjadwal dan outbox notifikasi",
};

const expectedJobs = [
  "attendance_finalization",
  "checklist_generation",
  "document_purge",
  "notification_outbox",
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

    const { rows: jobs } = await connection.query(
      "SELECT id FROM automation_jobs ORDER BY id",
    );
    // Migrasi 029 hanya membuat empat pekerjaan awal. Pekerjaan baru dari
    // migrasi berikutnya (mis. push_deliveries) tidak boleh membuat migrasi
    // lama gagal saat dijalankan ulang pada database yang sudah diperbarui.
    const jobIds = new Set(jobs.map((row) => row.id));
    for (const id of expectedJobs) {
      assert(jobIds.has(id), `Pekerjaan otomasi ${id} tidak ada.`);
    }

    const { rows: outboxColumns } = await connection.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='notification_outbox'`,
    );
    const columns = new Set(outboxColumns.map((row) => row.column_name));
    for (const column of [
      "dedupe_key",
      "status",
      "attempts",
      "next_attempt_at",
      "locked_at",
      "sent_at",
    ]) {
      assert(columns.has(column), `Kolom notification_outbox.${column} tidak ada.`);
    }

    const { rows: statusConstraint } = await connection.query(
      `SELECT pg_get_constraintdef(oid) definition
       FROM pg_constraint
       WHERE conrelid='notification_outbox'::regclass
         AND conname='notification_outbox_status_check'`,
    );
    assert(statusConstraint[0], "Constraint status outbox tidak ditemukan.");
    for (const status of ["pending", "processing", "sent", "failed"]) {
      assert(
        statusConstraint[0].definition.includes(status),
        `Constraint status outbox belum menerima ${status}.`,
      );
    }

    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",
      [
        migration.id,
        JSON.stringify({
          jobs: expectedJobs,
          outboxStatuses: ["pending", "processing", "sent", "failed"],
          retryStateStored: true,
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
