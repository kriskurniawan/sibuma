import assert from "node:assert/strict";
import {
  isSaturdayDate,
  overtimePayableMinutes,
  piketStartAtForDate,
} from "../lib/time.ts";

const policy = {
  overtimeRoundingEnabled: true,
  overtimeRoundingToleranceMinutes: 30,
  overtimeRoundingEffectiveMonth: "2026-10-01",
};

const schedule = {
  spklStartAt: "2026-10-05T09:00:00+07:00",
  spklEndAt: "2026-10-05T17:00:00+07:00",
  spklDate: "2026-10-05",
};

function minutes(overrides = {}) {
  return overtimePayableMinutes({
    checkInAt: "2026-10-05T09:00:00+07:00",
    checkOutAt: "2026-10-05T17:00:00+07:00",
    status: "selesai",
    policy,
    ...schedule,
    ...overrides,
  });
}

assert.equal(minutes({ checkInAt: "2026-10-05T08:30:00+07:00", checkOutAt: "2026-10-05T17:10:00+07:00" }), 480);
assert.equal(minutes({ checkInAt: "2026-10-05T09:30:00+07:00" }), 480, "kurang 30 menit tetap penuh");
assert.equal(minutes({ checkInAt: "2026-10-05T09:31:00+07:00" }), 420, "kurang 31 menit menjadi 7 jam");
assert.equal(minutes({ checkInAt: "2026-10-05T10:30:00+07:00" }), 420, "kurang 90 menit menjadi 7 jam");
assert.equal(minutes({ checkInAt: "2026-10-05T10:31:00+07:00" }), 360, "kurang 91 menit menjadi 6 jam");
assert.equal(minutes({ checkOutAt: "2026-10-05T16:30:00+07:00" }), 480, "pulang awal 30 menit tetap penuh");
assert.equal(minutes({ checkOutAt: "2026-10-05T16:29:00+07:00" }), 420, "pulang awal 31 menit menjadi 7 jam");
assert.equal(minutes({ checkInAt: "2026-10-05T09:20:00+07:00", checkOutAt: "2026-10-05T16:40:00+07:00" }), 420, "terlambat dan pulang awal dijumlahkan");
assert.equal(minutes({ checkOutAt: null, status: "ditutup_otomatis" }), 0, "tanpa checkout tidak mendapat jam penuh");
assert.equal(minutes({ checkOutAt: null, status: "berjalan", now: new Date("2026-10-05T10:00:00+07:00") }), 60, "sesi berjalan memakai durasi aktual");
assert.equal(minutes({ spklCanceledAt: "2026-10-05T12:00:00+07:00", checkOutAt: "2026-10-05T12:00:00+07:00" }), 180, "SPKL batal tidak dibulatkan");
assert.equal(minutes({ spklDate: "2026-09-30", checkInAt: "2026-10-05T09:31:00+07:00" }), 449, "bulan sebelum berlaku tidak berubah");
assert.equal(minutes({ policy: { ...policy, overtimeRoundingEnabled: false }, checkInAt: "2026-10-05T09:31:00+07:00" }), 449);
assert.equal(minutes({ policy: { ...policy, overtimeRoundingToleranceMinutes: 0 }, checkInAt: "2026-10-05T09:01:00+07:00" }), 420);
assert.equal(minutes({ checkInAt: "2026-10-05T09:00:00+07:00", checkOutAt: "2026-10-05T17:00:00+07:00", status: "dikoreksi" }), 480);
assert.equal(minutes({ checkInAt: "2026-10-05T09:00:00+07:00", checkOutAt: "2026-10-05T17:00:00+07:00", status: "tidak_hadir" }), 0);

// Piket hari Sabtu: jadwal 08.00-17.00, lembur baru dihitung sejak 12.00.
const piketSchedule = {
  spklStartAt: "2026-11-07T08:00:00+07:00",
  spklEndAt: "2026-11-07T17:00:00+07:00",
  spklDate: "2026-11-07",
  piketStartAt: "2026-11-07T12:00:00+07:00",
};

function piketMinutes(overrides = {}) {
  return overtimePayableMinutes({
    checkInAt: "2026-11-07T08:00:00+07:00",
    checkOutAt: "2026-11-07T17:00:00+07:00",
    status: "selesai",
    policy,
    ...piketSchedule,
    ...overrides,
  });
}

assert.equal(piketMinutes(), 300, "piket penuh 5 jam sejak 12.00");
assert.equal(piketMinutes({ checkInAt: "2026-11-07T12:30:00+07:00" }), 300, "kekurangan 30 menit piket tetap penuh");
assert.equal(piketMinutes({ checkInAt: "2026-11-07T12:31:00+07:00" }), 240, "kekurangan 31 menit piket menjadi 4 jam");
assert.equal(piketMinutes({ checkOutAt: null, status: "berjalan", now: new Date("2026-11-07T13:00:00+07:00") }), 60, "sesi piket berjalan memakai waktu aktual");
assert.equal(piketMinutes({ piketStartAt: null, checkInAt: "2026-11-07T09:00:00+07:00" }), 480, "sesi biasa tanpa piket tetap 8 jam");

assert.equal(isSaturdayDate("2026-11-07"), true, "7 November 2026 adalah Sabtu");
assert.equal(isSaturdayDate("2026-11-08"), false, "8 November 2026 adalah Minggu");
assert.equal(
  piketStartAtForDate("2026-11-07", "Asia/Jakarta"),
  "2026-11-07T05:00:00.000Z",
  "piket dimulai pukul 12.00 WIB",
);

console.log("PASS: batas toleransi 30/31 menit, pulang awal, sesi tanpa checkout, SPKL batal, bulan efektif, dan piket Sabtu.");
