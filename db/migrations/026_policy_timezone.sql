-- Zona waktu resmi Indonesia tanpa DST. Nilai lain ditolak agar label
-- WIB/WITA/WIT dan batas tanggal SQL tetap deterministik.
ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_timezone_check;
ALTER TABLE policies
  ADD CONSTRAINT policies_timezone_check
  CHECK (timezone IN ('Asia/Jakarta','Asia/Makassar','Asia/Jayapura'));
