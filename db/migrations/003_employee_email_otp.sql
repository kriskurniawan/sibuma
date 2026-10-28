-- Additive: existing contacts and business records are never rewritten.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS employees_email_unique ON employees(lower(email)) WHERE email IS NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='employees_email_normalized') THEN
  ALTER TABLE employees ADD CONSTRAINT employees_email_normalized CHECK(email IS NULL OR (email=lower(btrim(email)) AND length(email) BETWEEN 3 AND 254 AND email LIKE '%@%'));
 END IF;
END $$;
ALTER TABLE otp_records ADD COLUMN IF NOT EXISTS identifier text;
ALTER TABLE otp_records ADD COLUMN IF NOT EXISTS channel text CHECK(channel IN ('whatsapp','email'));
ALTER TABLE otp_records ADD COLUMN IF NOT EXISTS destination text;
ALTER TABLE otp_records ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE otp_records ADD COLUMN IF NOT EXISTS attempts_reset_at timestamptz;
ALTER TABLE otp_records DROP CONSTRAINT IF EXISTS otp_records_status_check;
ALTER TABLE otp_records ADD CONSTRAINT otp_records_status_check CHECK(status IN ('menunggu','terkirim','demo','gagal','terpakai'));
CREATE INDEX IF NOT EXISTS otp_employee_latest ON otp_records(employee_id,created_at DESC,id DESC);
