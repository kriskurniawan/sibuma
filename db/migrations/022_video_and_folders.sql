-- Dokumentasi video (unggahan galeri) dan folder Dokumen Kerja.
--
-- Video tidak direkam aplikasi, jadi tidak ada cap waktu terbakar maupun
-- penanda JPEG di dalam berkas. Bukti keaslian yang tersisa: ukuran dan tipe
-- yang ditandatangani saat unggah, magic bytes yang diperiksa server, serta
-- ETag objek yang dicatat saat penyelesaian.

-- 1. Dokumentasi bukti pekerjaan menerima video.
ALTER TABLE documentations DROP CONSTRAINT IF EXISTS documentations_mime_type_check;
ALTER TABLE documentations ADD CONSTRAINT documentations_mime_type_check
 CHECK (mime_type IN ('image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'));
ALTER TABLE documentations ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'photo'
 CHECK (kind IN ('photo','video'));
ALTER TABLE documentations ADD COLUMN IF NOT EXISTS duration_seconds integer
 CHECK (duration_seconds IS NULL OR duration_seconds >= 0);
ALTER TABLE documentations ADD COLUMN IF NOT EXISTS poster_key text;
ALTER TABLE documentations ADD COLUMN IF NOT EXISTS storage_etag text;

ALTER TABLE checklist_photos DROP CONSTRAINT IF EXISTS checklist_photos_mime_type_check;
ALTER TABLE checklist_photos ADD CONSTRAINT checklist_photos_mime_type_check
 CHECK (mime_type IN ('image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'));
ALTER TABLE checklist_photos ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'photo'
 CHECK (kind IN ('photo','video'));
ALTER TABLE checklist_photos ADD COLUMN IF NOT EXISTS duration_seconds integer
 CHECK (duration_seconds IS NULL OR duration_seconds >= 0);
ALTER TABLE checklist_photos ADD COLUMN IF NOT EXISTS poster_key text;
ALTER TABLE checklist_photos ADD COLUMN IF NOT EXISTS storage_etag text;

ALTER TABLE manual_work_photos DROP CONSTRAINT IF EXISTS manual_work_photos_mime_type_check;
ALTER TABLE manual_work_photos ADD CONSTRAINT manual_work_photos_mime_type_check
 CHECK (mime_type IN ('image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'));
ALTER TABLE manual_work_photos ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'photo'
 CHECK (kind IN ('photo','video'));
ALTER TABLE manual_work_photos ADD COLUMN IF NOT EXISTS duration_seconds integer
 CHECK (duration_seconds IS NULL OR duration_seconds >= 0);
ALTER TABLE manual_work_photos ADD COLUMN IF NOT EXISTS poster_key text;
ALTER TABLE manual_work_photos ADD COLUMN IF NOT EXISTS storage_etag text;

-- 2. Batas video diatur super admin. Tabel yang sama dengan batas foto agar
--    satu formulir pengaturan menampung seluruh batas dokumentasi.
ALTER TABLE photo_limit_settings
 ADD COLUMN IF NOT EXISTS video_enabled boolean NOT NULL DEFAULT true,
 ADD COLUMN IF NOT EXISTS max_video_bytes bigint NOT NULL DEFAULT 52428800
  CHECK (max_video_bytes BETWEEN 1048576 AND 104857600),
 ADD COLUMN IF NOT EXISTS spkl_videos integer NOT NULL DEFAULT 3
  CHECK (spkl_videos BETWEEN 0 AND 20),
 ADD COLUMN IF NOT EXISTS checklist_videos integer NOT NULL DEFAULT 2
  CHECK (checklist_videos BETWEEN 0 AND 20),
 ADD COLUMN IF NOT EXISTS work_videos integer NOT NULL DEFAULT 2
  CHECK (work_videos BETWEEN 0 AND 20);

-- 3. Dokumen Kerja menerima video sampai batas tersendiri.
ALTER TABLE work_document_settings DROP CONSTRAINT IF EXISTS work_document_settings_allowed_extensions_check1;
ALTER TABLE work_document_settings DROP CONSTRAINT IF EXISTS work_document_settings_allowed_extensions_subset;
ALTER TABLE work_document_settings ADD CONSTRAINT work_document_settings_allowed_extensions_subset
 CHECK (allowed_extensions <@ ARRAY['pdf','jpg','jpeg','png','docx','xlsx','pptx','mp4','webm','mov']);
UPDATE work_document_settings
 SET allowed_extensions = ARRAY['pdf','jpg','jpeg','png','docx','xlsx','pptx','mp4','webm','mov']
 WHERE id='settings' AND NOT ('mp4' = ANY(allowed_extensions));
ALTER TABLE work_document_settings ADD COLUMN IF NOT EXISTS max_video_bytes bigint NOT NULL DEFAULT 104857600
 CHECK (max_video_bytes BETWEEN 1048576 AND 104857600);

-- 4. Folder satu tingkat per pemilik. Deskripsi dokumen berpindah ke folder;
--    kolom lama tetap dipertahankan agar berkas lama tidak kehilangan teks.
CREATE TABLE IF NOT EXISTS work_document_folders (
 id text PRIMARY KEY,
 owner_id text NOT NULL REFERENCES employees(id),
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
 description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS work_document_folders_owner_name
 ON work_document_folders(owner_id, lower(name));

ALTER TABLE work_documents ADD COLUMN IF NOT EXISTS folder_id text
 REFERENCES work_document_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS work_documents_folder
 ON work_documents(folder_id, updated_at DESC, id) WHERE deleted_at IS NULL;

-- Berbagi hanya-baca per folder. Dokumen mewarisi izin folder; izin dokumen
-- sendiri tetap berlaku agar berkas yang sudah dibagikan tidak kehilangan akses
-- saat dipindahkan ke folder.
CREATE TABLE IF NOT EXISTS work_document_folder_shares (
 folder_id text NOT NULL REFERENCES work_document_folders(id) ON DELETE CASCADE,
 audience text NOT NULL CHECK (audience IN ('division','supervisor')),
 enabled boolean NOT NULL DEFAULT true,
 updated_by text REFERENCES employees(id),
 updated_at timestamptz NOT NULL,
 PRIMARY KEY (folder_id, audience)
);
CREATE INDEX IF NOT EXISTS work_document_folder_shares_enabled
 ON work_document_folder_shares(audience, folder_id) WHERE enabled;
