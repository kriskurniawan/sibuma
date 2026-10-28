-- Checklist domain. A published template version is immutable: inspections
-- snapshot the version, labels and prompts so historical results never change
-- when a master template or location is renamed later.
CREATE TABLE IF NOT EXISTS checklist_locations (
 id text PRIMARY KEY,
 owner_id text NOT NULL REFERENCES employees(id),
 name text NOT NULL,
 description text NOT NULL DEFAULT '',
 parent_id text REFERENCES checklist_locations(id),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 CHECK (parent_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX IF NOT EXISTS checklist_locations_name
 ON checklist_locations(owner_id, coalesce(parent_id, ''), lower(name));
CREATE INDEX IF NOT EXISTS checklist_locations_owner ON checklist_locations(owner_id, active DESC, name, id);

CREATE TABLE IF NOT EXISTS checklist_templates (
 id text PRIMARY KEY,
 owner_id text NOT NULL REFERENCES employees(id),
 name text NOT NULL,
 category text NOT NULL,
 description text NOT NULL DEFAULT '',
 active boolean NOT NULL DEFAULT true,
 current_version integer NOT NULL DEFAULT 0 CHECK (current_version >= 0),
 created_by text NOT NULL REFERENCES employees(id),
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS checklist_templates_name ON checklist_templates(owner_id, lower(name));
CREATE INDEX IF NOT EXISTS checklist_templates_owner ON checklist_templates(owner_id, active DESC, name, id);

CREATE TABLE IF NOT EXISTS checklist_template_versions (
 id text PRIMARY KEY,
 template_id text NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
 version integer NOT NULL CHECK (version > 0),
 notes text NOT NULL DEFAULT '',
 created_by text NOT NULL REFERENCES employees(id),
 created_at timestamptz NOT NULL,
 UNIQUE (template_id, version)
);
CREATE INDEX IF NOT EXISTS checklist_template_versions_latest
 ON checklist_template_versions(template_id, version DESC, id);

CREATE TABLE IF NOT EXISTS checklist_template_items (
 id text PRIMARY KEY,
 version_id text NOT NULL REFERENCES checklist_template_versions(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK (position >= 0),
 prompt text NOT NULL,
 guidance text NOT NULL DEFAULT '',
 required boolean NOT NULL DEFAULT true,
 photo_policy text NOT NULL DEFAULT 'opsional'
  CHECK (photo_policy IN ('opsional','wajib','wajib_saat_masalah')),
 require_note_on_issue boolean NOT NULL DEFAULT true,
 UNIQUE (version_id, position)
);

CREATE TABLE IF NOT EXISTS checklist_schedules (
 id text PRIMARY KEY,
 owner_id text NOT NULL REFERENCES employees(id),
 template_id text NOT NULL REFERENCES checklist_templates(id),
 location_id text NOT NULL REFERENCES checklist_locations(id),
 interval_unit text NOT NULL CHECK (interval_unit IN ('hari','minggu','bulan')),
 interval_count integer NOT NULL CHECK (interval_count BETWEEN 1 AND 365),
 anchor_date date NOT NULL,
 due_days integer NOT NULL DEFAULT 0 CHECK (due_days BETWEEN 0 AND 90),
 active boolean NOT NULL DEFAULT true,
 created_by text NOT NULL REFERENCES employees(id),
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS checklist_schedules_owner ON checklist_schedules(owner_id, active DESC, id);

CREATE TABLE IF NOT EXISTS checklist_schedule_assignees (
 schedule_id text NOT NULL REFERENCES checklist_schedules(id) ON DELETE CASCADE,
 employee_id text NOT NULL REFERENCES employees(id),
 PRIMARY KEY (schedule_id, employee_id)
);
CREATE INDEX IF NOT EXISTS checklist_schedule_assignees_employee
 ON checklist_schedule_assignees(employee_id, schedule_id);

CREATE TABLE IF NOT EXISTS checklist_inspections (
 id text PRIMARY KEY,
 schedule_id text REFERENCES checklist_schedules(id) ON DELETE SET NULL,
 owner_id text NOT NULL REFERENCES employees(id),
 template_id text NOT NULL REFERENCES checklist_templates(id),
 template_version_id text NOT NULL REFERENCES checklist_template_versions(id),
 location_id text NOT NULL REFERENCES checklist_locations(id),
 occurrence_date date NOT NULL,
 due_at timestamptz NOT NULL,
 template_name text NOT NULL,
 category text NOT NULL,
 location_name text NOT NULL,
 period_label text NOT NULL,
 status text NOT NULL DEFAULT 'belum_dimulai'
  CHECK (status IN ('belum_dimulai','berlangsung','selesai','dilewati')),
 started_at timestamptz,
 completed_at timestamptz,
 completed_by text REFERENCES employees(id),
 reopened_at timestamptz,
 reopened_by text REFERENCES employees(id),
 reopen_reason text,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS checklist_inspections_schedule_occurrence
 ON checklist_inspections(schedule_id, occurrence_date) WHERE schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS checklist_inspections_owner_due
 ON checklist_inspections(owner_id, status, due_at, id);
CREATE INDEX IF NOT EXISTS checklist_inspections_location
 ON checklist_inspections(owner_id, location_id, occurrence_date DESC, id);

CREATE TABLE IF NOT EXISTS checklist_inspection_assignees (
 inspection_id text NOT NULL REFERENCES checklist_inspections(id) ON DELETE CASCADE,
 employee_id text NOT NULL REFERENCES employees(id),
 PRIMARY KEY (inspection_id, employee_id)
);
CREATE INDEX IF NOT EXISTS checklist_inspection_assignees_employee
 ON checklist_inspection_assignees(employee_id, inspection_id);

CREATE TABLE IF NOT EXISTS checklist_answers (
 id text PRIMARY KEY,
 inspection_id text NOT NULL REFERENCES checklist_inspections(id) ON DELETE CASCADE,
 item_id text NOT NULL REFERENCES checklist_template_items(id),
 position integer NOT NULL,
 prompt text NOT NULL,
 guidance text NOT NULL DEFAULT '',
 required boolean NOT NULL,
 photo_policy text NOT NULL
  CHECK (photo_policy IN ('opsional','wajib','wajib_saat_masalah')),
 require_note_on_issue boolean NOT NULL,
 condition text CHECK (condition IN ('baik','perlu_perhatian','tidak_baik','tidak_berlaku')),
 note text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 0,
 updated_by text REFERENCES employees(id),
 updated_at timestamptz,
 UNIQUE (inspection_id, item_id)
);
CREATE INDEX IF NOT EXISTS checklist_answers_inspection
 ON checklist_answers(inspection_id, position, id);

CREATE TABLE IF NOT EXISTS checklist_follow_ups (
 id text PRIMARY KEY,
 inspection_id text NOT NULL REFERENCES checklist_inspections(id) ON DELETE CASCADE,
 answer_id text REFERENCES checklist_answers(id) ON DELETE SET NULL,
 owner_id text NOT NULL REFERENCES employees(id),
 title text NOT NULL,
 description text NOT NULL DEFAULT '',
 pic_id text REFERENCES employees(id),
 priority text NOT NULL DEFAULT 'sedang'
  CHECK (priority IN ('rendah','sedang','tinggi','mendesak')),
 due_date date,
 status text NOT NULL DEFAULT 'terbuka'
  CHECK (status IN ('terbuka','diproses','tertunda','selesai','dibatalkan')),
 progress_note text NOT NULL DEFAULT '',
 cancel_reason text,
 result_note text NOT NULL DEFAULT '',
 created_by text NOT NULL REFERENCES employees(id),
 started_at timestamptz,
 completed_at timestamptz,
 completed_by text REFERENCES employees(id),
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS checklist_follow_ups_answer_active
 ON checklist_follow_ups(answer_id) WHERE answer_id IS NOT NULL AND status <> 'dibatalkan';
CREATE INDEX IF NOT EXISTS checklist_follow_ups_owner_status
 ON checklist_follow_ups(owner_id, status, due_date, id);
CREATE INDEX IF NOT EXISTS checklist_follow_ups_inspection
 ON checklist_follow_ups(inspection_id, status, id);
CREATE INDEX IF NOT EXISTS checklist_follow_ups_pic
 ON checklist_follow_ups(pic_id, status, due_date, id);

CREATE TABLE IF NOT EXISTS checklist_follow_up_events (
 id text PRIMARY KEY,
 follow_up_id text NOT NULL REFERENCES checklist_follow_ups(id) ON DELETE CASCADE,
 actor_id text NOT NULL REFERENCES employees(id),
 actor_name text NOT NULL,
 action text NOT NULL,
 status text NOT NULL,
 note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS checklist_follow_up_events_latest
 ON checklist_follow_up_events(follow_up_id, created_at, id);

CREATE TABLE IF NOT EXISTS checklist_photos (
 id text PRIMARY KEY,
 inspection_id text NOT NULL REFERENCES checklist_inspections(id) ON DELETE CASCADE,
 answer_id text REFERENCES checklist_answers(id) ON DELETE CASCADE,
 follow_up_id text REFERENCES checklist_follow_ups(id) ON DELETE CASCADE,
 uploaded_by text NOT NULL REFERENCES employees(id),
 storage_provider text NOT NULL CHECK (storage_provider = 's3'),
 storage_key text NOT NULL UNIQUE,
 file_name text NOT NULL,
 mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
 size_bytes integer NOT NULL CHECK (size_bytes > 0),
 caption text NOT NULL DEFAULT '',
 stage text NOT NULL DEFAULT 'temuan' CHECK (stage IN ('temuan','perbaikan')),
 created_at timestamptz NOT NULL,
 CHECK (answer_id IS NOT NULL OR follow_up_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS checklist_photos_inspection
 ON checklist_photos(inspection_id, created_at, id);
CREATE INDEX IF NOT EXISTS checklist_photos_answer ON checklist_photos(answer_id);
CREATE INDEX IF NOT EXISTS checklist_photos_follow_up ON checklist_photos(follow_up_id);

-- Audit rows now cover the checklist domain as well.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_object_type_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_object_type_check
 CHECK (object_type IN ('spkl','absensi','karyawan','divisi','kebijakan','autentikasi','checklist','tindak_lanjut'));
