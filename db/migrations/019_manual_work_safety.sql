-- Nama petugas safety pada pekerjaan harian dicatat manual, terpisah dari
-- pekerja yang ditugaskan.
ALTER TABLE manual_works
 ADD COLUMN IF NOT EXISTS safety_name text NOT NULL DEFAULT '';
