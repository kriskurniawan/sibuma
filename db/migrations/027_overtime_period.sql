-- Periode akumulasi lembur bulanan. 1 berarti bulan kalender; 26 berarti
-- periode berjalan 26 bulan lalu sampai 25 bulan berjalan. Tanggal 29-31
-- dijepit ke akhir bulan oleh aplikasi.
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS overtime_period_start_day integer NOT NULL DEFAULT 1;

ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_overtime_period_start_day_check;
ALTER TABLE policies
  ADD CONSTRAINT policies_overtime_period_start_day_check
  CHECK (overtime_period_start_day BETWEEN 1 AND 31);
