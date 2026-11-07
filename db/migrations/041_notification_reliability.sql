-- Idempotensi pembuatan SPKL. Klien mengirim `request_id` yang stabil untuk
-- satu intent; replay permintaan yang sama mengembalikan SPKL pertama, bukan
-- membuat SPKL dan antrean notifikasi baru.
ALTER TABLE spkls ADD COLUMN IF NOT EXISTS request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS spkls_request_unique
  ON spkls(created_by, request_id)
  WHERE request_id IS NOT NULL;

-- Penanda bahwa pemanggilan ke penyedia WhatsApp sudah dimulai. Jika proses
-- berhenti setelah penanda ini terpasang, pesan tidak dikirim ulang otomatis
-- agar tidak muncul ganda; pesan ditandai gagal untuk diperiksa manual.
ALTER TABLE notification_outbox
  ADD COLUMN IF NOT EXISTS delivery_attempted_at timestamptz;
