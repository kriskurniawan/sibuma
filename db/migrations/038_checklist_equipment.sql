-- Master peralatan per area dan riwayat perawatan terlaksana.
--
-- QR tetap menunjuk ke area, bukan ke peralatan. Satu area dapat memiliki
-- beberapa unit (mis. Genset 1 dan Genset 2); `code` memberi identitas tetap
-- agar riwayat tiap unit tidak tercampur. Riwayat di sini adalah catatan
-- aktivitas yang sudah terjadi, bukan alur pekerjaan atau tindak lanjut.
CREATE TABLE IF NOT EXISTS checklist_equipment (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  location_id text NOT NULL REFERENCES checklist_locations(id) ON DELETE CASCADE,
  code text NOT NULL
    CHECK (char_length(btrim(code)) BETWEEN 1 AND 40),
  name text NOT NULL
    CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
  category text NOT NULL DEFAULT ''
    CHECK (char_length(category) <= 60),
  public_enabled boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL REFERENCES employees(id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS checklist_equipment_code
  ON checklist_equipment(owner_id, lower(code));
CREATE INDEX IF NOT EXISTS checklist_equipment_location
  ON checklist_equipment(owner_id, location_id, active DESC, name, id);
CREATE INDEX IF NOT EXISTS checklist_equipment_public_location
  ON checklist_equipment(location_id, name, id)
  WHERE active AND public_enabled;

CREATE TABLE IF NOT EXISTS checklist_equipment_maintenance (
  id text PRIMARY KEY,
  equipment_id text NOT NULL REFERENCES checklist_equipment(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  activity text NOT NULL
    CHECK (activity IN ('penggantian', 'perbaikan', 'pengisian', 'servis')),
  component text NOT NULL
    CHECK (char_length(btrim(component)) BETWEEN 1 AND 80),
  quantity numeric(12, 2)
    CHECK (quantity IS NULL OR quantity > 0),
  unit text NOT NULL DEFAULT ''
    CHECK (char_length(unit) <= 20),
  hour_meter integer
    CHECK (hour_meter IS NULL OR hour_meter >= 0),
  performed_date date NOT NULL,
  performed_by text REFERENCES employees(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT ''
    CHECK (char_length(description) <= 1000),
  -- Catatan dapat disembunyikan dari pengunjung tanpa menghapus riwayat
  -- internal. Publik juga tetap dibatasi oleh area dan peralatannya.
  public_visible boolean NOT NULL DEFAULT true,
  created_by text NOT NULL REFERENCES employees(id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS checklist_equipment_maintenance_equipment
  ON checklist_equipment_maintenance(equipment_id, performed_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS checklist_equipment_maintenance_owner
  ON checklist_equipment_maintenance(owner_id, performed_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS checklist_equipment_maintenance_public
  ON checklist_equipment_maintenance(equipment_id, performed_date DESC, id DESC)
  WHERE public_visible;
