-- Sesi yang ditutup otomatis karena pekerja lupa absen pulang harus ditinjau
-- atasan sebelum dianggap final. reviewed_at NULL pada status ditutup_otomatis
-- berarti masih menunggu persetujuan.
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS reviewed_by text REFERENCES employees(id);

CREATE INDEX IF NOT EXISTS attendances_review_pending
 ON attendances(spkl_id)
 WHERE status='ditutup_otomatis' AND reviewed_at IS NULL;
