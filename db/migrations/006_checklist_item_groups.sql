-- Grouped checklist items. A group is a heading only; answers stay on leaf
-- items so progress, required checks and reporting keep counting real work.
-- The schema allows a parent for every item, but the application currently
-- limits the editor to one group level (group -> item).

ALTER TABLE checklist_template_items
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'item'
    CHECK (item_type IN ('grup', 'item')),
  ADD COLUMN IF NOT EXISTS parent_item_id text
    REFERENCES checklist_template_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS group_path text NOT NULL DEFAULT '';

-- Answers snapshot the group path so historical reports keep the heading that
-- was published with their template version.
ALTER TABLE checklist_answers
  ADD COLUMN IF NOT EXISTS group_path text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS checklist_template_items_parent
  ON checklist_template_items(version_id, parent_item_id, position);
