import "./env.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import pg from "pg";
import { columns, decode, models } from "../lib/db-model.ts";

// Destructive, explicitly approved retirement. Never uses CASCADE or resets data.
assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");
pg.types.setTypeParser(1082, (value) => value);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15_000 });
const connection = await pool.connect();
const migrationId = "002_drop_legacy";
const legacyTables = ["app_migrations", "app_state", "app_state_archives"];
async function snapshot() {
  const state = {};
  for (const [name, config] of Object.entries(models)) {
    const keys = config.keys.map((key) => columns(name).find((column) => column.field === key).column);
    const rows = (await connection.query(`SELECT * FROM ${config.table} ORDER BY ${keys.join(",")}`)).rows;
    state[name] = { count: rows.length, sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
  }
  return state;
}
try {
  await connection.query("BEGIN");
  await connection.query("SET LOCAL lock_timeout='15s'");
  await connection.query("SELECT pg_advisory_xact_lock(hashtextextended('migration:relational',0))");
  const [migration] = (await connection.query("SELECT * FROM schema_migrations WHERE id='001_relational' FOR UPDATE")).rows;
  assert(migration?.verification.runtimeVerifiedAt, "db:verify harus lulus sebelum menghapus tabel lama.");
  assert(migration.verification.allMappedValuesMatch && migration.verification.foreignKeysValidated, "Hasil migrasi relasional belum terverifikasi.");
  for (const relative of ["../data", "../public/demo"]) {
    await assert.rejects(access(new URL(relative, import.meta.url)), (error) => error.code === "ENOENT", "Selesaikan cleanup sumber lokal terlebih dahulu.");
  }
  // Freeze active writes only for the short comparison/drop transaction.
  await connection.query(`LOCK TABLE ${Object.values(models).map((model) => model.table).join(",")} IN SHARE MODE`);
  const before = await snapshot();
  const legacyRows = {};
  for (const table of legacyTables) {
    const [{ present }] = (await connection.query("SELECT to_regclass($1) IS NOT NULL present", [`public.${table}`])).rows;
    if (!present) continue;
    await connection.query(`LOCK TABLE public.${table} IN ACCESS EXCLUSIVE MODE`);
    legacyRows[table] = Number((await connection.query(`SELECT count(*) count FROM public.${table}`)).rows[0].count);
  }
  if (legacyRows.app_state) {
    const [source] = (await connection.query("SELECT data FROM public.app_state WHERE id='main'")).rows;
    assert(source, "Snapshot sumber tidak ditemukan.");
    for (const [name, config] of Object.entries(models)) {
      const rows = (await connection.query(`SELECT * FROM ${config.table}`)).rows.map((row) => decode(name, row));
      const key = (row) => config.keys.map((field) => row[field]).join("/");
      const ids = new Set(rows.map(key));
      for (const row of name === "policy" ? [source.data.policy] : source.data[name]) {
        assert(ids.has(key(row)), `ID sumber belum termigrasi: ${name}/${key(row)}`);
      }
    }
  }
  await connection.query(await readFile(new URL("../db/migrations/002_drop_legacy.sql", import.meta.url), "utf8"));
  assert.deepEqual(await snapshot(), before, "Data relasional berubah; seluruh penghapusan dibatalkan.");
  for (const table of legacyTables) {
    assert.equal((await connection.query("SELECT to_regclass($1) present", [`public.${table}`])).rows[0].present, null);
  }
  const verification = { retiredAt: new Date().toISOString(), droppedTables: legacyTables, legacyRowsDeleted: legacyRows,
    relationalRowsPreserved: true, relationalCounts: Object.fromEntries(Object.entries(before).map(([name, value]) => [models[name].table, value.count])) };
  await connection.query("INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING", [migrationId, JSON.stringify(verification)]);
  if (process.argv.includes("--apply")) {
    await connection.query("COMMIT");
    console.log(JSON.stringify({ applied: true, ...verification }, null, 2));
  } else {
    await connection.query("ROLLBACK");
    console.log(JSON.stringify({ dryRun: true, ...verification, note: "Tidak ada perubahan tersimpan. Gunakan --apply untuk menghapus." }, null, 2));
  }
} catch (error) {
  await connection.query("ROLLBACK");
  throw error;
} finally {
  connection.release();
  await pool.end();
}
