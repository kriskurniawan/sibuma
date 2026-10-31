-- Hari aktif dan jam per hari untuk jadwal checklist. Minggu dapat
-- dinonaktifkan tanpa membuat occurrence, dan Sabtu dapat memakai jam
-- 09:00-12:00. Baris lama mendapat semua hari aktif 00:00-23:59 agar perilaku
-- jadwal yang sudah ada tidak berubah.
CREATE TABLE IF NOT EXISTS checklist_schedule_days (
 schedule_id text NOT NULL REFERENCES checklist_schedules(id) ON DELETE CASCADE,
 weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
 enabled boolean NOT NULL DEFAULT true,
 start_time time NOT NULL DEFAULT '00:00',
 end_time time NOT NULL DEFAULT '23:59',
 PRIMARY KEY (schedule_id, weekday),
 CHECK (NOT enabled OR end_time > start_time)
);
CREATE INDEX IF NOT EXISTS checklist_schedule_days_weekday
 ON checklist_schedule_days(weekday, enabled, schedule_id);

INSERT INTO checklist_schedule_days (schedule_id, weekday, enabled, start_time, end_time)
SELECT s.id, d.weekday, true, '00:00', '23:59'
FROM checklist_schedules s
CROSS JOIN generate_series(1, 7) AS d(weekday)
ON CONFLICT (schedule_id, weekday) DO NOTHING;

-- Waktu mulai pengisian disimpan sebagai snapshot agar perubahan jadwal tidak
-- menggeser checklist yang sudah berjalan atau selesai.
ALTER TABLE checklist_inspections
 ADD COLUMN IF NOT EXISTS opens_at timestamptz;

UPDATE checklist_inspections i
SET opens_at = i.occurrence_date::timestamp AT TIME ZONE
  coalesce((SELECT timezone FROM policies WHERE id = 'policy'), 'Asia/Jakarta')
WHERE i.opens_at IS NULL;

ALTER TABLE checklist_inspections
 ALTER COLUMN opens_at SET NOT NULL;
