-- Satu catatan dapat memiliki beberapa foto. Tabel lampiran sebelumnya
-- memakai `note_id` sebagai primary key (satu foto per catatan), sehingga
-- dibutuhkan id sendiri dan urutan tampil.
ALTER TABLE note_attachments DROP CONSTRAINT IF EXISTS note_attachments_pkey;
ALTER TABLE note_attachments ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE note_attachments ADD COLUMN IF NOT EXISTS sort_order smallint NOT NULL DEFAULT 0;

UPDATE note_attachments
SET id = 'att_' || substr(md5(note_id || storage_key), 1, 24)
WHERE id IS NULL;

ALTER TABLE note_attachments ALTER COLUMN id SET NOT NULL;
ALTER TABLE note_attachments ADD CONSTRAINT note_attachments_pkey PRIMARY KEY (id);

ALTER TABLE note_attachments DROP CONSTRAINT IF EXISTS note_attachments_sort_order_check;
ALTER TABLE note_attachments ADD CONSTRAINT note_attachments_sort_order_check
 CHECK (sort_order >= 0);

CREATE INDEX IF NOT EXISTS note_attachments_note
 ON note_attachments(note_id, sort_order);
