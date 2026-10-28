-- Public QR access and checklist reporting support.
-- A QR code is a stable, revocable public entry point. Content visibility is
-- controlled per location and per template item, never by the QR token itself.

ALTER TABLE checklist_locations
  ADD COLUMN IF NOT EXISTS public_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_description text NOT NULL DEFAULT '';

ALTER TABLE checklist_template_items
  ADD COLUMN IF NOT EXISTS public_visible boolean NOT NULL DEFAULT false;

-- Answers snapshot the item's public visibility so old inspections keep the
-- policy that was published with their template version.
ALTER TABLE checklist_answers
  ADD COLUMN IF NOT EXISTS public_visible boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS checklist_qr_codes (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES employees(id),
  token text NOT NULL UNIQUE,
  name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('pilih_area', 'langsung')),
  location_id text REFERENCES checklist_locations(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL REFERENCES employees(id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK (mode <> 'langsung' OR location_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS checklist_qr_codes_owner
  ON checklist_qr_codes(owner_id, active DESC, created_at DESC, id);
CREATE INDEX IF NOT EXISTS checklist_qr_codes_location
  ON checklist_qr_codes(location_id);
