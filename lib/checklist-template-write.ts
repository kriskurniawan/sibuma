import "server-only";
import { query, type Connection } from "./db";
import type {
  ChecklistItemType,
  ChecklistPhotoPolicy,
} from "./checklist-types";

export interface ChecklistTemplateItemInput {
  prompt: string;
  guidance: string;
  required: boolean;
  photoPolicy: ChecklistPhotoPolicy;
  requireNoteOnIssue: boolean;
  publicVisible: boolean;
  itemType: ChecklistItemType;
  parentIndex: number | null;
  locationId: string | null;
}

/**
 * Lokasi pada template harus milik atasan yang sama. Default lokasi grup tidak
 * disalin ke anak; resolusi dilakukan saat jadwal membuat pemeriksaan.
 */
export async function assertTemplateItemLocations(
  connection: Connection,
  ownerId: string,
  items: Array<{ locationId: string | null }>,
) {
  const locationIds = [
    ...new Set(items.map((item) => item.locationId).filter(Boolean)),
  ] as string[];
  if (locationIds.length === 0) return;
  const rows = await query(
    `SELECT id FROM checklist_locations WHERE owner_id=$1 AND id=ANY($2::text[])`,
    [ownerId, locationIds],
    connection,
  );
  if (rows.length !== locationIds.length) {
    throw new Error("Lokasi item tidak ditemukan atau bukan milik Anda.");
  }
}

export async function createTemplateVersion(
  connection: Connection,
  input: {
    id: string;
    templateId: string;
    version: number;
    notes: string;
    createdBy: string;
    items: ChecklistTemplateItemInput[];
  },
) {
  const now = new Date().toISOString();
  await query(
    `INSERT INTO checklist_template_versions (id,template_id,version,notes,created_by,created_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [input.id, input.templateId, input.version, input.notes, input.createdBy, now],
    connection,
  );

  // Generate every id first so child rows can reference their parent even
  // when the flat input still uses array indexes.
  const ids = input.items.map(() => `cti_${crypto.randomUUID()}`);
  const items = [];
  for (const [position, item] of input.items.entries()) {
    const isGroup = item.itemType === "grup";
    const parent = item.parentIndex === null ? null : input.items[item.parentIndex];
    const parentItemId =
      item.parentIndex === null ? null : (ids[item.parentIndex] ?? null);
    const groupPath = isGroup || !parent ? "" : parent.prompt;
    const normalized = {
      ...item,
      required: isGroup ? false : item.required,
      photoPolicy: isGroup ? ("opsional" as const) : item.photoPolicy,
      requireNoteOnIssue: isGroup ? false : item.requireNoteOnIssue,
      publicVisible: isGroup ? false : item.publicVisible,
    };

    await query(
      `INSERT INTO checklist_template_items
        (id,version_id,position,item_type,parent_item_id,group_path,prompt,guidance,
         required,photo_policy,require_note_on_issue,public_visible,location_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        ids[position],
        input.id,
        position,
        normalized.itemType,
        parentItemId,
        groupPath,
        normalized.prompt,
        normalized.guidance,
        normalized.required,
        normalized.photoPolicy,
        normalized.requireNoteOnIssue,
        normalized.publicVisible,
        normalized.locationId,
      ],
      connection,
    );
    items.push({
      id: ids[position],
      versionId: input.id,
      position,
      ...normalized,
      parentItemId,
      groupPath,
    });
  }
  return items;
}
