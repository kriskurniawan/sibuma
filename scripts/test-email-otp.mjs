import "./env.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query, insert, pool, transaction } from "../lib/db.ts";
import { models } from "../lib/db-model.ts";
import { requestOtp, verifyOtp } from "../lib/otp.ts";
import { normalizeLoginIdentifier } from "../lib/login-identity.ts";

// Providers are intercepted here, never via a production-configurable test URL.
const originalFetch = globalThis.fetch;
const names = ["CHATERY_API_URL", "CHATERY_API_KEY", "CHATERY_SESSION_ID", "RESEND_API_KEY", "RESEND_FROM_EMAIL"];
const env = Object.fromEntries(names.map(name => [name, process.env[name]]));
const prefix = `otp_test_${randomUUID()}`;
const owner = `${prefix}_owner`, division = `${prefix}_division`, worker = `${prefix}_worker`, other = `${prefix}_other`;
const phone = `628${Date.now().toString().slice(-10)}`, email = `${prefix}@example.test`;
const calls = [];
let wa = "ok", mail = "ok", latestCode;
const passed = [];
const snapshot = async () => Object.fromEntries(await Promise.all(Object.entries(models).map(async ([name, model]) => [name, await query(`SELECT * FROM ${model.table} ORDER BY 1,2`)])));
const before = await snapshot();
const fresh = () => query("DELETE FROM otp_records WHERE employee_id=$1", [worker]);
const age = () => query("UPDATE otp_records SET created_at=now()-interval '61 seconds' WHERE employee_id=$1", [worker]);
const verify = (challenge, code = latestCode, identifier = email) => verifyOtp(identifier, challenge.challengeId, code);
globalThis.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  calls.push({ url: String(url), body });
  if (String(url).startsWith("https://chatery.example.test/")) {
    latestCode = body.message.match(/\b\d{6}\b/)[0];
    if (wa === "throw") throw new Error("simulated timeout");
    return Response.json(wa === "body-fail" ? { success: false, error: "unavailable" } : { data: { id: "wa-mock" } }, { status: ["ok", "body-fail"].includes(wa) ? 200 : 503 });
  }
  assert.equal(url, "https://api.resend.com/emails", "Unexpected outbound request blocked");
  latestCode = body.text.match(/\b\d{6}\b/)[0];
  if (mail === "throw") throw new Error("simulated timeout");
  return Response.json(mail === "ok" ? { id: "email-mock" } : { message: "failed" }, { status: mail === "ok" ? 200 : 503 });
};
Object.assign(process.env, { CHATERY_API_URL: "https://chatery.example.test", CHATERY_API_KEY: "mock-only", CHATERY_SESSION_ID: "mock-only", RESEND_API_KEY: "mock-only", RESEND_FROM_EMAIL: "Lembur <noreply@example.test>" });
try {
  const now = new Date().toISOString();
  await transaction(async connection => {
    await insert("employees", { id: owner, nik: owner, name: "OTP Test Owner", phone: owner, role: "atasan", accessMode: "full", supervisorId: null, divisionId: null, active: true, createdAt: now, updatedAt: now }, connection);
    await insert("divisions", { id: division, supervisorId: owner, name: "OTP test", description: "temporary", active: true, createdAt: now, updatedAt: now }, connection);
    for (const id of [worker, other]) await insert("employees", { id, nik: id, name: "OTP Test Worker", phone: id === worker ? phone : other, email: id === worker ? email : null, role: "pekerja", accessMode: "full", supervisorId: owner, divisionId: division, active: true, createdAt: now, updatedAt: now }, connection);
  });
  assert.equal(normalizeLoginIdentifier(` ${email.toUpperCase()} `).identifier, email);
  assert.equal(normalizeLoginIdentifier(`0${phone.slice(2)}`).identifier, phone);
  for (const sql of ["UPDATE employees SET email=$1 WHERE id=$2", "UPDATE employees SET email=upper($1) WHERE id=$2"]) await assert.rejects(query(sql, [email, other]));
  passed.push("Email normalized; global duplicate/case-variant contact rejected by DB");
  assert.equal((await requestOtp("unknown@example.test")).status, 403);
  for (const [id, column, value, reset] of [[worker, "active", false, true], [worker, "nik", " ", worker], [owner, "active", false, true]]) {
    await query(`UPDATE employees SET ${column}=$1 WHERE id=$2`, [value, id]);
    assert.equal((await requestOtp(email)).status, 403);
    await query(`UPDATE employees SET ${column}=$1 WHERE id=$2`, [reset, id]);
  }
  passed.push("Unknown/inactive/blank-NIK/inactive-supervisor accounts blocked");
  let result = await requestOtp(` ${email.toUpperCase()} `);
  assert.equal(result.status, 200); assert.equal(result.channel, "email"); assert.equal("devCode" in result, false);
  assert.equal(calls.at(-1).body.to[0], email);
  assert.equal((await requestOtp(phone)).status, 429);
  assert.equal((await verifyOtp(phone, result.challengeId, latestCode)).status, 400);
  assert.equal((await verify(result)).status, 200); assert.equal((await verify(result)).status, 400);
  passed.push("Direct email delivery, no production OTP exposure, cross-channel cooldown, binding, single use");
  await fresh(); calls.length = 0;
  result = await requestOtp(phone); assert.equal(result.channel, "whatsapp"); assert.equal(calls.length, 1);
  assert.equal((await verify(result, latestCode, phone)).status, 200);
  for (const mode of ["fail", "body-fail", "throw", "unconfigured"]) {
    await fresh(); wa = mode;
    if (mode === "unconfigured") delete process.env.CHATERY_API_KEY;
    result = await requestOtp(phone);
    assert.equal(result.status, 200); assert.equal(result.channel, "email"); assert.equal(result.fallback, true);
    assert.equal(calls.at(-1).body.to[0], email);
    assert.equal((await verify(result, latestCode, phone)).status, 200);
    process.env.CHATERY_API_KEY = "mock-only";
  }
  passed.push("WA success; HTTP failure/timeout/unconfigured WA all fall back to stored email");
  await fresh(); wa = "fail"; mail = "fail";
  result = await requestOtp(phone); assert.equal(result.status, 502);
  let [row] = await query("SELECT id FROM otp_records WHERE employee_id=$1", [worker]);
  assert.equal((await verifyOtp(phone, row.id, latestCode)).status, 400);
  await fresh(); mail = "throw"; assert.equal((await requestOtp(email)).status, 502);
  await fresh(); delete process.env.RESEND_API_KEY; assert.equal((await requestOtp(email)).status, 502); process.env.RESEND_API_KEY = "mock-only";
  await fresh(); await query("UPDATE employees SET email=NULL WHERE id=$1", [worker]);
  assert.equal((await requestOtp(phone)).status, 502); await query("UPDATE employees SET email=$1 WHERE id=$2", [email, worker]);
  passed.push("Both channels fail, email timeout/unconfigured, legacy missing email: no usable OTP");
  mail = "ok"; wa = "ok";
  await fresh(); result = await requestOtp(email); await query("UPDATE otp_records SET expires_at=now()-interval '1 second' WHERE employee_id=$1", [worker]);
  assert.equal((await verify(result)).status, 400);
  await fresh(); result = await requestOtp(email); await query("UPDATE employees SET email=$1 WHERE id=$2", [`changed_${email}`, worker]);
  assert.equal((await verify(result, latestCode, phone)).status, 400); await query("UPDATE employees SET email=$1 WHERE id=$2", [email, worker]);
  await fresh(); result = await requestOtp(email); await query("UPDATE otp_records SET status='menunggu' WHERE employee_id=$1", [worker]);
  assert.equal((await verify(result)).status, 400);
  passed.push("Expiry, changed contacts and pending/failed delivery rejected");
  await fresh(); result = await requestOtp(email);
  const wrong = latestCode === "000000" ? "111111" : "000000";
  for (let index = 0; index < 3; index++) assert.equal((await verify(result, wrong)).status, 401);
  await age(); const oldId = result.challengeId; result = await requestOtp(phone);
  assert.equal((await verifyOtp(email, oldId, wrong)).status, 400);
  assert.equal((await verify(result, wrong, phone)).status, 401);
  assert.equal((await verify(result, wrong, phone)).status, 429);
  assert.equal((await requestOtp(email)).status, 429); assert.equal((await verify(result, latestCode, phone)).status, 429);
  passed.push("Attempts persist across resends/identifiers; five failures lock both contacts; old challenge revoked");
  await fresh(); const parallel = await Promise.all([requestOtp(email), requestOtp(phone)]);
  assert.equal(parallel.filter(item => item.status === 200).length, 1); assert.equal(parallel.filter(item => item.status === 429).length, 1);
  await fresh(); result = await requestOtp(email); const code = latestCode;
  const simultaneous = await Promise.all([verify(result, code), verify(result, code)]);
  assert.equal(simultaneous.filter(item => item.status === 200).length, 1);
  passed.push("Concurrent WA/email requests issue one challenge; concurrent verification succeeds only once");
} finally {
  globalThis.fetch = originalFetch;
  for (const name of names) env[name] === undefined ? delete process.env[name] : process.env[name] = env[name];
  await transaction(async connection => {
    await query("DELETE FROM audit_logs WHERE actor_id=ANY($1::text[])", [[owner, worker, other]], connection);
    await query("DELETE FROM otp_records WHERE employee_id=ANY($1::text[])", [[owner, worker, other]], connection);
    await query("DELETE FROM employees WHERE supervisor_id=$1", [owner], connection);
    await query("DELETE FROM divisions WHERE id=$1", [division], connection);
    await query("DELETE FROM employees WHERE id=$1", [owner], connection);
  });
  assert.deepEqual(await snapshot(), before, "Pre-existing rows changed");
  await pool().end();
}
console.log(JSON.stringify({ passed, providersMocked: true, originalRowsPreserved: true, fixturesCleaned: true }, null, 2));
