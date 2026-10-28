import { addDays, addMinutes, subDays, subMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE, DEFAULT_MAP_CENTER } from "./constants";
import { SCHEMA_VERSION } from "./migrate";
import seedAssets from "./seed-assets.json";
import { zonedToIso } from "./time";
import type {
  Attendance,
  AttendanceLocation,
  AuditLog,
  Database,
  Division,
  Documentation,
  Employee,
  Spkl,
  SpklWorker,
} from "./types";

const SITE = {
  latitude: DEFAULT_MAP_CENTER.latitude,
  longitude: DEFAULT_MAP_CENTER.longitude,
  address: "Menara Sentraya, Jl. Iskandarsyah Raya No. 1, Jakarta Selatan",
};

const GUDANG = {
  latitude: -6.2882,
  longitude: 106.7995,
  address: "Gudang Operasional Cilandak, Jakarta Selatan",
};

const CABANG = {
  latitude: -6.1754,
  longitude: 106.8272,
  address: "Gedung Operasional Gambir, Jakarta Pusat",
};

function location(
  point: { latitude: number; longitude: number; address?: string },
  accuracy: number,
  distance: number,
  capturedAt: string,
): AttendanceLocation {
  return {
    ...point,
    accuracy,
    distanceFromSite: distance,
    capturedAt,
  };
}

function numberFor(date: string, sequence: number) {
  return `SPKL/${date.slice(0, 4)}/${date.slice(5, 7)}/${String(sequence).padStart(3, "0")}`;
}

function localAt(daysFromNow: number, time: string) {
  const day = formatInTimeZone(
    addDays(new Date(), daysFromNow),
    APP_TIMEZONE,
    "yyyy-MM-dd",
  );
  return zonedToIso(day, time);
}

export function createSeedData(now = new Date()): Database {
  const nowIso = now.toISOString();
  const activeStart = addMinutes(now, -35).toISOString();
  const activeEnd = addMinutes(now, 155).toISOString();
  const laterStart = addMinutes(now, 150).toISOString();
  const laterEnd = addMinutes(now, 330).toISOString();
  const tomorrowStart = localAt(1, "19:00");
  const tomorrowEnd = localAt(1, "22:00");
  const pastStart = localAt(-2, "18:00");
  const pastEnd = localAt(-2, "21:30");
  const olderStart = localAt(-5, "17:30");
  const olderEnd = localAt(-5, "20:00");
  const oldestStart = localAt(-10, "18:30");
  const oldestEnd = localAt(-10, "21:00");

  const divisions: Division[] = [
    {
      id: "div_ops",
      name: "Operasional",
      description:
        "Penugasan harian gudang, packing, dan migrasi data inventori.",
      supervisorId: "emp_budi",
      active: true,
      createdAt: subDays(now, 460).toISOString(),
      updatedAt: nowIso,
    },
    {
      id: "div_gudang",
      name: "Gudang",
      description:
        "Penerimaan barang, stock opname, dan rekonsiliasi faktur supplier.",
      supervisorId: "emp_budi",
      active: true,
      createdAt: subDays(now, 300).toISOString(),
      updatedAt: nowIso,
    },
  ];

  const employees: Employee[] = [
    {
      id: "emp_budi",
      nik: "BMBI-2018-004",
      name: "Budi Santoso",
      email: null,
      phone: "6281234567890",
      role: "atasan",
      supervisorId: null,
      divisionId: null,
      active: true,
      createdAt: subDays(now, 460).toISOString(),
      updatedAt: nowIso,
    },
    {
      id: "emp_andi",
      nik: "BMBI-2021-021",
      name: "Andi Pratama",
      email: null,
      phone: "6281234567891",
      role: "pekerja",
      supervisorId: "emp_budi",
      divisionId: "div_ops",
      active: true,
      createdAt: subDays(now, 390).toISOString(),
      updatedAt: nowIso,
    },
    {
      id: "emp_siti",
      nik: "BMBI-2022-034",
      name: "Siti Rahma",
      email: null,
      phone: "6281234567892",
      role: "pekerja",
      supervisorId: "emp_budi",
      divisionId: "div_ops",
      active: true,
      createdAt: subDays(now, 310).toISOString(),
      updatedAt: nowIso,
    },
    {
      id: "emp_rizky",
      nik: "BMBI-2023-048",
      name: "Rizky Hidayat",
      email: null,
      phone: "6281234567893",
      role: "pekerja",
      supervisorId: "emp_budi",
      divisionId: "div_gudang",
      active: true,
      createdAt: subDays(now, 220).toISOString(),
      updatedAt: nowIso,
    },
    {
      id: "emp_dewi",
      nik: "BMBI-2024-061",
      name: "Dewi Lestari",
      email: null,
      phone: "6281234567894",
      role: "pekerja",
      supervisorId: "emp_budi",
      divisionId: "div_gudang",
      active: true,
      createdAt: subDays(now, 140).toISOString(),
      updatedAt: nowIso,
    },
  ];

  const spkls: Spkl[] = [
    {
      id: "spkl_active",
      number: numberFor(activeStart, 4),
      title: "Migrasi data inventori Q4",
      description:
        "Menyelesaikan migrasi data stok gudang ke sistem baru, mencocokkan 1.240 SKU, dan menandai selisih stok untuk diverifikasi besok pagi. Fokus pada batch rak A–C.",
      date: formatInTimeZone(activeStart, APP_TIMEZONE, "yyyy-MM-dd"),
      startAt: activeStart,
      endAt: activeEnd,
      location: SITE,
      radiusMeters: 180,
      createdBy: "emp_budi",
      divisionId: "div_ops",
      requiresDocumentation: true,
      canceledAt: null,
      cancelReason: null,
      createdAt: subDays(now, 1).toISOString(),
      updatedAt: subMinutes(now, 50).toISOString(),
    },
    {
      id: "spkl_later",
      number: numberFor(laterStart, 5),
      title: "Rapikan display produk baru",
      description:
        "Menata ulang display produk baru di area depan, memasang label harga, dan mengambil dokumentasi hasil akhir sebelum toko tutup.",
      date: formatInTimeZone(laterStart, APP_TIMEZONE, "yyyy-MM-dd"),
      startAt: laterStart,
      endAt: laterEnd,
      location: SITE,
      radiusMeters: 120,
      createdBy: "emp_budi",
      divisionId: "div_gudang",
      requiresDocumentation: false,
      canceledAt: null,
      cancelReason: null,
      createdAt: subMinutes(now, 120).toISOString(),
      updatedAt: subMinutes(now, 120).toISOString(),
    },
    {
      id: "spkl_tomorrow",
      number: numberFor(tomorrowStart, 6),
      title: "Persiapan audit stok cabang",
      description:
        "Pengecekan akhir dokumen mutasi stok dan penyusunan ringkasan temuan untuk audit internal cabang. Bawa laptop dan akses sistem inventori.",
      date: formatInTimeZone(tomorrowStart, APP_TIMEZONE, "yyyy-MM-dd"),
      startAt: tomorrowStart,
      endAt: tomorrowEnd,
      location: CABANG,
      radiusMeters: 100,
      createdBy: "emp_budi",
      divisionId: "div_ops",
      requiresDocumentation: true,
      canceledAt: null,
      cancelReason: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "spkl_past_stock",
      number: numberFor(pastStart, 3),
      title: "Stock opname gudang utama",
      description:
        "Penghitungan fisik stok kategori houseware dan peralatan dapur, dilanjutkan dengan input hasil hitung ke sistem.",
      date: formatInTimeZone(pastStart, APP_TIMEZONE, "yyyy-MM-dd"),
      startAt: pastStart,
      endAt: pastEnd,
      location: GUDANG,
      radiusMeters: 150,
      createdBy: "emp_budi",
      divisionId: "div_ops",
      requiresDocumentation: true,
      canceledAt: null,
      cancelReason: null,
      createdAt: subDays(now, 3).toISOString(),
      updatedAt: subDays(now, 3).toISOString(),
    },
    {
      id: "spkl_past_packing",
      number: numberFor(olderStart, 2),
      title: "Packing pesanan marketplace",
      description:
        "Menyelesaikan antrean packing pesanan flash sale dan memastikan semua paket siap diambil ekspedisi pukul 20.30.",
      date: formatInTimeZone(olderStart, APP_TIMEZONE, "yyyy-MM-dd"),
      startAt: olderStart,
      endAt: olderEnd,
      location: SITE,
      radiusMeters: 180,
      createdBy: "emp_budi",
      divisionId: "div_ops",
      requiresDocumentation: false,
      canceledAt: null,
      cancelReason: null,
      createdAt: subDays(now, 6).toISOString(),
      updatedAt: subDays(now, 6).toISOString(),
    },
    {
      id: "spkl_past_audit",
      number: numberFor(oldestStart, 1),
      title: "Rekonsiliasi faktur supplier",
      description:
        "Mencocokkan faktur supplier periode September dengan purchase order dan surat jalan yang diterima gudang.",
      date: formatInTimeZone(oldestStart, APP_TIMEZONE, "yyyy-MM-dd"),
      startAt: oldestStart,
      endAt: oldestEnd,
      location: CABANG,
      radiusMeters: 100,
      createdBy: "emp_budi",
      divisionId: "div_gudang",
      requiresDocumentation: false,
      canceledAt: null,
      cancelReason: null,
      createdAt: subDays(now, 11).toISOString(),
      updatedAt: subDays(now, 11).toISOString(),
    },
  ];

  const spklWorkers: SpklWorker[] = [
    ...[
      ["spkl_active", "emp_andi"],
      ["spkl_active", "emp_siti"],
      ["spkl_later", "emp_rizky"],
      ["spkl_later", "emp_dewi"],
      ["spkl_tomorrow", "emp_andi"],
      ["spkl_tomorrow", "emp_siti"],
      ["spkl_past_stock", "emp_andi"],
      ["spkl_past_stock", "emp_siti"],
      ["spkl_past_packing", "emp_andi"],
      ["spkl_past_packing", "emp_siti"],
      ["spkl_past_audit", "emp_rizky"],
    ].map(([spklId, employeeId]) => ({
      spklId,
      employeeId,
      assignedAt: subDays(now, 2).toISOString(),
    })),
  ];

  const andiCheckIn = subMinutes(now, 23).toISOString();
  const sitiCheckIn = addMinutes(new Date(pastStart), 7).toISOString();
  const olderAndiCheckIn = addMinutes(new Date(olderStart), 5).toISOString();
  const olderSitiCheckIn = addMinutes(new Date(olderStart), 9).toISOString();
  const oldestRizkyCheckIn = addMinutes(new Date(oldestStart), 11).toISOString();

  const attendances: Attendance[] = [
    {
      id: "att_active_andi",
      spklId: "spkl_active",
      employeeId: "emp_andi",
      checkInAt: andiCheckIn,
      checkOutAt: null,
      durationMinutes: null,
      checkInLocation: location(SITE, 12, 26, andiCheckIn),
      checkOutLocation: null,
      status: "berjalan",
      correctionReason: null,
      correctedBy: null,
      correctedAt: null,
      createdAt: andiCheckIn,
      updatedAt: andiCheckIn,
    },
    {
      id: "att_past_andi",
      spklId: "spkl_past_stock",
      employeeId: "emp_andi",
      checkInAt: addMinutes(new Date(pastStart), 5).toISOString(),
      checkOutAt: addMinutes(new Date(pastEnd), -4).toISOString(),
      durationMinutes: 201,
      checkInLocation: location(GUDANG, 18, 41, addMinutes(new Date(pastStart), 5).toISOString()),
      checkOutLocation: location(GUDANG, 16, 34, addMinutes(new Date(pastEnd), -4).toISOString()),
      status: "selesai",
      correctionReason: null,
      correctedBy: null,
      correctedAt: null,
      createdAt: addMinutes(new Date(pastStart), 5).toISOString(),
      updatedAt: addMinutes(new Date(pastEnd), -4).toISOString(),
    },
    {
      id: "att_past_siti",
      spklId: "spkl_past_stock",
      employeeId: "emp_siti",
      checkInAt: sitiCheckIn,
      checkOutAt: pastEnd,
      durationMinutes: 203,
      checkInLocation: location(GUDANG, 22, 56, sitiCheckIn),
      checkOutLocation: location(GUDANG, 35, 61, pastEnd),
      status: "ditutup_otomatis",
      correctionReason: null,
      correctedBy: null,
      correctedAt: null,
      createdAt: sitiCheckIn,
      updatedAt: pastEnd,
    },
    {
      id: "att_older_andi",
      spklId: "spkl_past_packing",
      employeeId: "emp_andi",
      checkInAt: olderAndiCheckIn,
      checkOutAt: addMinutes(new Date(olderEnd), -10).toISOString(),
      durationMinutes: 135,
      checkInLocation: location(SITE, 15, 22, olderAndiCheckIn),
      checkOutLocation: location(SITE, 20, 39, addMinutes(new Date(olderEnd), -10).toISOString()),
      status: "selesai",
      correctionReason: null,
      correctedBy: null,
      correctedAt: null,
      createdAt: olderAndiCheckIn,
      updatedAt: addMinutes(new Date(olderEnd), -10).toISOString(),
    },
    {
      id: "att_older_siti",
      spklId: "spkl_past_packing",
      employeeId: "emp_siti",
      checkInAt: olderSitiCheckIn,
      checkOutAt: olderEnd,
      durationMinutes: 141,
      checkInLocation: location(SITE, 27, 48, olderSitiCheckIn),
      checkOutLocation: location(SITE, 31, 52, olderEnd),
      status: "selesai",
      correctionReason: null,
      correctedBy: null,
      correctedAt: null,
      createdAt: olderSitiCheckIn,
      updatedAt: olderEnd,
    },
    {
      id: "att_oldest_rizky",
      spklId: "spkl_past_audit",
      employeeId: "emp_rizky",
      checkInAt: oldestRizkyCheckIn,
      checkOutAt: oldestEnd,
      durationMinutes: 139,
      checkInLocation: location(CABANG, 23, 42, oldestRizkyCheckIn),
      checkOutLocation: location(CABANG, 25, 47, oldestEnd),
      status: "dikoreksi",
      correctionReason:
        "Pekerja lupa menekan Pulang Lembur. Waktu pulang disesuaikan dengan bukti foto serah terima.",
      correctedBy: "emp_budi",
      correctedAt: subDays(now, 9).toISOString(),
      createdAt: oldestRizkyCheckIn,
      updatedAt: subDays(now, 9).toISOString(),
    },
  ];

  const documentations: Documentation[] = [
    {
      id: "doc_active_1",
      spklId: "spkl_active",
      attendanceId: "att_active_andi",
      employeeId: "emp_andi",
      storageProvider: "s3",
      storageKey: seedAssets.migrasi.key,
      fileName: "rak-a-migrasi.jpg",
      mimeType: "image/jpeg",
      sizeBytes: seedAssets.migrasi.bytes,
      description:
        "Rak A sudah selesai dipindai. Selisih 3 SKU pada batch A-014, sudah ditandai di lembar cek.",
      takenAt: subMinutes(now, 13).toISOString(),
      location: SITE,
      createdAt: subMinutes(now, 12).toISOString(),
    },
    {
      id: "doc_active_2",
      spklId: "spkl_active",
      attendanceId: "att_active_andi",
      employeeId: "emp_andi",
      storageProvider: "s3",
      storageKey: seedAssets.laptop.key,
      fileName: "rekap-selisih-sku.jpg",
      mimeType: "image/jpeg",
      sizeBytes: seedAssets.laptop.bytes,
      description:
        "Screenshot rekap sementara: 1.240 SKU sudah masuk, 37 selisih menunggu verifikasi tim gudang.",
      takenAt: subMinutes(now, 4).toISOString(),
      location: SITE,
      createdAt: subMinutes(now, 3).toISOString(),
    },
    {
      id: "doc_past_1",
      spklId: "spkl_past_stock",
      attendanceId: "att_past_andi",
      employeeId: "emp_andi",
      storageProvider: "s3",
      storageKey: seedAssets.gudang.key,
      fileName: "opname-rak-houseware.jpg",
      mimeType: "image/jpeg",
      sizeBytes: seedAssets.gudang.bytes,
      description:
        "Hasil hitung fisik rak houseware. Semua kardus sudah diberi label tanggal opname.",
      takenAt: addMinutes(new Date(pastStart), 70).toISOString(),
      location: GUDANG,
      createdAt: addMinutes(new Date(pastStart), 71).toISOString(),
    },
    {
      id: "doc_past_2",
      spklId: "spkl_past_stock",
      attendanceId: "att_past_siti",
      employeeId: "emp_siti",
      storageProvider: "s3",
      storageKey: seedAssets.laptop.key,
      fileName: "input-opname-sistem.jpg",
      mimeType: "image/jpeg",
      sizeBytes: seedAssets.laptop.bytes,
      description:
        "Input selesai untuk 8 dari 10 kategori. Dua kategori dilanjutkan setelah istirahat.",
      takenAt: addMinutes(new Date(pastStart), 112).toISOString(),
      location: GUDANG,
      createdAt: addMinutes(new Date(pastStart), 113).toISOString(),
    },
    {
      id: "doc_older_1",
      spklId: "spkl_past_packing",
      attendanceId: "att_older_andi",
      employeeId: "emp_andi",
      storageProvider: "s3",
      storageKey: seedAssets.paket.key,
      fileName: "paket-siap-ekspedisi.jpg",
      mimeType: "image/jpeg",
      sizeBytes: seedAssets.paket.bytes,
      description:
        "Seluruh 86 paket sudah discan dan disusun per ekspedisi. Tidak ada paket tertinggal.",
      takenAt: addMinutes(new Date(olderEnd), -25).toISOString(),
      location: SITE,
      createdAt: addMinutes(new Date(olderEnd), -24).toISOString(),
    },
  ];

  const spklCreatedAudit: AuditLog[] = spkls.map((spkl) => ({
    id: `audit_${spkl.id}`,
    actorId: "emp_budi",
    actorName: "Budi Santoso",
    action: "spkl_dibuat",
    objectType: "spkl",
    objectId: spkl.id,
    summary: `SPKL ${spkl.number} dibuat untuk ${spkl.title}.`,
    before: null,
    after: {
      title: spkl.title,
      startAt: spkl.startAt,
      endAt: spkl.endAt,
      workerCount: spklWorkers.filter((w) => w.spklId === spkl.id).length,
    },
    createdAt: spkl.createdAt,
  }));

  const auditLogs: AuditLog[] = [
    ...spklCreatedAudit,
    {
      id: "audit_correction_rizky",
      actorId: "emp_budi",
      actorName: "Budi Santoso",
      action: "absensi_dikoreksi",
      objectType: "absensi",
      objectId: "att_oldest_rizky",
      summary:
        "Jam pulang Rizky Hidayat pada SPKL Rekonsiliasi faktur supplier dikoreksi.",
      before: { checkOutAt: null, durationMinutes: null },
      after: { checkOutAt: oldestEnd, durationMinutes: 139 },
      createdAt: subDays(now, 9).toISOString(),
    },
    {
      id: "audit_active_updated",
      actorId: "emp_budi",
      actorName: "Budi Santoso",
      action: "spkl_diubah",
      objectType: "spkl",
      objectId: "spkl_active",
      summary: "Radius absen SPKL Migrasi data inventori Q4 diperbarui.",
      before: { radiusMeters: 120 },
      after: { radiusMeters: 180 },
      createdAt: subMinutes(now, 50).toISOString(),
    },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    seededAt: nowIso,
    meta: { nextSpklSequence: 7 },
    divisions,
    employees,
    spkls,
    spklWorkers,
    attendances,
    documentations,
    policy: {
      id: "policy",
      roundingMinutes: 15,
      dailyLimitMinutes: 480,
      weeklyLimitMinutes: 2400,
      docGraceMinutes: 60,
      requireDocumentation: false,
      defaultRadiusMeters: 120,
      maxGpsAccuracyMeters: 100,
      defaultLocation: SITE,
      timezone: APP_TIMEZONE,
      updatedAt: nowIso,
      updatedBy: "emp_budi",
    },
    otps: [],
    notifications: [
      {
        id: "ntf_seed_1",
        recipientId: "emp_andi",
        recipientPhone: "6281234567891",
        type: "spkl_baru",
        message:
          "Halo Andi, kamu ditugaskan pada SPKL Migrasi data inventori Q4. Lembur dimulai sesuai jadwal di aplikasi SIBUMA.",
        status: "demo",
        createdAt: spkls[0].createdAt,
      },
      {
        id: "ntf_seed_2",
        recipientId: "emp_siti",
        recipientPhone: "6281234567892",
        type: "spkl_baru",
        message:
          "Halo Siti, kamu ditugaskan pada SPKL Migrasi data inventori Q4. Lembur dimulai sesuai jadwal di aplikasi SIBUMA.",
        status: "demo",
        createdAt: spkls[0].createdAt,
      },
    ],
    auditLogs,
  };
}

