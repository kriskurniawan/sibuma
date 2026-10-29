-- Setiap titik absensi punya radiusnya sendiri. Nilai awal disalin dari radius
-- default kebijakan agar perilaku titik yang sudah ada tidak berubah.
ALTER TABLE work_locations
 ADD COLUMN IF NOT EXISTS radius_meters integer;

UPDATE work_locations
SET radius_meters = LEAST(
 1000,
 GREATEST(
  25,
  COALESCE(
   (SELECT default_radius_meters FROM policies WHERE id='policy'),
   120
  )
 )
)
WHERE radius_meters IS NULL;

ALTER TABLE work_locations
 ALTER COLUMN radius_meters SET DEFAULT 120,
 ALTER COLUMN radius_meters SET NOT NULL;

ALTER TABLE work_locations
 DROP CONSTRAINT IF EXISTS work_locations_radius_meters_check;
ALTER TABLE work_locations
 ADD CONSTRAINT work_locations_radius_meters_check
 CHECK (radius_meters BETWEEN 25 AND 1000);
