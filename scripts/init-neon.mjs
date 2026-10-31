import "./env.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { models } from "../lib/db-model.ts";
import { normalizeEmail } from "../lib/login-identity.ts";
import { normalizePhone } from "../lib/phone.ts";

// New, EMPTY databases only. Never restore/reset an existing installation here.
assert(!process.argv.includes("--force"), "--force sudah dihapus. db:init tidak dapat menimpa data.");
assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");

function required(name) {
  const value = process.env[name]?.trim();
  assert(value, `${name} belum diatur.`);
  return value;
}

function requiredAny(primary, legacy, label) {
  const value =
    process.env[primary]?.trim() || process.env[legacy]?.trim();
  assert(value, `${primary} (atau ${legacy}) belum diatur: ${label}.`);
  return value;
}

const admin = {
  id:
    process.env.BOOTSTRAP_ADMIN_ID?.trim() ||
    process.env.BOOTSTRAP_SUPERVISOR_ID?.trim() ||
    "emp_admin",
  name: requiredAny(
    "BOOTSTRAP_ADMIN_NAME",
    "BOOTSTRAP_SUPERVISOR_NAME",
    "nama lengkap super admin",
  ),
  nik: requiredAny(
    "BOOTSTRAP_ADMIN_NIK",
    "BOOTSTRAP_SUPERVISOR_NIK",
    "NIK super admin",
  ),
  phone: normalizePhone(
    requiredAny(
      "BOOTSTRAP_ADMIN_PHONE",
      "BOOTSTRAP_SUPERVISOR_PHONE",
      "nomor WhatsApp super admin",
    ),
  ),
  email:
    process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() ||
    process.env.BOOTSTRAP_SUPERVISOR_EMAIL?.trim()
      ? normalizeEmail(
          process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() ||
            process.env.BOOTSTRAP_SUPERVISOR_EMAIL!.trim(),
        )
      : null,
};
assert(
  admin.phone,
  "BOOTSTRAP_ADMIN_PHONE bukan nomor Indonesia yang valid (contoh 081234567890).",
);
if (
  process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() ||
  process.env.BOOTSTRAP_SUPERVISOR_EMAIL?.trim()
) {
  assert(admin.email, "BOOTSTRAP_ADMIN_EMAIL bukan alamat email yang valid.");
}

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
  for (const file of [
    "001_relational.sql",
    "003_employee_email_otp.sql",
    "004_checklists.sql",
    "005_checklist_public.sql",
    "006_checklist_item_groups.sql",
    "007_remove_demo_status.sql",
    "008_checklist_conditions.sql",
    "009_super_admin.sql",
    "010_employee_avatar.sql",
    "011_employee_access_mode.sql",
    "012_manual_works.sql",
    "013_work_locations.sql",
    "014_manual_work_locations.sql",
    "015_manual_work_photo_capture.sql",
    "016_work_location_radius.sql",
    "018_follow_up_safety.sql",
    "019_manual_work_safety.sql",
    "020_work_documents.sql",
    "021_photo_limits.sql",
    "022_video_and_folders.sql",
    "023_document_share_targets.sql",
  ]) {
    await connection.query(await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"));
  }
  for (const { table } of Object.values(models)) {
    const [row] = (await connection.query(`SELECT count(*)::integer count FROM ${table}`)).rows;
    assert.equal(row.count, 0, `Tabel ${table} sudah berisi data. Tidak ada data yang ditimpa.`);
  }

  const now = new Date().toISOString();
  const employeeFields = ["id", "nik", "name", "phone", "email", "role", "supervisor_id", "division_id", "active", "created_at", "updated_at"];
  await connection.query(
    `INSERT INTO employees(${employeeFields.join(",")}) VALUES(${employeeFields.map((_, i) => `$${i + 1}`).join(",")})`,
    [admin.id, admin.nik, admin.name, admin.phone, admin.email, "super_admin", null, null, true, now, now],
  );

  const policyFields = ["id", "rounding_minutes", "daily_limit_minutes", "weekly_limit_minutes", "doc_grace_minutes", "require_documentation", "default_radius_meters", "max_gps_accuracy_meters", "default_location_latitude", "default_location_longitude", "default_location_address", "timezone", "updated_at", "updated_by"];
  await connection.query(
    `INSERT INTO policies(${policyFields.join(",")}) VALUES(${policyFields.map((_, i) => `$${i + 1}`).join(",")})`,
    ["policy", 15, 480, 2400, 60, false, 120, 100, -6.2439, 106.7989, "Menara Sentraya, Jl. Iskandarsyah Raya No. 1, Jakarta Selatan", "Asia/Jakarta", now, admin.id],
  );

  // Titik absensi resmi pertama. Atasan hanya dapat memilih titik dari tabel ini.
  await connection.query(
    `INSERT INTO work_locations
      (id,name,address,latitude,longitude,radius_meters,active,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,true,$7,$7,$8,$8)`,
    [
      "wl_default",
      "Titik absen utama",
      "Menara Sentraya, Jl. Iskandarsyah Raya No. 1, Jakarta Selatan",
      -6.2439,
      106.7989,
      120,
      admin.id,
      now,
    ],
  );

  await connection.query("SET CONSTRAINTS ALL IMMEDIATE");
  await connection.query("SELECT setval('spkl_number_sequence',1,false)");
  for (const id of ["001_relational", "003_employee_email_otp", "004_checklists", "005_checklist_public", "006_checklist_item_groups", "007_remove_demo_status", "008_checklist_conditions", "009_super_admin", "010_employee_avatar", "011_employee_access_mode", "012_manual_works", "013_work_locations", "014_manual_work_locations", "015_manual_work_photo_capture", "016_work_location_radius", "018_follow_up_safety", "019_manual_work_safety", "020_work_documents", "021_photo_limits", "022_video_and_folders", "023_document_share_targets"]) {
    await connection.query(
      "INSERT INTO schema_migrations(id,verification) VALUES($1,$2::jsonb)",
      [id, JSON.stringify({ initializedEmptyDatabase: true })],
    );
  }
  await connection.query("COMMIT");
  console.log(`Database kosong diinisialisasi dengan tabel relasional dan 1 akun super admin (${admin.id}).`);
} catch (error) {
  await connection.query("ROLLBACK");
  throw error;
} finally {
  connection.release();
  await pool.end();
}
