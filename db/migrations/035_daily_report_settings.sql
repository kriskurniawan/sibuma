-- Judul dan catatan laporan harian disimpan per tim dan tanggal.
--
-- `owner_id` adalah atasan pemilik tim; pekerja memakai `supervisor_id` mereka
-- sehingga seluruh pekerja dalam satu tim berbagi baris yang sama. Tanggal
-- dipisahkan agar catatan harian tidak saling menimpa; halaman laporan memakai
-- entri terakhir sebagai awalan ketika tanggal baru belum disimpan.
CREATE TABLE IF NOT EXISTS daily_report_settings (
  owner_id text NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  title text NOT NULL DEFAULT ''
    CHECK (char_length(title) <= 80),
  notes text NOT NULL DEFAULT ''
    CHECK (char_length(notes) <= 1000),
  updated_by text REFERENCES employees(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, report_date)
);
