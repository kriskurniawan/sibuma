-- All application entities are rows, never an application-wide JSON document.
CREATE TABLE IF NOT EXISTS employees (
 id text PRIMARY KEY, nik text NOT NULL, name text NOT NULL, phone text NOT NULL UNIQUE,
 role text NOT NULL CHECK (role IN ('pekerja','atasan')),
 supervisor_id text REFERENCES employees(id) DEFERRABLE INITIALLY DEFERRED,
 division_id text, active boolean NOT NULL,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 CHECK (supervisor_id IS DISTINCT FROM id),
 CHECK (role <> 'pekerja' OR (supervisor_id IS NOT NULL AND division_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS employees_nik_unique ON employees(lower(nik));
CREATE INDEX IF NOT EXISTS employees_supervisor_name ON employees(supervisor_id, active DESC, name, id);
CREATE INDEX IF NOT EXISTS employees_division ON employees(division_id);
CREATE TABLE IF NOT EXISTS divisions (
 id text PRIMARY KEY, name text NOT NULL, description text NOT NULL,
 supervisor_id text NOT NULL REFERENCES employees(id) DEFERRABLE INITIALLY DEFERRED,
 active boolean NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 UNIQUE (id, supervisor_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS divisions_owner_name_unique ON divisions(supervisor_id, lower(name));
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='employees_division_owner_fk') THEN
 ALTER TABLE employees ADD CONSTRAINT employees_division_owner_fk FOREIGN KEY (division_id,supervisor_id)
 REFERENCES divisions(id,supervisor_id) DEFERRABLE INITIALLY DEFERRED;
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS spkls (
 id text PRIMARY KEY, number text NOT NULL UNIQUE, title text NOT NULL, description text NOT NULL,
 date date NOT NULL, start_at timestamptz NOT NULL, end_at timestamptz NOT NULL CHECK (end_at > start_at),
 location_latitude double precision NOT NULL CHECK (location_latitude BETWEEN -90 AND 90),
 location_longitude double precision NOT NULL CHECK (location_longitude BETWEEN -180 AND 180), location_address text,
 radius_meters integer NOT NULL CHECK (radius_meters > 0),
 created_by text NOT NULL REFERENCES employees(id), division_id text NOT NULL,
 requires_documentation boolean NOT NULL, canceled_at timestamptz, cancel_reason text,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 FOREIGN KEY (division_id,created_by) REFERENCES divisions(id,supervisor_id)
);
CREATE INDEX IF NOT EXISTS spkls_owner_date ON spkls(created_by,date DESC,id);
CREATE INDEX IF NOT EXISTS spkls_unfinalized_end ON spkls(end_at,id) WHERE canceled_at IS NULL;
CREATE TABLE IF NOT EXISTS spkl_workers (
 spkl_id text NOT NULL REFERENCES spkls(id) ON DELETE CASCADE,
 employee_id text NOT NULL REFERENCES employees(id), assigned_at timestamptz NOT NULL,
 PRIMARY KEY(spkl_id,employee_id)
);
CREATE INDEX IF NOT EXISTS spkl_workers_employee ON spkl_workers(employee_id,spkl_id);
CREATE TABLE IF NOT EXISTS attendances (
 id text PRIMARY KEY, spkl_id text NOT NULL, employee_id text NOT NULL,
 check_in_at timestamptz, check_out_at timestamptz,
 duration_minutes integer CHECK (duration_minutes >= 0),
 status text NOT NULL CHECK (status IN ('berjalan','selesai','ditutup_otomatis','tidak_hadir','dikoreksi')),
 correction_reason text, corrected_by text REFERENCES employees(id), corrected_at timestamptz,
 check_in_location_latitude double precision, check_in_location_longitude double precision, check_in_location_address text,
 check_in_location_accuracy double precision, check_in_location_distance_from_site double precision, check_in_location_captured_at timestamptz,
 check_out_location_latitude double precision, check_out_location_longitude double precision, check_out_location_address text,
 check_out_location_accuracy double precision, check_out_location_distance_from_site double precision, check_out_location_captured_at timestamptz,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 UNIQUE(spkl_id,employee_id), UNIQUE(id,spkl_id,employee_id),
 FOREIGN KEY(spkl_id,employee_id) REFERENCES spkl_workers(spkl_id,employee_id) ON DELETE CASCADE,
 CHECK(check_out_at IS NULL OR check_in_at IS NOT NULL),
 CHECK(check_out_at IS NULL OR check_out_at >= check_in_at)
);
CREATE INDEX IF NOT EXISTS attendances_employee ON attendances(employee_id,spkl_id);
CREATE INDEX IF NOT EXISTS attendances_running ON attendances(spkl_id) WHERE status='berjalan';
CREATE TABLE IF NOT EXISTS documentations (
 id text PRIMARY KEY, spkl_id text NOT NULL, attendance_id text NOT NULL, employee_id text NOT NULL,
 storage_provider text NOT NULL CHECK(storage_provider='s3'), storage_key text NOT NULL,
 file_name text NOT NULL, mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
 size_bytes integer NOT NULL CHECK(size_bytes > 0), description text NOT NULL, taken_at timestamptz NOT NULL,
 location_latitude double precision, location_longitude double precision, location_address text, created_at timestamptz NOT NULL,
 FOREIGN KEY(attendance_id,spkl_id,employee_id) REFERENCES attendances(id,spkl_id,employee_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS documentations_spkl_time ON documentations(spkl_id,taken_at DESC,id);
CREATE INDEX IF NOT EXISTS documentations_attendance ON documentations(attendance_id);
CREATE INDEX IF NOT EXISTS documentations_storage_key ON documentations(storage_key);
CREATE TABLE IF NOT EXISTS policies (
 id text PRIMARY KEY CHECK(id='policy'), rounding_minutes integer NOT NULL CHECK(rounding_minutes >= 0),
 daily_limit_minutes integer NOT NULL CHECK(daily_limit_minutes > 0), weekly_limit_minutes integer NOT NULL CHECK(weekly_limit_minutes > 0),
 doc_grace_minutes integer NOT NULL CHECK(doc_grace_minutes >= 0), require_documentation boolean NOT NULL,
 default_radius_meters integer NOT NULL CHECK(default_radius_meters > 0), max_gps_accuracy_meters integer NOT NULL CHECK(max_gps_accuracy_meters > 0),
 default_location_latitude double precision NOT NULL, default_location_longitude double precision NOT NULL, default_location_address text,
 timezone text NOT NULL CHECK(timezone='Asia/Jakarta'), updated_at timestamptz NOT NULL,
 updated_by text NOT NULL REFERENCES employees(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE IF NOT EXISTS otp_records (
 id text PRIMARY KEY, phone text NOT NULL, employee_id text NOT NULL REFERENCES employees(id),
 code_salt text NOT NULL, code_hash text NOT NULL, created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 attempts integer NOT NULL CHECK(attempts >= 0), status text NOT NULL CHECK(status IN ('terkirim','demo','gagal','terpakai')),
 used_at timestamptz, locked_until timestamptz
);
CREATE INDEX IF NOT EXISTS otp_phone_latest ON otp_records(phone,created_at DESC,id);
CREATE INDEX IF NOT EXISTS otp_expiry ON otp_records(expires_at);
CREATE TABLE IF NOT EXISTS notification_logs (
 id text PRIMARY KEY, recipient_id text REFERENCES employees(id), recipient_phone text NOT NULL,
 type text NOT NULL CHECK(type IN ('otp','spkl_baru','spkl_diubah','spkl_dibatalkan','pengingat')),
 message text NOT NULL, status text NOT NULL CHECK(status IN ('demo','terkirim','gagal')),
 provider_message_id text, error text, created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS notification_logs_latest ON notification_logs(created_at DESC,id);
CREATE TABLE IF NOT EXISTS audit_logs (
 id text PRIMARY KEY,
 -- Historical actor identity is deliberately retained even if an account is retired; 'system' is not an employee.
 actor_id text NOT NULL, actor_name text NOT NULL, action text NOT NULL,
 object_type text NOT NULL CHECK(object_type IN ('spkl','absensi','karyawan','divisi','kebijakan','autentikasi')),
 object_id text NOT NULL, summary text NOT NULL, "before" jsonb, "after" jsonb, created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_logs_latest ON audit_logs(created_at DESC,id);
CREATE INDEX IF NOT EXISTS audit_logs_object ON audit_logs(object_type,object_id,created_at DESC);
CREATE SEQUENCE IF NOT EXISTS spkl_number_sequence;
CREATE TABLE IF NOT EXISTS schema_migrations (
 id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(), source_version bigint,
 source_sha256 text, verification jsonb NOT NULL DEFAULT '{}'::jsonb
);
