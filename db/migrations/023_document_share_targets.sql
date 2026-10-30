-- Berbagi hanya-baca Dokumen Kerja yang dapat dipilih: pemilik memilih divisi
-- mana pun dan atasan mana pun, bukan hanya divisi sendiri atau atasan
-- langsung. Tabel lama (work_document_shares dan work_document_folder_shares)
-- tetap dipertahankan sebagai fallback agar akses yang sudah terbuka tidak
-- hilang. Saat pemilik menyimpan pilihan baru, baris lama dibersihkan dan
-- pilihan disimpan sebagai target eksplisit di tabel berikut.
CREATE TABLE IF NOT EXISTS work_document_share_targets (
 document_id text NOT NULL REFERENCES work_documents(id) ON DELETE CASCADE,
 audience text NOT NULL CHECK (audience IN ('division','supervisor')),
 target_id text NOT NULL,
 created_by text REFERENCES employees(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (document_id, audience, target_id)
);
CREATE INDEX IF NOT EXISTS work_document_share_targets_lookup
 ON work_document_share_targets(audience, target_id, document_id);

CREATE TABLE IF NOT EXISTS work_document_folder_share_targets (
 folder_id text NOT NULL REFERENCES work_document_folders(id) ON DELETE CASCADE,
 audience text NOT NULL CHECK (audience IN ('division','supervisor')),
 target_id text NOT NULL,
 created_by text REFERENCES employees(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (folder_id, audience, target_id)
);
CREATE INDEX IF NOT EXISTS work_document_folder_share_targets_lookup
 ON work_document_folder_share_targets(audience, target_id, folder_id);
