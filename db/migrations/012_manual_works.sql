-- Pekerjaan harian manual: pekerjaan ad-hoc di luar checklist rutin dan di
-- luar SPKL/lembur. Satu baris adalah satu pekerjaan (boleh berlangsung
-- beberapa hari lewat rentang tanggal), bukan satu baris per hari.
CREATE TABLE IF NOT EXISTS manual_works (
 id text PRIMARY KEY,
 owner_id text NOT NULL REFERENCES employees(id),
 title text NOT NULL,
 description text NOT NULL DEFAULT '',
 location_name text NOT NULL DEFAULT '',
 start_date date NOT NULL,
 target_date date,
 requires_documentation boolean NOT NULL DEFAULT true,
 status text NOT NULL DEFAULT 'terbuka'
  CHECK (status IN ('terbuka','dikerjakan','selesai','dibatalkan')),
 source_follow_up_id text REFERENCES checklist_follow_ups(id) ON DELETE SET NULL,
 result_note text NOT NULL DEFAULT '',
 cancel_reason text,
 created_by text NOT NULL REFERENCES employees(id),
 started_at timestamptz,
 completed_at timestamptz,
 completed_by text REFERENCES employees(id),
 reopened_at timestamptz,
 reopened_by text REFERENCES employees(id),
 reopen_reason text,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 CHECK (target_date IS NULL OR target_date >= start_date)
);
CREATE INDEX IF NOT EXISTS manual_works_owner
 ON manual_works(owner_id, status, start_date, id);
CREATE INDEX IF NOT EXISTS manual_works_status_target
 ON manual_works(status, target_date, id);
CREATE INDEX IF NOT EXISTS manual_works_source_follow_up
 ON manual_works(source_follow_up_id) WHERE source_follow_up_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS manual_work_assignees (
 work_id text NOT NULL REFERENCES manual_works(id) ON DELETE CASCADE,
 employee_id text NOT NULL REFERENCES employees(id),
 PRIMARY KEY (work_id, employee_id)
);
CREATE INDEX IF NOT EXISTS manual_work_assignees_employee
 ON manual_work_assignees(employee_id, work_id);

CREATE TABLE IF NOT EXISTS manual_work_photos (
 id text PRIMARY KEY,
 work_id text NOT NULL REFERENCES manual_works(id) ON DELETE CASCADE,
 uploaded_by text NOT NULL REFERENCES employees(id),
 storage_provider text NOT NULL CHECK (storage_provider = 's3'),
 storage_key text NOT NULL UNIQUE,
 file_name text NOT NULL,
 mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
 size_bytes integer NOT NULL CHECK (size_bytes > 0),
 caption text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS manual_work_photos_work
 ON manual_work_photos(work_id, created_at, id);

CREATE TABLE IF NOT EXISTS manual_work_events (
 id text PRIMARY KEY,
 work_id text NOT NULL REFERENCES manual_works(id) ON DELETE CASCADE,
 actor_id text NOT NULL REFERENCES employees(id),
 actor_name text NOT NULL,
 action text NOT NULL,
 status text NOT NULL,
 note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS manual_work_events_latest
 ON manual_work_events(work_id, created_at, id);

-- Audit sekarang juga mencakup pekerjaan manual.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_object_type_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_object_type_check
 CHECK (object_type IN ('spkl','absensi','karyawan','divisi','kebijakan','autentikasi','checklist','tindak_lanjut','pekerjaan'));
