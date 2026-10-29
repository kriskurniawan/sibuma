-- Nama petugas safety dicatat manual di kolom terpisah. Petugas safety
-- biasanya mendampingi pelaksanaan tindak lanjut.
-- Migrasi 017 sempat menambahkan pic_manual_name; kolom itu diganti nama agar
-- nilai yang sudah ada (bila ada) tetap tersimpan sebagai nama petugas safety.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'checklist_follow_ups'
      AND column_name = 'pic_manual_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'checklist_follow_ups'
      AND column_name = 'safety_name'
  ) THEN
    ALTER TABLE checklist_follow_ups RENAME COLUMN pic_manual_name TO safety_name;
  END IF;
END $$;

ALTER TABLE checklist_follow_ups
 ADD COLUMN IF NOT EXISTS safety_name text NOT NULL DEFAULT '';
