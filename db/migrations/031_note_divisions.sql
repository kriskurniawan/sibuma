-- Catatan dapat ditujukan ke beberapa divisi sekaligus (lintas divisi).
-- `notes.division_name` menyimpan nama gabungan sebagai snapshot tampilan,
-- sedangkan relasi per divisi disimpan di `note_divisions` agar pemeriksaan
-- visibilitas tidak perlu memecah string.
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_audience_type_check;
ALTER TABLE notes ADD CONSTRAINT notes_audience_type_check
 CHECK (audience_type IN ('division','divisions','employees'));

CREATE TABLE IF NOT EXISTS note_divisions (
 note_id text NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
 division_id text NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
 division_name text NOT NULL,
 PRIMARY KEY (note_id, division_id)
);

CREATE INDEX IF NOT EXISTS note_divisions_division
 ON note_divisions(division_id, note_id);
