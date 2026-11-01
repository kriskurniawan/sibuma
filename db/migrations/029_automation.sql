-- Otomasi terjadwal dan outbox notifikasi persisten.
--
-- `automation_jobs` menyimpan jadwal berikutnya per pekerjaan. Klaim dilakukan
-- dengan satu UPDATE atomik sehingga beberapa pemanggilan scheduler tidak
-- menjalankan pekerjaan yang sama secara bersamaan. `next_run_at` dimajukan saat
-- klaim, bukan saat selesai, agar irama pemanggilan tetap stabil.
--
-- `notification_outbox` menyimpan pesan sebelum dikirim. Status `pending` dan
-- `processing` memungkinkan percobaan ulang setelah gangguan penyedia atau
-- proses yang mati. `dedupe_key` mencegah pesan yang sama dibuat dua kali.
CREATE TABLE IF NOT EXISTS automation_jobs (
  id text PRIMARY KEY,
  interval_seconds integer NOT NULL CHECK (interval_seconds > 0),
  next_run_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  last_result jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO automation_jobs (id, interval_seconds, next_run_at)
VALUES
  ('notification_outbox', 60, now()),
  ('attendance_finalization', 60, now()),
  ('checklist_generation', 3600, now()),
  ('document_purge', 86400, now())
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS notification_outbox (
  id text PRIMARY KEY,
  dedupe_key text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN (
    'spkl_baru', 'spkl_diubah', 'spkl_dibatalkan', 'pengingat'
  )),
  recipient_id text REFERENCES employees(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  spkl_id text REFERENCES spkls(id) ON DELETE SET NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS notification_outbox_due
  ON notification_outbox(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS notification_outbox_recipient
  ON notification_outbox(recipient_id, created_at DESC);
