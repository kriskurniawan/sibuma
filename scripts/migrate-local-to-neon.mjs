import "./env.mjs";

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir, rmdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { migrateDatabase } from "../lib/migrate.ts";
import { models, columns } from "../lib/db-model.ts";

// One-time, explicit migration. Never deletes a source before its archive and
// S3 bytes have been verified. Does not call the destructive demo-reset API.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationId = "local-to-neon-s3-v1";
const required = [
  "DATABASE_URL", "AWS_ENDPOINT_URL_S3", "AWS_REGION",
  "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "NEON_STORAGE_BUCKET",
];
for (const name of required) assert(process.env[name]?.trim(), `${name} belum diatur.`);
const sql = neon(process.env.DATABASE_URL);
const bucket = process.env.NEON_STORAGE_BUCKET;
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL_S3.replace(/\/$/, ""),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
});
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (relative) => readFile(path.join(root, relative));
const counts = (data) => Object.fromEntries(
  Object.entries(data).filter(([, value]) => Array.isArray(value))
    .map(([name, value]) => [name, value.length]),
);
// Never recreate JSON-era tables after explicit retirement.
const [schemaStatus] = await sql`select to_regclass('schema_migrations') is not null present`;
if (schemaStatus.present) {
  const [retired] = await sql`select id from schema_migrations where id='002_drop_legacy'`;
  if (retired) {
    if (process.argv.includes("--cleanup")) {
      const [tables] = await sql`select to_regclass('app_state') is null and to_regclass('app_state_archives') is null and to_regclass('app_migrations') is null absent`;
      assert(tables.absent, "Tabel legacy muncul kembali; periksa database sebelum melanjutkan.");
      for (const relative of ["data", "public/demo"]) {
        await assert.rejects(readdir(path.join(root, relative)), (error) => error.code === "ENOENT", "Sumber lokal baru tidak dihapus otomatis.");
      }
      console.log("Cleanup sudah selesai; tabel legacy sudah dihapus. Tidak ada perubahan.");
      process.exit(0);
    }
    throw new Error("Migrasi lokal lama dipensiunkan dan tabel snapshot sudah dihapus; tidak boleh membuat ulang atau menimpa data aktif.");
  }
}
async function filesIn(relative) {
  let entries;
  try { entries = await readdir(path.join(root, relative), { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const files = [];
  for (const entry of entries) {
    const next = `${relative}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await filesIn(next));
    else { assert(entry.isFile(), `Sumber bukan file biasa: ${next}`); files.push(next); }
  }
  return files;
}
async function verifyObject(asset) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: asset.key }));
  const bytes = await response.Body.transformToByteArray();
  assert.equal(hash(bytes), asset.sha256, `Hash S3 tidak cocok: ${asset.key}`);
  assert.equal(bytes.byteLength, asset.bytes);
}
async function archiveFile(relative) {
  const content = await read(relative);
  const sourceContent = content.toString("utf8");
  const data = JSON.parse(sourceContent);
  const digest = hash(content);
  await sql`
    insert into app_state_archives (id, source, data, source_content, sha256)
    values (${randomUUID()}, ${relative}, ${JSON.stringify(data)}::jsonb, ${sourceContent}, ${digest})
    on conflict (source, sha256) do nothing
  `;
  const [saved] = await sql`
    select source_content from app_state_archives where source = ${relative} and sha256 = ${digest}
  `;
  assert.equal(hash(Buffer.from(saved.source_content)), digest, `Arsip gagal: ${relative}`);
  return { path: relative, sha256: digest };
}

await sql`
  create table if not exists app_state_archives (
    id uuid primary key,
    source text not null,
    data jsonb not null,
    source_content text,
    sha256 text not null,
    state_version bigint,
    created_at timestamptz not null default now(),
    unique (source, sha256)
  )
`;
await sql`
  create table if not exists app_migrations (
    id text primary key,
    details jsonb not null,
    completed_at timestamptz not null default now()
  )
`;

const [completed] = await sql`select details from app_migrations where id = ${migrationId}`;
if (process.argv.includes("--cleanup")) {
  assert(completed, "Jalankan migrasi --apply dan verifikasi aplikasi terlebih dahulu.");
  const manifest = completed.details;
  const [relational] = await sql`select id from schema_migrations where id='001_relational'`;
  assert(relational, "Migrasi relasional belum selesai.");
  const [runtime] = await sql`select verification from schema_migrations where id='001_relational'`;
  assert(runtime.verification?.runtimeVerifiedAt, "Jalankan db:verify sampai lulus sebelum cleanup.");
  for (const [name, ids] of Object.entries(manifest.entityIds)) {
    const config = models[name];
    assert(config, `Entitas tidak dikenal: ${name}`);
    const fields = config.keys.map(key => columns(name).find(column => column.field === key).column);
    const rows = await sql.query(`SELECT ${fields.join(',')} FROM ${config.table}`);
    const current = new Set(rows.map(row => fields.map(field => row[field]).join('/')));
    for (const id of ids) assert(current.has(id), `Data aktif hilang: ${name}/${id}`);
  }
  const [invalid] = await sql`select count(*)::integer count from documentations where storage_provider<>'s3'`;
  assert.equal(invalid.count, 0);
  for (const asset of manifest.assets) await verifyObject(asset);
  const verified = [];
  for (const source of manifest.sources) {
    let bytes;
    try { bytes = await read(source.path); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    assert.equal(hash(bytes), source.sha256, `File berubah; tidak dihapus: ${source.path}`);
    if (source.path.startsWith("data/db.json")) {
      const [archive] = await sql`
        select source_content from app_state_archives
        where source = ${source.path} and sha256 = ${source.sha256}
      `;
      assert(archive?.source_content, `Arsip tidak ditemukan: ${source.path}`);
      assert.equal(hash(Buffer.from(archive.source_content)), source.sha256);
    } else if (!source.path.endsWith(".gitkeep")) {
      assert(manifest.assets.some((asset) => asset.source === source.path && asset.sha256 === source.sha256));
    }
    verified.push(source.path);
  }
  // All checks finish before deleting any source.
  for (const relative of verified) await unlink(path.join(root, relative));
  for (const directory of ["data/uploads", "data", "public/demo"]) {
    await rmdir(path.join(root, directory)).catch((error) => {
      if (!["ENOENT", "ENOTEMPTY"].includes(error.code)) throw error;
    });
  }
  console.log(JSON.stringify({ deleted: verified, archives: "app_state_archives", assetsVerified: manifest.assets.length }, null, 2));
} else if (process.argv.includes("--apply")) {
  const [schema] = await sql`select to_regclass('schema_migrations') is not null present`;
  if (schema.present) {
    const [relational] = await sql`select id from schema_migrations where id='001_relational'`;
    assert(!relational, "Restorasi JSON lama dipensiunkan; tabel relasional aktif tidak boleh ditimpa.");
  }
  if (completed) {
    console.log("Migrasi sudah selesai. Gunakan --cleanup setelah verifikasi aplikasi.");
    process.exit(0);
  }
  const sources = [];
  const dataFiles = (await filesIn("data")).filter((file) => /^data\/db\.json(?:\..*\.bak)?$/.test(file));
  assert(dataFiles.includes("data/db.json"), "data/db.json tidak ditemukan.");
  for (const file of dataFiles) sources.push(await archiveFile(file));
  const local = JSON.parse((await read("data/db.json")).toString("utf8"));
  migrateDatabase(local);
  const [cloud] = await sql`select data, state_version from app_state where id = 'main'`;
  assert(cloud, "State Neon belum ada.");

  const assets = [];
  const fileMap = new Map();
  for (const file of [...await filesIn("public/demo"), ...await filesIn("data/uploads")]) {
    const bytes = await read(file);
    const sha256 = hash(bytes);
    sources.push({ path: file, sha256 });
    if (file.endsWith(".gitkeep")) continue;
    const originalKey = file.startsWith("public/") ? file.slice(7) : file.slice("data/uploads/".length);
    const key = originalKey.startsWith("demo/") ? `seed/${originalKey.slice(5)}` : originalKey;
    const contentType = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[path.extname(key).toLowerCase()];
    assert(contentType, `Tipe file tidak didukung: ${file}`);
    // Refuse to overwrite a different existing object.
    try {
      const existing = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      assert.equal(hash(await existing.Body.transformToByteArray()), sha256, `Objek S3 berbeda: ${key}`);
    } catch (error) {
      if (error.$metadata?.httpStatusCode !== 404 && !["NoSuchKey", "NotFound"].includes(error.name)) throw error;
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType }));
    }
    const asset = { source: file, key, sha256, bytes: bytes.byteLength, contentType };
    await verifyObject(asset);
    assets.push(asset);
    fileMap.set(originalKey, asset);
  }
  for (const doc of local.documentations) {
    if (doc.storageProvider === "s3") {
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: doc.storageKey }));
      assert(object.Body, `Objek tidak tersedia: ${doc.storageKey}`);
      continue;
    }
    const asset = fileMap.get(doc.storageKey);
    assert(asset, `File dokumentasi tidak ditemukan: ${doc.storageKey}`);
    doc.storageProvider = "s3";
    doc.storageKey = asset.key;
    doc.sizeBytes = asset.bytes;
    doc.mimeType = asset.contentType;
  }
  const details = {
    sources, assets, counts: counts(local),
    entityIds: Object.fromEntries(Object.entries(local).filter(([, value]) => Array.isArray(value))
      .map(([name, rows]) => [name, rows.map((item) => item.id ?? `${item.spklId}/${item.employeeId}`)])),
  };
  const cloudJson = JSON.stringify(cloud.data);
  const archiveId = randomUUID();
  const result = await sql.transaction([
    sql`
      insert into app_state_archives (id, source, data, source_content, sha256, state_version)
      select ${archiveId}, 'neon-before-local-restore', data, ${cloudJson}, ${hash(cloudJson)}, state_version
      from app_state where id = 'main' and state_version = ${cloud.state_version}
    `,
    sql`
      update app_state set data = ${JSON.stringify(local)}::jsonb, state_version = state_version + 1, updated_at = now()
      where id = 'main' and state_version = ${cloud.state_version}
      returning state_version
    `,
    sql`
      insert into app_migrations (id, details)
      select ${migrationId}, ${JSON.stringify(details)}::jsonb
      where exists (select 1 from app_state_archives where id = ${archiveId})
    `,
  ]);
  assert.equal(result[1].length, 1, "State berubah bersamaan; sumber tidak dihapus. Ulangi --apply.");
  const [{ data: restored }] = await sql`select data from app_state where id = 'main'`;
  assert.deepEqual(restored, local, "Verifikasi state yang dipulihkan gagal.");
  console.log(JSON.stringify({ restored: counts(restored), schemaVersion: restored.schemaVersion, assetsVerified: assets.length, archivesSaved: dataFiles.length + 1, localFilesDeleted: false }, null, 2));
} else {
  console.log("Gunakan --apply untuk arsip + migrasi, lalu --cleanup hanya setelah verifikasi aplikasi.");
}
