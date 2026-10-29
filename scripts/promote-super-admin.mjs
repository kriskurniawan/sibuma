import "./env.mjs";
import assert from "node:assert/strict";
import pg from "pg";
import { normalizePhone } from "../lib/phone.ts";

assert(process.env.DATABASE_URL, "DATABASE_URL belum diatur.");

const argv = process.argv.slice(2);
const force = argv.includes("--force");

function arg(name) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]?.trim() : undefined;
}

const identifier = {
  id: arg("id"),
  nik: arg("nik"),
  email: arg("email"),
  phone: arg("phone"),
};

const filter = identifier.id
  ? { column: "id", value: identifier.id }
  : identifier.nik
    ? { column: "lower(nik)", value: identifier.nik.toLowerCase() }
    : identifier.email
      ? { column: "email", value: identifier.email.toLowerCase() }
      : identifier.phone
        ? { column: "phone", value: normalizePhone(identifier.phone) }
        : null;

assert(
  filter?.value,
  "Tentukan target dengan --id, --nik, --email, atau --phone.",
);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const connection = await pool.connect();

try {
  await connection.query("BEGIN");
  await connection.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('migration:relational',0))",
  );

  const migration = (
    await connection.query("SELECT 1 FROM schema_migrations WHERE id='009_super_admin'")
  ).rows[0];
  assert(
    migration,
    "Migrasi 009_super_admin belum diterapkan. Jalankan npm run db:migrate:super-admin lebih dulu.",
  );

  const targets = (
    await connection.query(
      `SELECT id,name,nik,role,active FROM employees WHERE ${filter.column}=$1`,
      [filter.value],
    )
  ).rows;
  assert.equal(
    targets.length,
    1,
    `Target harus tepat satu akun; ditemukan ${targets.length}.`,
  );
  const target = targets[0];
  assert.equal(target.role, "atasan", "Hanya akun ber-role atasan yang dapat dipromosikan.");
  assert.equal(target.active, true, "Akun target sedang nonaktif. Aktifkan dulu sebelum promosi.");

  const [counts] = (
    await connection.query(
      `SELECT
         (SELECT count(*) FROM employees WHERE supervisor_id=$1)::integer reports,
         (SELECT count(*) FROM divisions WHERE supervisor_id=$1)::integer divisions,
         (SELECT count(*) FROM spkls WHERE created_by=$1)::integer spkls,
         (SELECT count(*) FROM checklist_inspections WHERE owner_id=$1)::integer inspections`,
      [target.id],
    )
  ).rows;

  assert.equal(
    counts.reports,
    0,
    `Akun ${target.name} masih membawahi ${counts.reports} pekerja. Pindahkan mereka ke atasan lain terlebih dahulu agar login pekerja tidak terkunci.`,
  );
  if (!force) {
    assert.equal(
      counts.divisions + counts.spkls + counts.inspections,
      0,
      `Akun ${target.name} masih memiliki data operasional (${counts.divisions} divisi, ${counts.spkls} SPKL, ${counts.inspections} checklist). Gunakan --force hanya bila data historis itu boleh tetap tercatat sebagai milik super admin.`,
    );
  }

  const now = new Date().toISOString();
  await connection.query(
    `UPDATE employees SET role='super_admin', supervisor_id=NULL, division_id=NULL, updated_at=$2 WHERE id=$1`,
    [target.id, now],
  );
  await connection.query(
    `INSERT INTO audit_logs (id,actor_id,actor_name,action,object_type,object_id,summary,"before","after",created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)`,
    [
      `audit_${crypto.randomUUID()}`,
      target.id,
      target.name,
      "super_admin_dipromosikan",
      "karyawan",
      target.id,
      `Akun ${target.name} dipromosikan menjadi super admin.`,
      JSON.stringify({ role: target.role }),
      JSON.stringify({ role: "super_admin" }),
      now,
    ],
  );
  await connection.query("COMMIT");

  console.log(
    JSON.stringify(
      {
        promoted: { id: target.id, name: target.name, nik: target.nik },
        retainedHistoricalData: {
          divisions: counts.divisions,
          spkls: counts.spkls,
          inspections: counts.inspections,
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  await connection.query("ROLLBACK");
  throw error;
} finally {
  connection.release();
  await pool.end();
}
