-- Satu pemilik tidak boleh memiliki lebih dari satu jadwal aktif dengan
-- template, lokasi, dan interval yang sama. Jadwal nonaktif tetap disimpan
-- sebagai arsip, sehingga tidak dibatasi oleh indeks parsial ini.
CREATE UNIQUE INDEX IF NOT EXISTS checklist_schedules_active_unique
  ON checklist_schedules(owner_id, template_id, location_id, interval_unit, interval_count)
  WHERE active;
