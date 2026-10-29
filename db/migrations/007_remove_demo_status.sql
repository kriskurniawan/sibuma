-- Demo mode is retired. Existing demo-labelled rows become failed deliveries
-- before the stricter constraints are installed.
UPDATE otp_records SET status='gagal' WHERE status='demo';
UPDATE notification_logs
 SET status='gagal',
     error=COALESCE(error,'Mode demo dihapus; pesan tidak pernah dikirim ke penyedia.')
 WHERE status='demo';

ALTER TABLE otp_records DROP CONSTRAINT IF EXISTS otp_records_status_check;
ALTER TABLE otp_records ADD CONSTRAINT otp_records_status_check
 CHECK(status IN ('menunggu','terkirim','gagal','terpakai'));

ALTER TABLE notification_logs DROP CONSTRAINT IF EXISTS notification_logs_status_check;
ALTER TABLE notification_logs ADD CONSTRAINT notification_logs_status_check
 CHECK(status IN ('terkirim','gagal'));
