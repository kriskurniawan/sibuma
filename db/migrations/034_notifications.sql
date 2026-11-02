-- Notifikasi dalam aplikasi dan Web Push per perangkat.
--
-- `app_notifications` adalah kotak masuk yang tetap tersedia meskipun pengguna
-- menolak izin push. Satu baris disimpan per penerima, dan `dedupe_key` mencegah
-- notifikasi ganda ketika permintaan simpan diulang.
--
-- `push_subscriptions` menyimpan langganan perangkat. Endpoint unik karena
-- endpoint mewakili satu perangkat/browser; saat akun berganti, langganan yang
-- sama dipindahkan ke akun aktif, bukan diduplikasi.
--
-- `push_deliveries` adalah antrean pengiriman. Status `processing`,
-- `locked_until`, dan `next_attempt_at` memungkinkan percobaan ulang oleh
-- scheduler tanpa mengirim dua kali.
CREATE TABLE IF NOT EXISTS app_notifications (
  id text PRIMARY KEY,
  recipient_id text NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pekerjaan_baru','catatan_baru')),
  title text NOT NULL,
  body text NOT NULL,
  href text NOT NULL,
  actor_id text REFERENCES employees(id) ON DELETE SET NULL,
  actor_name text NOT NULL DEFAULT '',
  source_type text NOT NULL CHECK (source_type IN ('pekerjaan','catatan')),
  source_id text NOT NULL,
  dedupe_key text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_notifications_recipient_dedupe
  ON app_notifications(recipient_id,dedupe_key);
CREATE INDEX IF NOT EXISTS app_notifications_inbox
  ON app_notifications(recipient_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS app_notifications_unread
  ON app_notifications(recipient_id,created_at DESC,id DESC)
  WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id text PRIMARY KEY,
  employee_id text NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_employee
  ON push_subscriptions(employee_id);

CREATE TABLE IF NOT EXISTS push_deliveries (
  id text PRIMARY KEY,
  notification_id text NOT NULL REFERENCES app_notifications(id) ON DELETE CASCADE,
  subscription_id text NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id,subscription_id)
);

CREATE INDEX IF NOT EXISTS push_deliveries_due
  ON push_deliveries(next_attempt_at,id)
  WHERE status IN ('pending','processing');

INSERT INTO automation_jobs (id,interval_seconds,next_run_at)
VALUES ('push_deliveries',60,now())
ON CONFLICT (id) DO NOTHING;
