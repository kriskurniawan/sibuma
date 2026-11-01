-- Kunci idempotensi per penulis mencegah catatan ganda ketika respons POST
-- hilang dan klien mencoba ulang permintaan yang sama.
ALTER TABLE notes ADD COLUMN IF NOT EXISTS client_request_id text;

ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_client_request_id_check;
ALTER TABLE notes ADD CONSTRAINT notes_client_request_id_check
 CHECK (client_request_id IS NULL OR char_length(client_request_id) BETWEEN 8 AND 64);

CREATE UNIQUE INDEX IF NOT EXISTS notes_client_request_unique
 ON notes(author_id, client_request_id)
 WHERE client_request_id IS NOT NULL;

-- Objek storage yang gagal dihapus dicatat agar pembersihan dapat diulang.
-- Baris dihapus setelah objek benar-benar hilang dari bucket.
CREATE TABLE IF NOT EXISTS storage_cleanup_queue (
 storage_key text PRIMARY KEY,
 storage_provider text NOT NULL DEFAULT 's3' CHECK (storage_provider IN ('s3')),
 attempts integer NOT NULL DEFAULT 1 CHECK (attempts >= 1),
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storage_cleanup_queue_created
 ON storage_cleanup_queue(created_at);
