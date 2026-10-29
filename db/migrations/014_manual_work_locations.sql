-- Lokasi pekerjaan harian memakai hierarki lokasi checklist milik atasan
-- pemilik. location_name tetap menyimpan snapshot path untuk riwayat dan
-- sebagai fallback bila lokasi dihapus.
ALTER TABLE manual_works
 ADD COLUMN IF NOT EXISTS location_id text
 REFERENCES checklist_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS manual_works_location
 ON manual_works(location_id) WHERE location_id IS NOT NULL;
