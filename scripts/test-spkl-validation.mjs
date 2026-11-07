import assert from "node:assert/strict";
import { spklInputSchema } from "../lib/validation.ts";

const base = {
  title: "Pekerjaan uji",
  description: "Deskripsi pekerjaan untuk pengujian.",
  divisionId: "div_1",
  date: "2099-01-02",
  startTime: "08:00",
  endTime: "17:00",
  locationId: "loc_1",
  radiusMeters: 120,
  requiresDocumentation: false,
  workerIds: ["emp_1"],
  requestId: "req-12345678",
  expectedUpdatedAt: "2026-11-07T01:00:00.000Z",
};

const checks = [];
function accept(name, patch) {
  const result = spklInputSchema.safeParse({ ...base, ...patch });
  assert.equal(result.success, true, `${name}: seharusnya valid`);
  checks.push(name);
}
function reject(name, patch, message) {
  const result = spklInputSchema.safeParse({ ...base, ...patch });
  assert.equal(result.success, false, `${name}: seharusnya ditolak`);
  if (message) {
    assert.ok(
      result.error.issues.some((issue) => issue.message.includes(message)),
      `${name}: pesan "${message}" tidak muncul`,
    );
  }
  checks.push(name);
}

accept("input dasar");
accept("tanggal 29 Februari tahun kabisat", { date: "2028-02-29" });
reject("30 Februari", { date: "2026-02-30" }, "Tanggal tidak valid.");
reject("bulan 13", { date: "2026-13-01" }, "Tanggal tidak valid.");
reject("tanggal bukan nol-padded", { date: "2026-1-01" }, "Tanggal tidak valid.");
reject("jam 24:00", { startTime: "24:00" }, "Format jam tidak valid.");
reject("menit 60", { endTime: "17:60" }, "Format jam tidak valid.");

accept("radius minimum 25", { radiusMeters: 25 });
accept("radius maksimum 1.000", { radiusMeters: 1_000 });
reject("radius 24", { radiusMeters: 24 }, "Radius minimal 25 meter.");
reject("radius 1.001", { radiusMeters: 1_001 }, "Radius maksimal 1.000 meter.");
reject("radius pecahan", { radiusMeters: 120.5 }, "expected int");

accept("100 pekerja", {
  workerIds: Array.from({ length: 100 }, (_, index) => `emp_${index}`),
});
reject(
  "101 pekerja",
  { workerIds: Array.from({ length: 101 }, (_, index) => `emp_${index}`) },
  "Maksimal 100 pekerja",
);
reject("tanpa pekerja", { workerIds: [] }, "Pilih minimal satu pekerja.");

accept("requestId 8 karakter", { requestId: "12345678" });
reject("requestId 7 karakter", { requestId: "1234567" }, "Too small");
reject("requestId 101 karakter", { requestId: "x".repeat(101) }, "Too big");
accept("requestId tidak wajib", { requestId: undefined });

accept("expectedUpdatedAt 10 karakter", {
  expectedUpdatedAt: "2026-11-07",
});
reject(
  "expectedUpdatedAt terlalu pendek",
  { expectedUpdatedAt: "2026-11-0" },
  "Too small",
);

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
