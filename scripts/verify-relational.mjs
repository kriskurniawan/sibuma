import "./env.mjs";
import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import pg from "pg";
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { models, decode, encode, columns } from "../lib/db-model.ts";

// User-started local server only. NO reset. Every fixture uses a unique prefix.
const base='http://localhost:3000';
pg.types.setTypeParser(1082,value=>value);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3});
const prefix=`verify_${randomUUID()}`;
const supervisorId=`${prefix}_supervisor`;
const workerId=`${prefix}_worker`;
const divisionId=`${prefix}_division`;
const fixtureIds=new Set([supervisorId,workerId,divisionId]);
const s3=new S3Client({endpoint:process.env.AWS_ENDPOINT_URL_S3,region:process.env.AWS_REGION,credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID,secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY},forcePathStyle:true,requestChecksumCalculation:'WHEN_REQUIRED'});
const bucket=process.env.NEON_STORAGE_BUCKET;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const cookie=id=>{
 const payload=Buffer.from(JSON.stringify({employeeId:id,exp:Date.now()+3600000})).toString('base64url');
 return `lembur_session=${payload}.${createHmac('sha256',process.env.SESSION_SECRET).update(payload).digest('base64url')}`;
};
async function request(path,id,body,method='POST') {
 const response=await fetch(`${base}${path}`,{method,headers:{...(id?{cookie:cookie(id)}:{}),...(body instanceof FormData?{}:{'content-type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
 const data=await response.json();
 return {status:response.status,data};
}
async function insert(model,entity) {
 const fields=columns(model).map(({column})=>`"${column}"`);const values=encode(model,entity);
 await pool.query(`INSERT INTO ${models[model].table}(${fields.join(',')}) VALUES(${values.map((_,i)=>`$${i+1}`).join(',')})`,values);
}
const passed=[];
let original;
const uploads=new Set();
try {
 const health=await fetch(`${base}/api/health`).then(r=>r.json());assert.equal(health.schema,'relational-v1');
 original=Object.fromEntries(await Promise.all(Object.entries(models).map(async([name,config])=>[name,(await pool.query(`SELECT * FROM ${config.table} ORDER BY ${config.keys.map(key=>columns(name).find(c=>c.field===key).column).join(',')}`)).rows])));
 const legacyPresent=(await pool.query("SELECT to_regclass('public.app_state') IS NOT NULL present")).rows[0].present;
 if(legacyPresent) {
  const source=(await pool.query("SELECT data FROM app_state WHERE id='main'")).rows[0].data;
  for(const [name,config] of Object.entries(models)) {
   const ids=new Set(original[name].map(row=>decode(name,row)).map(row=>config.keys.map(key=>row[key]).join('/')));
   for(const row of name==='policy'?[source.policy]:source[name]) assert(ids.has(config.keys.map(key=>row[key]).join('/')),`Sumber hilang: ${name}`);
  }
  passed.push('Semua ID sumber migrasi tetap ada');
 } else {
  const retired=(await pool.query("SELECT verification FROM schema_migrations WHERE id='002_drop_legacy'")).rows[0];
  assert(retired?.verification.relationalRowsPreserved,'Penghapusan tabel lama belum terverifikasi.');
  for(const table of ['app_migrations','app_state','app_state_archives']) assert.equal((await pool.query('SELECT to_regclass($1) present',[`public.${table}`])).rows[0].present,null);
  passed.push('Tabel legacy sudah dipensiunkan; data aktif hanya relasional');
 }
 for(const row of original.documentations) {
  const doc=decode('documentations',row);const spkl=original.spkls.find(s=>s.id===doc.spklId);
  const object=await s3.send(new GetObjectCommand({Bucket:bucket,Key:doc.storageKey}));const bytes=await object.Body.transformToByteArray();
  assert.equal(bytes.length,doc.sizeBytes);
  const response=await fetch(`${base}/api/uploads/${doc.storageKey}`,{headers:{cookie:cookie(spkl.created_by)}});
  assert.equal(response.status,200);assert.equal(hash(new Uint8Array(await response.arrayBuffer())),hash(bytes));
  assert.equal((await fetch(`${base}/api/uploads/${doc.storageKey}`)).status,401);
  assert.equal((await fetch(`${process.env.AWS_ENDPOINT_URL_S3.replace(/\/$/,'')}/${bucket}/${doc.storageKey}`)).status,403);
 }
 passed.push(original.documentations.length?'Foto hasil migrasi: hash proxy cocok, anonim API 401/S3 403':'Tidak ada dokumentasi historis; pemeriksaan foto lama dilewati');
 const now=new Date().toISOString();
 await insert('employees',{id:supervisorId,nik:`${prefix}_nik`,name:'Atasan verifikasi sementara',phone:`628990${Date.now().toString().slice(-8)}`,role:'atasan',supervisorId:null,divisionId:null,active:true,createdAt:now,updatedAt:now});
 const createDivision=await request('/api/divisions',supervisorId,{name:`Uji ${prefix.slice(-8)}`,description:'Fixture sementara'});
 assert.notEqual(createDivision.status,401,'Server belum mengenali akun relasional baru. Hentikan dan jalankan ulang npm run dev, lalu ulangi db:verify.');
 assert.equal(createDivision.status,200,JSON.stringify(createDivision));
 const actualDivision=createDivision.data.division.id;fixtureIds.add(actualDivision);
 const editDivision=await request(`/api/divisions/${actualDivision}`,supervisorId,{description:'Fixture diperbarui'},'PATCH');assert.equal(editDivision.status,200,JSON.stringify(editDivision));
 const createWorker=await request('/api/employees',supervisorId,{name:'Pekerja verifikasi sementara',nik:`UJI-${prefix.slice(-12)}-PEKERJA`,phone:`628991${Date.now().toString().slice(-8)}`,email:`${prefix}@example.test`,divisionId:actualDivision});assert.equal(createWorker.status,200,JSON.stringify(createWorker));
 const actualWorker=createWorker.data.employee.id;fixtureIds.add(actualWorker);
 const updateWorker=await request(`/api/employees/${actualWorker}`,supervisorId,{name:'Pekerja verifikasi diperbarui'},'PATCH');assert.equal(updateWorker.status,200,JSON.stringify(updateWorker));
 const otherWorker=await request('/api/employees',supervisorId,{name:'Pekerja lain verifikasi',nik:`UJI-${prefix.slice(-12)}-LAIN`,phone:`628992${Date.now().toString().slice(-8)}`,email:`lain-${prefix}@example.test`,divisionId:actualDivision});assert.equal(otherWorker.status,200,JSON.stringify(otherWorker));
 const otherWorkerId=otherWorker.data.employee.id;fixtureIds.add(otherWorkerId);
 passed.push('Divisi/pekerja: tambah dan perbarui via API');
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',hour12:false}).format(new Date()));
 assert(hour<23,'Uji ini perlu dijalankan sebelum pukul 23 WIB.');
 const startTime=`${String(Math.min(23,hour+1)).padStart(2,'0')}:00`;
 const input={title:'SPKL verifikasi relasional',description:'Fixture untuk memverifikasi aturan absensi dan S3.',date,startTime,endTime:'23:59',divisionId:actualDivision,latitude:-6.2439,longitude:106.7989,address:'Lokasi uji',radiusMeters:120,requiresDocumentation:true,workerIds:[actualWorker]};
 const spklResult=await request('/api/spkl',supervisorId,input);assert.equal(spklResult.status,200,JSON.stringify(spklResult));
 const spklId=spklResult.data.id;fixtureIds.add(spklId);
 const edit=await request(`/api/spkl/${spklId}`,supervisorId,{...input,title:'SPKL verifikasi relasional diperbarui'},'PATCH');assert.equal(edit.status,200,JSON.stringify(edit));
 const forbidden=await request('/api/spkl',actualWorker,input);assert.equal(forbidden.status,403);
 const geolocation={latitude:input.latitude,longitude:input.longitude,accuracy:5};
 const checkins=await Promise.all([request(`/api/spkl/${spklId}/attendance`,actualWorker,geolocation),request(`/api/spkl/${spklId}/attendance`,actualWorker,geolocation)]);
 assert.equal(checkins.filter(r=>r.status===200).length,1,JSON.stringify(checkins));
 assert.equal(checkins.filter(r=>r.status===422).length,1,JSON.stringify(checkins));
 const attendance=checkins.find(r=>r.status===200).data.attendance;fixtureIds.add(attendance.id);
 assert(new Date(attendance.checkInAt)<new Date(spklResult.data.spkl.startAt));
 const blockedCheckout=await request(`/api/attendance/${attendance.id}/checkout`,actualWorker,geolocation);assert.equal(blockedCheckout.status,422);
 passed.push('SPKL buat/edit, role guard, absen lebih awal, check-in paralel satu baris');
 const bytes=Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
 const form=new FormData();form.set('file',new File([bytes],'verifikasi.jpg',{type:'image/jpeg'}));form.set('description','Fixture upload Neon relasional.');
 const upload=await request(`/api/spkl/${spklId}/documents`,actualWorker,form);assert.equal(upload.status,200,JSON.stringify(upload));
 const doc=upload.data.documentation;uploads.add(doc.storageKey);
 const saved=await s3.send(new GetObjectCommand({Bucket:bucket,Key:doc.storageKey}));assert.equal(hash(await saved.Body.transformToByteArray()),hash(bytes));
 assert.equal((await fetch(`${base}/api/uploads/${doc.storageKey}`,{headers:{cookie:cookie(otherWorkerId)}})).status,403);
 assert.equal((await fetch(`${base}/api/uploads/${doc.storageKey}`)).status,401);
 assert.equal((await fetch(`${process.env.AWS_ENDPOINT_URL_S3.replace(/\/$/,'')}/${bucket}/${doc.storageKey}`)).status,403);
 const checkout=await request(`/api/attendance/${attendance.id}/checkout`,actualWorker,geolocation);assert.equal(checkout.status,200,JSON.stringify(checkout));assert.equal(checkout.data.attendance.durationMinutes,0);
 passed.push('Upload S3 asli, dokumen wajib, akses pekerja lain 403, durasi sebelum start=0');
 const corrected=await request(`/api/attendance/${attendance.id}/correct`,supervisorId,{checkInLocal:`${date}T${startTime}`,checkOutLocal:`${date}T23:59`,reason:'Koreksi fixture pengujian relasional.'},'PATCH');assert.equal(corrected.status,200,JSON.stringify(corrected));
 const audits=(await pool.query('SELECT action FROM audit_logs WHERE object_id=$1',[attendance.id])).rows.map(r=>r.action);assert(audits.includes('absensi_dikoreksi'));
 passed.push('Koreksi + audit atomik');
 const canceled=await request(`/api/spkl/${spklId}/cancel`,supervisorId,{reason:'Pembatalan fixture verifikasi.'});assert.equal(canceled.status,200,JSON.stringify(canceled));
 const deactivate=await request(`/api/employees/${actualWorker}`,supervisorId,{active:false},'PATCH');assert.equal(deactivate.status,200);
 const inactiveSession=await request(`/api/spkl/${spklId}/attendance`,actualWorker,geolocation);assert.equal(inactiveSession.status,401);
 const reactivate=await request(`/api/employees/${actualWorker}`,supervisorId,{active:true},'PATCH');assert.equal(reactivate.status,200);
 const blockedDivision=await request(`/api/divisions/${actualDivision}`,supervisorId,{active:false},'PATCH');assert.equal(blockedDivision.status,400);
 const forbiddenPolicy=await request('/api/policy',actualWorker,{},'PATCH');assert.equal(forbiddenPolicy.status,403);
 passed.push('Pembatalan SPKL, nonaktif/aktif akun, divisi berisi pekerja ditolak, guard kebijakan');
 for(const path of ['/','/tim','/laporan','/audit','/profil',`/spkl/${spklId}`]) {
  const response=await fetch(`${base}${path}`,{headers:{cookie:cookie(supervisorId)}});assert.equal(response.status,200,path);assert(!(await response.text()).includes('data-next-error-message'),path);
 }
 for(const path of ['/tim?print=1',`/laporan?from=${date}&to=${date}&print=1`]) {
  const response=await fetch(`${base}${path}`,{headers:{cookie:cookie(supervisorId)}});assert.equal(response.status,200,path);assert(!(await response.text()).includes('data-next-error-message'),path);
 }
 const csv=await fetch(`${base}/api/reports/export?from=${date}&to=${date}`,{headers:{cookie:cookie(supervisorId)}});assert.equal(csv.status,200);assert((await csv.text()).includes('Pekerja verifikasi'));
 passed.push('Dashboard/tim/laporan/audit/profil/detail + CSV');
 // Exercise OTP verification on the fixture account without contacting providers.
 // The hash uses the same SESSION_SECRET pepper as lib/security.ts.
 const workerPhone=createWorker.data.employee.phone;
 const workerEmail=createWorker.data.employee.email;
 const challengeId=randomUUID(), otpCode='246810', otpSalt=`${prefix}_salt`;
 assert(process.env.SESSION_SECRET,'SESSION_SECRET belum diatur.');
 const otpHash=createHash('sha256').update(`${process.env.SESSION_SECRET}:${otpSalt}:${otpCode}`).digest('hex');
 await pool.query("INSERT INTO otp_records(id,phone,email,identifier,channel,destination,employee_id,code_salt,code_hash,created_at,expires_at,attempts,attempts_reset_at,status,used_at,locked_until) VALUES($1,$2,$3,$2,'whatsapp',$2,$4,$5,$6,now(),now()+interval '5 minutes',0,now()+interval '15 minutes','terkirim',null,null)",[challengeId,workerPhone,workerEmail,actualWorker,otpSalt,otpHash]);
 const otpWrong=await request('/api/auth/otp/verify',null,{identifier:workerPhone,challengeId,code:'111111'});assert.equal(otpWrong.status,401,JSON.stringify(otpWrong));
 const otpCorrect=await request('/api/auth/otp/verify',null,{identifier:workerPhone,challengeId,code:otpCode});assert.equal(otpCorrect.status,200,JSON.stringify(otpCorrect));assert.equal(otpCorrect.data.user.supervisorName,'Atasan verifikasi sementara');
 const otpReused=await request('/api/auth/otp/verify',null,{identifier:workerPhone,challengeId,code:otpCode});assert.equal(otpReused.status,400);
 passed.push('OTP salah/benar/sekali pakai + identitas atasan');
} finally {
 try {
  const extraDocs=(await pool.query("SELECT storage_key FROM documentations WHERE spkl_id IN (SELECT id FROM spkls WHERE created_by=$1)",[supervisorId])).rows;
  for(const row of extraDocs) uploads.add(row.storage_key);
  for(const key of uploads) await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:key}));
  const connection=await pool.connect();
  try {
   await connection.query('BEGIN');
   const employeeIds=(await connection.query('SELECT id FROM employees WHERE id=$1 OR supervisor_id=$1',[supervisorId])).rows.map(r=>r.id);
   const spklIds=(await connection.query('SELECT id FROM spkls WHERE created_by=$1',[supervisorId])).rows.map(r=>r.id);
   const attendanceIds=(await connection.query('SELECT id FROM attendances WHERE spkl_id=ANY($1::text[])',[spklIds])).rows.map(r=>r.id);
   await connection.query('DELETE FROM notification_logs WHERE recipient_id=ANY($1::text[])',[employeeIds]);
   await connection.query('DELETE FROM otp_records WHERE employee_id=ANY($1::text[])',[employeeIds]);
   await connection.query('DELETE FROM audit_logs WHERE actor_id=ANY($1::text[]) OR object_id=ANY($2::text[])',[employeeIds,[...fixtureIds,...spklIds,...attendanceIds]]);
   await connection.query('DELETE FROM spkls WHERE created_by=$1',[supervisorId]);
   await connection.query('DELETE FROM employees WHERE supervisor_id=$1',[supervisorId]);
   await connection.query('DELETE FROM divisions WHERE supervisor_id=$1',[supervisorId]);
   await connection.query('DELETE FROM employees WHERE id=$1',[supervisorId]);
   await connection.query('COMMIT');
  } catch(error){await connection.query('ROLLBACK');throw error;}finally{connection.release();}
  if(original) for(const [name,config] of Object.entries(models)) {
   const current=(await pool.query(`SELECT * FROM ${config.table} ORDER BY ${config.keys.map(key=>columns(name).find(c=>c.field===key).column).join(',')}`)).rows;
   // Lazy finalization may legitimately add absent rows and audits to old expired SPKLs.
   const key=row=>config.keys.map(key=>row[columns(name).find(c=>c.field===key).column]).join('/');
   const indexed=new Map(current.map(row=>[key(row),row]));
   for(const row of original[name]) assert.deepEqual(indexed.get(key(row)),row,`Original berubah: ${name}/${key(row)}`);
  }
  passed.push('Fixture dibersihkan; seluruh baris asli tetap identik');
 } finally {await pool.end();}
}
const markerPool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
try {
 await markerPool.query("UPDATE schema_migrations SET verification=verification||$1::jsonb WHERE id='001_relational'",[JSON.stringify({runtimeVerifiedAt:new Date().toISOString(),runtimeChecks:passed})]);
} finally {await markerPool.end();}
console.log(JSON.stringify({passed,resetCalled:false,originalRowsPreserved:true,fixtureCleaned:true},null,2));
