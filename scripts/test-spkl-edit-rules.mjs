import assert from "node:assert/strict";
import {
  isUnchangedSpklEdit,
  lockedAssignedWorkerIds,
  sameIdSet,
  splitWorkerIds,
} from "../lib/spkl-edit.ts";

const spkl = {
  id: "spkl_1",
  number: "SPKL/2026/11/001",
  title: "Pekerjaan uji",
  description: "Deskripsi pekerjaan untuk pengujian.",
  date: "2099-01-02",
  startAt: "2099-01-02T01:00:00.000Z",
  endAt: "2099-01-02T10:00:00.000Z",
  location: { latitude: -6.2, longitude: 106.8, address: "Lokasi uji" },
  workLocationId: "loc_1",
  radiusMeters: 120,
  createdBy: "owner_1",
  divisionId: "div_1",
  requiresDocumentation: false,
  requestId: "req-1",
  canceledAt: null,
  cancelReason: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

const next = {
  title: spkl.title,
  description: spkl.description,
  date: spkl.date,
  startAt: spkl.startAt,
  endAt: spkl.endAt,
  divisionId: spkl.divisionId,
  workLocationId: spkl.workLocationId,
  radiusMeters: spkl.radiusMeters,
  requiresDocumentation: spkl.requiresDocumentation,
  workerIds: ["emp_1", "emp_2"],
};
const currentWorkerIds = ["emp_1", "emp_2"];

const checks = [];
function accept(name) {
  assert.equal(
    isUnchangedSpklEdit(spkl, next, currentWorkerIds),
    true,
    `${name}: seharusnya tanpa perubahan`,
  );
  checks.push(name);
}
function reject(name, patch) {
  assert.equal(
    isUnchangedSpklEdit(spkl, { ...next, ...patch }, currentWorkerIds),
    false,
    `${name}: seharusnya dianggap berubah`,
  );
  checks.push(name);
}

accept("semua field sama");
accept("urutan pekerja berbeda tetap dianggap sama");
assert.equal(sameIdSet(["a", "b"], ["b", "a"]), true);
assert.equal(sameIdSet(["a", "b"], ["a"]), false);

reject("judul berubah", { title: "Judul baru" });
reject("deskripsi berubah", { description: "Deskripsi baru yang cukup panjang." });
reject("tanggal berubah", { date: "2099-01-03" });
reject("jam mulai berubah", { startAt: "2099-01-02T02:00:00.000Z" });
reject("jam selesai berubah", { endAt: "2099-01-02T11:00:00.000Z" });
reject("divisi berubah", { divisionId: "div_2" });
reject("lokasi berubah", { workLocationId: "loc_2" });
reject("radius berubah", { radiusMeters: 150 });
reject("dokumentasi berubah", { requiresDocumentation: true });
reject("pekerja bertambah", { workerIds: ["emp_1", "emp_2", "emp_3"] });
reject("pekerja berkurang", { workerIds: ["emp_1"] });

assert.deepEqual(
  splitWorkerIds(["a", "b"], ["b", "c"]),
  { added: ["c"], removed: ["a"] },
  "pekerja baru dan yang dikeluarkan",
);
assert.deepEqual(
  splitWorkerIds(["a", "b"], ["b", "a"]),
  { added: [], removed: [] },
  "urutan berbeda bukan perubahan",
);
assert.deepEqual(
  splitWorkerIds(["a"], ["a", "a"]),
  { added: [], removed: [] },
  "ID duplikat tidak menambah pekerja baru",
);
checks.push("split pekerja");

function worker(id, overrides = {}) {
  return {
    id,
    nik: id,
    name: `Pekerja ${id}`,
    phone: `62${id}`,
    email: null,
    role: "pekerja",
    accessMode: "full",
    supervisorId: "owner_1",
    divisionId: "div_1",
    active: true,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

const teamIds = new Set(["aktif", "nonaktif"]);
assert.deepEqual(
  lockedAssignedWorkerIds(
    [
      worker("aktif"),
      worker("nonaktif", { active: false }),
      worker("di_luar_tim"),
      worker("di_luar_nonaktif", { active: false }),
    ],
    teamIds,
  ),
  ["nonaktif", "di_luar_tim", "di_luar_nonaktif"],
  "hanya pekerja aktif di tim yang tidak dikunci",
);
checks.push("pekerja terkunci");

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
