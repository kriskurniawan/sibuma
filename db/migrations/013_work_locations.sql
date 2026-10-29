-- Master titik absensi. Hanya super admin yang boleh menambah atau mengubah
-- titik; atasan memilih salah satu titik aktif saat membuat SPKL.
CREATE TABLE IF NOT EXISTS work_locations (
 id text PRIMARY KEY,
 name text NOT NULL,
 address text NOT NULL DEFAULT '',
 latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
 longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
 active boolean NOT NULL DEFAULT true,
 created_by text REFERENCES employees(id),
 updated_by text REFERENCES employees(id),
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS work_locations_name_unique
 ON work_locations(lower(name));
CREATE INDEX IF NOT EXISTS work_locations_active_name
 ON work_locations(active DESC, lower(name), id);

-- SPKL menyimpan snapshot koordinat dan referensi ke titik resmi.
ALTER TABLE spkls ADD COLUMN IF NOT EXISTS work_location_id text
 REFERENCES work_locations(id);
CREATE INDEX IF NOT EXISTS spkls_work_location
 ON spkls(work_location_id);

-- Titik default lama menjadi titik resmi pertama pada instalasi yang sudah ada.
INSERT INTO work_locations
 (id,name,address,latitude,longitude,active,created_at,updated_at)
SELECT 'wl_default','Titik absen utama',coalesce(default_location_address,''),
 default_location_latitude,default_location_longitude,true,updated_at,updated_at
FROM policies
WHERE NOT EXISTS (SELECT 1 FROM work_locations)
ON CONFLICT (id) DO NOTHING;

-- Pertahankan titik-titik SPKL lama agar riwayat tetap dapat dibuka dan diedit.
INSERT INTO work_locations
 (id,name,address,latitude,longitude,active,created_at,updated_at)
SELECT 'wl_' || substr(md5(p.latitude::text || ':' || p.longitude::text),1,24),
 left(coalesce(nullif(p.address,''),'Titik absen'),50) || ' · ' ||
 round(p.latitude::numeric,5) || ',' || round(p.longitude::numeric,5),
 coalesce(p.address,''),p.latitude,p.longitude,true,now(),now()
FROM (
 SELECT DISTINCT ON (location_latitude,location_longitude)
  location_latitude latitude,location_longitude longitude,location_address address
 FROM spkls
) p
WHERE NOT EXISTS (
 SELECT 1 FROM work_locations w
 WHERE w.latitude=p.latitude AND w.longitude=p.longitude
)
ON CONFLICT (id) DO NOTHING;

UPDATE spkls s
SET work_location_id=w.id
FROM work_locations w
WHERE s.work_location_id IS NULL
 AND s.location_latitude=w.latitude
 AND s.location_longitude=w.longitude;
