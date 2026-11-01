-- Catatan singkat untuk divisi atau rekan kerja. Satu baris adalah satu
-- catatan; lampiran foto bersifat opsional dan disimpan terpisah agar catatan
-- teks tetap dapat dibuat tanpa storage.
--
-- Penerima disimpan eksplisit: `note_recipients` untuk karyawan terpilih, dan
-- `notes.division_id` untuk seluruh anggota divisi. Nama divisi disalin sebagai
-- snapshot agar catatan lama tetap terbaca bila divisi dihapus.
CREATE TABLE IF NOT EXISTS notes (
 id text PRIMARY KEY,
 author_id text NOT NULL REFERENCES employees(id),
 author_name text NOT NULL,
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
 body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
 audience_type text NOT NULL CHECK (audience_type IN ('division','employees')),
 division_id text REFERENCES divisions(id) ON DELETE SET NULL,
 division_name text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS notes_feed
 ON notes(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS notes_author
 ON notes(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notes_division
 ON notes(division_id, created_at DESC) WHERE division_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS note_recipients (
 note_id text NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
 employee_id text NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 PRIMARY KEY (note_id, employee_id)
);

CREATE INDEX IF NOT EXISTS note_recipients_employee
 ON note_recipients(employee_id, note_id);

CREATE TABLE IF NOT EXISTS note_attachments (
 note_id text PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
 storage_provider text NOT NULL DEFAULT 's3' CHECK (storage_provider IN ('s3')),
 storage_key text NOT NULL,
 file_name text NOT NULL,
 mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
 size_bytes bigint NOT NULL CHECK (size_bytes > 0),
 created_at timestamptz NOT NULL
);

-- Audit sekarang juga mencakup catatan.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_object_type_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_object_type_check
 CHECK (object_type IN ('spkl','absensi','karyawan','divisi','kebijakan','autentikasi','checklist','tindak_lanjut','pekerjaan','dokumen','catatan'));
