-- Dokumen kerja: berkas referensi, panduan, dan tutorial milik satu karyawan.
-- Terpisah dari dokumentasi bukti pekerjaan yang immutable. Berkas bersifat
-- privat; pemilik dapat membagikannya hanya-baca ke divisinya atau ke atasan
-- langsung, dan dapat menutup akses kapan saja.
CREATE TABLE IF NOT EXISTS work_document_settings (
 id text PRIMARY KEY CHECK (id = 'settings'),
 uploads_enabled boolean NOT NULL DEFAULT true,
 max_file_bytes bigint NOT NULL DEFAULT 26214400 CHECK (max_file_bytes > 0),
 quota_bytes bigint NOT NULL DEFAULT 1073741824 CHECK (quota_bytes > 0),
 allowed_extensions text[] NOT NULL DEFAULT ARRAY['pdf','jpg','jpeg','png','docx','xlsx','pptx'],
 trash_retention_days integer NOT NULL DEFAULT 30
  CHECK (trash_retention_days BETWEEN 1 AND 365),
 share_to_division boolean NOT NULL DEFAULT true,
 share_to_supervisor boolean NOT NULL DEFAULT true,
 updated_by text REFERENCES employees(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (array_length(allowed_extensions, 1) >= 1),
 CHECK (allowed_extensions <@ ARRAY['pdf','jpg','jpeg','png','docx','xlsx','pptx'])
);
INSERT INTO work_document_settings (id) VALUES ('settings')
 ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS work_documents (
 id text PRIMARY KEY,
 owner_id text NOT NULL REFERENCES employees(id),
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
 description text NOT NULL DEFAULT '',
 storage_key text NOT NULL UNIQUE,
 file_name text NOT NULL,
 extension text NOT NULL,
 mime_type text NOT NULL,
 size_bytes bigint NOT NULL CHECK (size_bytes > 0),
 checksum_sha256 text NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 deleted_at timestamptz,
 deleted_by text REFERENCES employees(id),
 purge_after timestamptz,
 CHECK ((deleted_at IS NULL) = (purge_after IS NULL))
);
CREATE INDEX IF NOT EXISTS work_documents_owner_active
 ON work_documents(owner_id, updated_at DESC, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS work_documents_owner_trash
 ON work_documents(owner_id, deleted_at DESC, id) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS work_documents_purge
 ON work_documents(purge_after) WHERE purge_after IS NOT NULL;

CREATE TABLE IF NOT EXISTS work_document_shares (
 document_id text NOT NULL REFERENCES work_documents(id) ON DELETE CASCADE,
 audience text NOT NULL CHECK (audience IN ('division','supervisor')),
 enabled boolean NOT NULL DEFAULT true,
 updated_by text REFERENCES employees(id),
 updated_at timestamptz NOT NULL,
 PRIMARY KEY (document_id, audience)
);
CREATE INDEX IF NOT EXISTS work_document_shares_enabled
 ON work_document_shares(audience, document_id) WHERE enabled;

-- Audit sekarang juga mencakup dokumen kerja.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_object_type_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_object_type_check
 CHECK (object_type IN ('spkl','absensi','karyawan','divisi','kebijakan','autentikasi','checklist','tindak_lanjut','pekerjaan','dokumen'));
