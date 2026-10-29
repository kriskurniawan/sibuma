-- Mode akses akun atasan. "read_only" tetap dapat melihat seluruh data tim
-- sendiri (dashboard, SPKL, absensi, checklist, temuan, foto, laporan), tetapi
-- tidak boleh melakukan perubahan operasional apa pun.
ALTER TABLE employees
 ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'full';

ALTER TABLE employees
 DROP CONSTRAINT IF EXISTS employees_access_mode_check;

ALTER TABLE employees
 ADD CONSTRAINT employees_access_mode_check
 CHECK (access_mode IN ('full', 'read_only'));
