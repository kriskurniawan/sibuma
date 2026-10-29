-- Status/kondisi checklist menjadi data, bukan enum tetap. Label, urutan,
-- warna, dan perilaku (temuan / wajib catatan) dapat diatur lewat Pengaturan.
CREATE TABLE IF NOT EXISTS checklist_conditions (
 id text PRIMARY KEY,
 label text NOT NULL,
 tone text NOT NULL DEFAULT 'neutral'
  CHECK (tone IN ('success','warning','danger','neutral')),
 is_issue boolean NOT NULL DEFAULT false,
 requires_note boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT true,
 position integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS checklist_conditions_label_unique
 ON checklist_conditions(lower(label));
CREATE INDEX IF NOT EXISTS checklist_conditions_order
 ON checklist_conditions(active, position, id);

INSERT INTO checklist_conditions
 (id,label,tone,is_issue,requires_note,active,position)
VALUES
 ('baik','Baik','success',false,false,true,10),
 ('perlu_perhatian','Perlu perhatian','warning',true,false,true,20),
 ('tidak_baik','Tidak baik','danger',true,false,true,30),
 ('tidak_berlaku','Tidak berlaku','neutral',false,true,true,40)
ON CONFLICT (id) DO NOTHING;

-- Enum lama diganti tabel acuan agar status baru bisa ditambahkan.
ALTER TABLE checklist_answers
 DROP CONSTRAINT IF EXISTS checklist_answers_condition_check;

DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname='checklist_answers_condition_fkey'
 ) THEN
  ALTER TABLE checklist_answers
   ADD CONSTRAINT checklist_answers_condition_fkey
   FOREIGN KEY (condition) REFERENCES checklist_conditions(id)
   ON UPDATE CASCADE ON DELETE RESTRICT;
 END IF;
END $$;

CREATE INDEX IF NOT EXISTS checklist_answers_condition
 ON checklist_answers(condition);
