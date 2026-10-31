-- Pekerjaan harian dapat dibagikan ke halaman pengunjung per area. Default
-- nonaktif agar tidak ada data lama yang tiba-tiba tampil publik.
ALTER TABLE manual_works
 ADD COLUMN IF NOT EXISTS public_visible boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS manual_works_public_location
 ON manual_works(location_id, start_date DESC, id)
 WHERE public_visible AND status <> 'dibatalkan';
