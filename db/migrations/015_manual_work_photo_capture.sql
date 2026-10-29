-- Waktu pengambilan foto pekerjaan harian disimpan terpisah dari waktu unggah.
-- Baris lama tetap NULL; UI memakai created_at sebagai fallback.
ALTER TABLE manual_work_photos
 ADD COLUMN IF NOT EXISTS taken_at timestamptz,
 ADD COLUMN IF NOT EXISTS capture_source text;

ALTER TABLE manual_work_photos
 DROP CONSTRAINT IF EXISTS manual_work_photos_capture_source_check;
ALTER TABLE manual_work_photos
 ADD CONSTRAINT manual_work_photos_capture_source_check
 CHECK (capture_source IS NULL OR capture_source IN ('exif','device'));
