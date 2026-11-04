-- Data penggajian untuk rekap lembur bulanan.
--
-- Gaji disimpan terpisah dari `employees` agar tidak ikut pada payload pekerja,
-- SPKL, atau respons umum lain. Satu baris berlaku untuk satu bulan penuh
-- (tanpa prorata harian); rekap bulan tertentu memakai baris terbaru yang
-- `effective_month`-nya tidak melewati bulan rekap. Perubahan pada bulan baru
-- tidak mengubah rekap bulan sebelumnya.
CREATE TABLE IF NOT EXISTS employee_payrolls (
  employee_id text NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  effective_month date NOT NULL
    CHECK (effective_month = date_trunc('month', effective_month)::date),
  job_title text NOT NULL
    CHECK (char_length(btrim(job_title)) BETWEEN 1 AND 80),
  basic_salary bigint NOT NULL
    CHECK (basic_salary >= 0),
  updated_by text REFERENCES employees(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, effective_month)
);
CREATE INDEX IF NOT EXISTS employee_payrolls_latest
  ON employee_payrolls(employee_id, effective_month DESC);

-- Nama penandatangan rekap lembur disimpan per tim (atasan pemilik data).
-- Pengamat dapat memakai nama untuk ekspor saat itu, tetapi tidak boleh
-- mengubah simpanan tim.
CREATE TABLE IF NOT EXISTS team_report_signers (
  owner_id text PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  building_manager_name text NOT NULL DEFAULT ''
    CHECK (char_length(building_manager_name) <= 80),
  manager_name text NOT NULL DEFAULT ''
    CHECK (char_length(manager_name) <= 80),
  updated_by text REFERENCES employees(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Kalender libur nasional resmi. Cuti bersama sengaja tidak dimasukkan karena
-- tidak otomatis dihitung sebagai hari libur (HL) pada rekap lembur.
CREATE TABLE IF NOT EXISTS national_holidays (
  holiday_date date PRIMARY KEY,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO national_holidays (holiday_date, name) VALUES
  ('2025-01-01', 'Tahun Baru 2025 Masehi'),
  ('2025-01-27', 'Isra Mikraj Nabi Muhammad SAW'),
  ('2025-01-29', 'Tahun Baru Imlek 2576 Kongzili'),
  ('2025-03-29', 'Hari Suci Nyepi Tahun Baru Saka 1947'),
  ('2025-03-31', 'Idulfitri 1446 Hijriah'),
  ('2025-04-01', 'Idulfitri 1446 Hijriah'),
  ('2025-04-18', 'Wafat Yesus Kristus'),
  ('2025-04-20', 'Kebangkitan Yesus Kristus'),
  ('2025-05-01', 'Hari Buruh Internasional'),
  ('2025-05-12', 'Hari Raya Waisak 2569 BE'),
  ('2025-05-29', 'Kenaikan Yesus Kristus'),
  ('2025-06-01', 'Hari Lahir Pancasila'),
  ('2025-06-06', 'Iduladha 1446 Hijriah'),
  ('2025-06-27', 'Tahun Baru Islam 1447 Hijriah'),
  ('2025-08-17', 'Proklamasi Kemerdekaan RI'),
  ('2025-09-05', 'Maulid Nabi Muhammad SAW'),
  ('2025-12-25', 'Kelahiran Yesus Kristus'),
  ('2026-01-01', 'Tahun Baru 2026 Masehi'),
  ('2026-01-16', 'Isra Mikraj Nabi Muhammad SAW'),
  ('2026-02-17', 'Tahun Baru Imlek 2577 Kongzili'),
  ('2026-03-19', 'Hari Suci Nyepi Tahun Baru Saka 1948'),
  ('2026-03-21', 'Idulfitri 1447 Hijriah'),
  ('2026-03-22', 'Idulfitri 1447 Hijriah'),
  ('2026-04-03', 'Wafat Yesus Kristus'),
  ('2026-04-05', 'Kebangkitan Yesus Kristus'),
  ('2026-05-01', 'Hari Buruh Internasional'),
  ('2026-05-14', 'Kenaikan Yesus Kristus'),
  ('2026-05-27', 'Iduladha 1447 Hijriah'),
  ('2026-05-31', 'Hari Raya Waisak 2570 BE'),
  ('2026-06-01', 'Hari Lahir Pancasila'),
  ('2026-06-16', 'Tahun Baru Islam 1448 Hijriah'),
  ('2026-08-17', 'Proklamasi Kemerdekaan RI'),
  ('2026-08-25', 'Maulid Nabi Muhammad SAW'),
  ('2026-12-25', 'Kelahiran Yesus Kristus')
ON CONFLICT (holiday_date) DO NOTHING;
