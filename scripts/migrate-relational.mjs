import "./env.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { columns, decode, encode, models } from "../lib/db-model.ts";
import { migrateDatabase } from "../lib/migrate.ts";

pg.types.setTypeParser(1082,value=>value);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:15000});
const client=await pool.connect();
const migrationId="001_relational";
const quote=name=>`"${name}"`;
const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
try {
 await client.query('BEGIN');
 await client.query("SELECT pg_advisory_xact_lock(hashtextextended('migration:relational',0))");
 await client.query(await readFile(new URL('../db/migrations/001_relational.sql',import.meta.url),'utf8'));
 const completed=(await client.query('SELECT * FROM schema_migrations WHERE id=$1',[migrationId])).rows[0];
 if(completed) {
  console.log(JSON.stringify({alreadyApplied:true,appliedAt:completed.applied_at,verification:completed.verification},null,2));
  await client.query('ROLLBACK');
 } else {
  await client.query(await readFile(new URL('../db/migrations/003_employee_email_otp.sql',import.meta.url),'utf8'));
  // Tabel titik absensi harus ada sebelum baris SPKL disalin karena model kini
  // memetakan kolom work_location_id. Seed dan tautan dijalankan lagi setelah
  // snapshot masuk (lihat di bawah).
  await client.query(await readFile(new URL('../db/migrations/013_work_locations.sql',import.meta.url),'utf8'));
  // Block old whole-state writers while taking the final snapshot. Later they
  // receive an explicit error from the read-only trigger rather than diverge.
  await client.query('LOCK TABLE app_state IN ACCESS EXCLUSIVE MODE');
  const source=(await client.query("SELECT data,state_version FROM app_state WHERE id='main' FOR UPDATE")).rows[0];
  assert(source,'State Neon tidak ditemukan; tidak membuat seed otomatis.');
  const data=structuredClone(source.data);
  migrateDatabase(data);
  const counts={};
  for(const [name,config] of Object.entries(models)) {
   const {rows:[existing]}=await client.query(`SELECT count(*)::integer count FROM ${config.table}`);
   assert.equal(existing.count,0,`Tabel ${config.table} sudah terisi; tidak menimpa data.`);
   const entities=name==='policy'?[data.policy]:data[name];
   counts[config.table]=entities.length;
   const names=columns(name).map(({column})=>quote(column));
   for(const entity of entities) {
    const values=encode(name,entity);
    await client.query(`INSERT INTO ${config.table}(${names.join(',')}) VALUES(${values.map((_,i)=>`$${i+1}`).join(',')})`,values);
   }
   // Compare every mapped field, not merely row counts. Unknown legacy fields
   // remain in the immutable source snapshot, not silently discarded forever.
   const saved=(await client.query(`SELECT * FROM ${config.table}`)).rows.map(row=>decode(name,row));
   const key=row=>config.keys.map(key=>row[key]).join('/');
   const expected=new Map(entities.map(entity=>[key(entity),decode(name,Object.fromEntries(columns(name).map(({column},index)=>[column,encode(name,entity)[index]])))]));
   for(const actual of saved) {
    const wanted=expected.get(key(actual));
    // JSON payload encoder binds JSON text; normalize it for the comparison.
    if(name==='auditLogs') for(const field of ['before','after']) wanted[field]=JSON.parse(wanted[field]);
    assert.equal(canonical(actual),canonical(wanted),`Nilai berbeda: ${config.table}/${key(actual)}`);
   }
   assert.equal(saved.length,entities.length);
  }
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  // Seed titik default dari kebijakan dan impor titik SPKL historis, lalu
  // hubungkan tiap SPKL lama ke titiknya.
  await client.query(await readFile(new URL('../db/migrations/013_work_locations.sql',import.meta.url),'utf8'));
  const next=Math.max(data.meta.nextSpklSequence,...data.spkls.map(row=>Number(row.number.split('/').at(-1))+1).filter(Number.isFinite));
  await client.query("SELECT setval('spkl_number_sequence',$1,false)",[next]);
  const hash=createHash('sha256').update(canonical(source.data)).digest('hex');
  await client.query('INSERT INTO schema_migrations(id,source_version,source_sha256,verification) VALUES($1,$2,$3,$4::jsonb)',[migrationId,source.state_version,hash,JSON.stringify({counts,allMappedValuesMatch:true,foreignKeysValidated:true})]);
  await client.query("INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING",["013_work_locations",JSON.stringify({seededFromLegacySnapshot:true})]);
  await client.query(`CREATE OR REPLACE FUNCTION reject_legacy_state_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Legacy app_state is read-only after relational migration. Restart application with relational code.'; END $$`);
  await client.query('CREATE TRIGGER app_state_readonly BEFORE INSERT OR UPDATE OR DELETE ON app_state FOR EACH STATEMENT EXECUTE FUNCTION reject_legacy_state_write()');
  if(process.argv.includes('--apply')) {
   await client.query('COMMIT');
   console.log(JSON.stringify({applied:true,counts,allMappedValuesMatch:true,foreignKeysValidated:true,legacyState:'read-only snapshot',sourceVersion:source.state_version},null,2));
  } else {
   await client.query('ROLLBACK');
   console.log(JSON.stringify({dryRun:true,counts,allMappedValuesMatch:true,foreignKeysValidated:true,note:'Tidak ada perubahan tersimpan; gunakan --apply setelah pemeriksaan kode.'},null,2));
  }
 }
} catch(error) { await client.query('ROLLBACK'); throw error; }
finally {client.release();await pool.end();}
