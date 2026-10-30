-- Batas jumlah foto dokumentasi yang dapat diubah super admin.
-- Satu baris pengaturan; nilai awal mengikuti batas lama (6/6/12).
CREATE TABLE IF NOT EXISTS photo_limit_settings (
 id text PRIMARY KEY CHECK (id = 'settings'),
 checklist_photos integer NOT NULL DEFAULT 6
  CHECK (checklist_photos BETWEEN 1 AND 50),
 work_photos integer NOT NULL DEFAULT 6
  CHECK (work_photos BETWEEN 1 AND 50),
 spkl_photos integer NOT NULL DEFAULT 12
  CHECK (spkl_photos BETWEEN 1 AND 50),
 updated_by text REFERENCES employees(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO photo_limit_settings (id) VALUES ('settings')
ON CONFLICT (id) DO NOTHING;
