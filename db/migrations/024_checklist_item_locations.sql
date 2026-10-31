-- Item checklist dapat menunjuk lokasi fisiknya sendiri. Grup berfungsi sebagai
-- default untuk sub-item; lokasi jadwal dipakai bila keduanya belum diisi.
-- Jadwal "per_lokasi" mendistribusikan item menjadi beberapa pemeriksaan yang
-- dibungkus satu paket per periode.
ALTER TABLE checklist_template_items
  ADD COLUMN IF NOT EXISTS location_id text REFERENCES checklist_locations(id);
CREATE INDEX IF NOT EXISTS checklist_template_items_location
  ON checklist_template_items(location_id);

ALTER TABLE checklist_schedules
  ADD COLUMN IF NOT EXISTS distribution_mode text NOT NULL DEFAULT 'tunggal';
ALTER TABLE checklist_schedules
  DROP CONSTRAINT IF EXISTS checklist_schedules_distribution_mode_check;
ALTER TABLE checklist_schedules
  ADD CONSTRAINT checklist_schedules_distribution_mode_check
  CHECK (distribution_mode IN ('tunggal', 'per_lokasi'));

CREATE TABLE IF NOT EXISTS checklist_inspection_packages (
  id text PRIMARY KEY,
  schedule_id text REFERENCES checklist_schedules(id) ON DELETE SET NULL,
  owner_id text NOT NULL REFERENCES employees(id),
  template_id text NOT NULL REFERENCES checklist_templates(id),
  template_version_id text NOT NULL REFERENCES checklist_template_versions(id),
  occurrence_date date NOT NULL,
  due_at timestamptz NOT NULL,
  template_name text NOT NULL,
  category text NOT NULL,
  period_label text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS checklist_inspection_packages_schedule_occurrence
  ON checklist_inspection_packages(schedule_id, occurrence_date)
  WHERE schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS checklist_inspection_packages_owner
  ON checklist_inspection_packages(owner_id, occurrence_date DESC, id);

ALTER TABLE checklist_inspections
  ADD COLUMN IF NOT EXISTS package_id text REFERENCES checklist_inspection_packages(id) ON DELETE CASCADE;

-- Satu paket tidak boleh memiliki dua pemeriksaan pada lokasi yang sama.
CREATE UNIQUE INDEX IF NOT EXISTS checklist_inspections_package_location
  ON checklist_inspections(package_id, location_id)
  WHERE package_id IS NOT NULL;

-- Pemeriksaan tunggal tetap idempoten per jadwal + tanggal. Anak paket memakai
-- indeks package/location di atas sehingga tidak dibatasi indeks ini.
DROP INDEX IF EXISTS checklist_inspections_schedule_occurrence;
CREATE UNIQUE INDEX IF NOT EXISTS checklist_inspections_schedule_occurrence_single
  ON checklist_inspections(schedule_id, occurrence_date)
  WHERE schedule_id IS NOT NULL AND package_id IS NULL;
