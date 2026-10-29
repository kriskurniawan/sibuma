-- Foto profil disimpan sebagai objek privat di object storage. Database hanya
-- menyimpan kunci objeknya; URL publik tidak pernah dibuat permanen.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_key text;
