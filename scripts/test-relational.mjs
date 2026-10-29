import "./env.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPolicyRow, insert, query, transaction, pool } from "../lib/db.ts";
import { emptyData, mutateDb, persistChanges } from "../lib/unit-of-work.ts";
import { pushAudit } from "../lib/store.ts";
import { finalizeScope } from "../lib/relational-reads.ts";
import { getTeamOverview, getTeamTotals } from "../lib/team-queries.ts";
import { getReportData } from "../lib/report-queries.ts";
import { attendanceMinutes, checkInOpensAt, isCheckInOpen, zonedToIso } from "../lib/time.ts";

const prefix = `verify_sql_${randomUUID()}`;
const supervisor = `${prefix}_supervisor`;
const division = `${prefix}_division`;
const spklId = `${prefix}_spkl`;
const workerIds = Array.from({ length: 12 }, (_, index) => `${prefix}_worker_${index}`);
const now = new Date().toISOString();
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const passed = [];
try {
  await transaction(async (connection) => {
    await insert("employees", { id: supervisor, nik: supervisor, name: "Uji SQL", phone: `${prefix}_phone`, role: "atasan", accessMode: "full", supervisorId: null, divisionId: null, active: true, createdAt: now, updatedAt: now }, connection);
    await insert("divisions", { id: division, name: "Divisi SQL", description: "Fixture", supervisorId: supervisor, active: true, createdAt: now, updatedAt: now }, connection);
    for (const [index, id] of workerIds.entries()) await insert("employees", { id, nik: id, name: `Pekerja ${String(index).padStart(2, "0")}`, phone: `${id}_phone`, role: "pekerja", accessMode: "full", supervisorId: supervisor, divisionId: division, active: index !== 11, createdAt: now, updatedAt: now }, connection);
    await insert("spkls", { id: spklId, number: prefix, title: "Uji SQL", description: "Fixture finalisasi", date,
      startAt: new Date(Date.now() - 3_600_000).toISOString(), endAt: new Date(Date.now() - 60_000).toISOString(),
      location: { latitude: -6.2, longitude: 106.8 }, radiusMeters: 120, createdBy: supervisor, divisionId: division,
      requiresDocumentation: false, canceledAt: null, cancelReason: null, createdAt: now, updatedAt: now }, connection);
    for (const employeeId of workerIds) await insert("spklWorkers", { spklId, employeeId, assignedAt: now }, connection);
    await insert("attendances", { id: `${prefix}_running`, spklId, employeeId: workerIds[0], checkInAt: new Date(Date.now() - 3_500_000).toISOString(),
      checkOutAt: null, durationMinutes: null, status: "berjalan", checkInLocation: null, checkOutLocation: null, correctionReason: null,
      correctedBy: null, correctedAt: null, createdAt: now, updatedAt: now }, connection);
  });
  // Real constraint failures are contained in rolled-back transactions.
  for (const [sql, values, code] of [
    ["UPDATE employees SET phone=(SELECT phone FROM employees WHERE id=$1) WHERE id=$2", [workerIds[0], workerIds[1]], "23505"],
    ["UPDATE employees SET nik=upper((SELECT nik FROM employees WHERE id=$1)) WHERE id=$2", [workerIds[0], workerIds[1]], "23505"],
    ["UPDATE employees SET division_id='missing' WHERE id=$1", [workerIds[0]], "23503"],
    ["UPDATE spkls SET end_at=start_at WHERE id=$1", [spklId], "23514"],
  ]) await assert.rejects(transaction(async (connection) => { await query(sql, values, connection); }), (error) => error.code === code);
  const [legacy] = await query("SELECT to_regclass('public.app_state') IS NOT NULL present");
  if (legacy.present) {
    await assert.rejects(transaction(async (connection) => { await query("UPDATE app_state SET updated_at=updated_at WHERE id='main'", [], connection); }), (error) => error.code === "P0001");
  } else {
    const [retired] = await query("SELECT verification FROM schema_migrations WHERE id='002_drop_legacy'");
    assert.equal(retired?.verification.relationalRowsPreserved, true);
  }
  passed.push("Unique phone/NIK, owner FK, schedule CHECK, legacy read-only atau sudah dipensiunkan");
  await assert.rejects(mutateDb({ kind: "employee", id: workerIds[0], supervisorId: supervisor }, (db) => {
    db.employees.find((row) => row.id === workerIds[0]).name = "Tidak boleh tersimpan";
    throw new Error("rollback fixture");
  }), /rollback fixture/);
  assert.equal((await query("SELECT name FROM employees WHERE id=$1", [workerIds[0]]))[0].name, "Pekerja 00");
  passed.push("Rollback business transaction tanpa partial write");
  await Promise.all([finalizeScope("s.id=$1", [spklId]), finalizeScope("s.id=$1", [spklId])]);
  const [counts] = await query("SELECT count(*)::integer total,count(DISTINCT employee_id)::integer unique_workers FROM attendances WHERE spkl_id=$1", [spklId]);
  assert.equal(counts.total, 12); assert.equal(counts.unique_workers, 12);
  const [closed] = await query("SELECT a.status,a.check_out_at=s.end_at at_end FROM attendances a JOIN spkls s ON s.id=a.spkl_id WHERE a.id=$1", [`${prefix}_running`]);
  assert.equal(closed.status, "ditutup_otomatis"); assert.equal(closed.at_end, true);
  const [before] = await query("SELECT count(*)::integer total FROM audit_logs WHERE object_id IN (SELECT id FROM attendances WHERE spkl_id=$1)", [spklId]);
  await finalizeScope("s.id=$1", [spklId]);
  const [after] = await query("SELECT count(*)::integer total FROM audit_logs WHERE object_id IN (SELECT id FROM attendances WHERE spkl_id=$1)", [spklId]);
  assert.equal(before.total, after.total);
  passed.push("Finalisasi paralel idempoten: tutup sesi di endAt, absen/audit satu kali");
  const first = await getTeamOverview(supervisor, {}, { pageIndex: 0, pageSize: 10 });
  const second = await getTeamOverview(supervisor, {}, { pageIndex: 1, pageSize: 10 });
  assert.equal(first.total, 12); assert.equal(first.rows.length, 10); assert.equal(second.rows.length, 2);
  assert(!second.rows.some((row) => first.rows.some((other) => row.employee.id === other.employee.id)));
  const inactive = await getTeamOverview(supervisor, { status: "nonaktif" }, { pageIndex: 0, pageSize: 10 });
  assert.equal(inactive.total, 1);
  const totals = await getTeamTotals(supervisor); assert.equal(totals.total, 12); assert.equal(totals.active, 11); assert.equal(totals.divisions[0].total, 12);
  const report = await getReportData(supervisor, { from: date, to: date }, { pageIndex: 1, pageSize: 10 });
  assert.equal(report.rows.length, 2); assert.equal(report.totals.sessions, 12); assert.equal(report.totals.absent, 11); assert.equal(report.totals.employees, 12);
  const all = await getReportData(supervisor, { from: date, to: date }); assert.equal(all.rows.length, 12);
  passed.push("Pagination/filter SQL, KPI global, laporan 12 total/2 page, ekspor lengkap");
  const schedule = { date: "2026-10-26", startAt: zonedToIso("2026-10-26", "18:00"), endAt: zonedToIso("2026-10-26", "20:00"), canceledAt: null };
  assert.equal(checkInOpensAt(schedule.date), "2026-10-25T17:00:00.000Z");
  assert.equal(isCheckInOpen(schedule, new Date("2026-10-25T16:59:59Z")), false);
  assert.equal(isCheckInOpen(schedule, new Date("2026-10-25T17:00:00Z")), true);
  assert.equal(attendanceMinutes({ checkInAt: "2026-10-26T02:00:00Z", checkOutAt: "2026-10-26T10:00:00Z", spklStartAt: schedule.startAt, spklEndAt: schedule.endAt }), 0);
  assert.equal(attendanceMinutes({ checkInAt: "2026-10-26T02:00:00Z", checkOutAt: "2026-10-26T12:00:00Z", spklStartAt: schedule.startAt, spklEndAt: schedule.endAt }), 60);
  passed.push("WIB buka 00:00 dan lembur dihitung mulai startAt");
  // Policy is global: inspect persistence inside a transaction that ALWAYS rolls back.
  // No original policy/audit row is committed, restored or overwritten by this test.
  const originalPolicy = await getPolicyRow();
  const policyAuditId = `${prefix}_policy_audit`;
  const rollbackPolicy = new Error("rollback policy verification");
  await assert.rejects(transaction(async (connection) => {
    await query("SELECT id FROM policies WHERE id='policy' FOR UPDATE", [], connection);
    const db = await emptyData(connection);
    const before = structuredClone(db);
    db.policy.roundingMinutes = db.policy.roundingMinutes === 0 ? 5 : 0;
    db.policy.updatedAt = new Date().toISOString();
    db.policy.updatedBy = supervisor;
    pushAudit(db, { actorId: supervisor, actorName: "Uji SQL", action: "kebijakan_diubah", objectType: "kebijakan", objectId: "policy",
      summary: "Uji kebijakan rollback", before: before.policy, after: structuredClone(db.policy) });
    db.auditLogs[0].id = policyAuditId;
    await persistChanges(before, db, connection);
    assert.deepEqual(await getPolicyRow(connection), db.policy);
    const [audit] = await query('SELECT "before","after" FROM audit_logs WHERE id=$1', [policyAuditId], connection);
    assert.deepEqual(audit.before, before.policy);
    assert.deepEqual(audit.after, db.policy);
    throw rollbackPolicy;
  }), (error) => error === rollbackPolicy);
  assert.deepEqual(await getPolicyRow(), originalPolicy);
  assert.equal((await query("SELECT id FROM audit_logs WHERE id=$1", [policyAuditId])).length, 0);
  passed.push("Persistensi kebijakan + audit atomik teruji dalam transaksi rollback; kebijakan asli tidak diubah");
} finally {
  await transaction(async (connection) => {
    await query("DELETE FROM audit_logs WHERE actor_id=$1 OR object_id IN (SELECT id FROM attendances WHERE spkl_id=$2)", [supervisor, spklId], connection);
    await query("DELETE FROM spkls WHERE id=$1", [spklId], connection);
    await query("DELETE FROM employees WHERE supervisor_id=$1", [supervisor], connection);
    await query("DELETE FROM divisions WHERE id=$1", [division], connection);
    await query("DELETE FROM employees WHERE id=$1", [supervisor], connection);
  });
  await pool().end();
}
console.log(JSON.stringify({ passed, fixtureCleaned: true, resetCalled: false }, null, 2));
