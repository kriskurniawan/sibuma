import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createSeedData } from "../lib/seed.ts";
import { columns, encode, models } from "../lib/db-model.ts";

// New, EMPTY databases only. Never restore/reset an existing installation here.
assert(!process.argv.includes("--force"), "--force sudah dihapus. db:init tidak dapat menimpa data.");
assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();
try {
  await connection.query("BEGIN");
  await connection.query("SELECT pg_advisory_xact_lock(hashtextextended('migration:relational',0))");
  const legacy = (await connection.query("SELECT to_regclass('app_state') IS NOT NULL present")).rows[0].present;
  if (legacy) {
    const existing = await connection.query("SELECT 1 FROM app_state LIMIT 1");
    assert.equal(existing.rows.length, 0, "Database memiliki snapshot lama. Gunakan db:migrate:relational, bukan db:init.");
  }
  await connection.query(await readFile(new URL("../db/migrations/001_relational.sql", import.meta.url), "utf8"));
  await connection.query(await readFile(new URL("../db/migrations/003_employee_email_otp.sql", import.meta.url), "utf8"));
  await connection.query(await readFile(new URL("../db/migrations/004_checklists.sql", import.meta.url), "utf8"));
  await connection.query(await readFile(new URL("../db/migrations/005_checklist_public.sql", import.meta.url), "utf8"));
  await connection.query(await readFile(new URL("../db/migrations/006_checklist_item_groups.sql", import.meta.url), "utf8"));
  for (const { table } of Object.values(models)) {
    const [row] = (await connection.query(`SELECT count(*)::integer count FROM ${table}`)).rows;
    assert.equal(row.count, 0, `Tabel ${table} sudah berisi data. Tidak ada data yang ditimpa.`);
  }
  const required = ["AWS_ENDPOINT_URL_S3", "AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "NEON_STORAGE_BUCKET"];
  for (const name of required) assert(process.env[name]?.trim(), `${name} belum diatur.`);
  const s3 = new S3Client({ endpoint: process.env.AWS_ENDPOINT_URL_S3, region: process.env.AWS_REGION,
    credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
    forcePathStyle: true, requestChecksumCalculation: "WHEN_REQUIRED" });
  const data = createSeedData();
  for (const key of new Set(data.documentations.map((doc) => doc.storageKey))) {
    await s3.send(new HeadObjectCommand({ Bucket: process.env.NEON_STORAGE_BUCKET, Key: key }));
  }
  for (const [name, config] of Object.entries(models)) {
    const fields = columns(name).map(({ column }) => `"${column}"`);
    for (const entity of name === "policy" ? [data.policy] : data[name]) {
      const values = encode(name, entity);
      await connection.query(`INSERT INTO ${config.table}(${fields.join(",")}) VALUES(${values.map((_, i) => `$${i + 1}`).join(",")})`, values);
    }
  }
  await connection.query("SET CONSTRAINTS ALL IMMEDIATE");
  await connection.query("SELECT setval('spkl_number_sequence',$1,false)", [data.meta.nextSpklSequence]);
  await connection.query("INSERT INTO schema_migrations(id,verification) VALUES('001_relational',$1::jsonb)", [JSON.stringify({ initializedEmptyDatabase: true })]);
  await connection.query("INSERT INTO schema_migrations(id,verification) VALUES('003_employee_email_otp',$1::jsonb)", [JSON.stringify({ initializedEmptyDatabase: true })]);
  await connection.query("INSERT INTO schema_migrations(id,verification) VALUES('004_checklists',$1::jsonb)", [JSON.stringify({ initializedEmptyDatabase: true })]);
  await connection.query("INSERT INTO schema_migrations(id,verification) VALUES('005_checklist_public',$1::jsonb)", [JSON.stringify({ initializedEmptyDatabase: true })]);
  await connection.query("INSERT INTO schema_migrations(id,verification) VALUES('006_checklist_item_groups',$1::jsonb)", [JSON.stringify({ initializedEmptyDatabase: true })]);
  await connection.query("COMMIT");
  console.log(`Database kosong diinisialisasi dengan tabel relasional (${data.employees.length} akun, ${data.spkls.length} SPKL).`);
} catch (error) {
  await connection.query("ROLLBACK");
  throw error;
} finally {
  connection.release();
  await pool.end();
}
