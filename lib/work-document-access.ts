import "server-only";
import { pool, query, type Connection } from "./db";
import { toWorkDocument } from "./work-document-record";
import type { WorkDocument } from "./work-document-types";
import type { SessionUser } from "./types";

export async function loadWorkDocument(
  connection: Connection,
  id: string,
  lock = false,
): Promise<WorkDocument | null> {
  const [row] = await query(
    `SELECT * FROM work_documents WHERE id=$1${lock ? " FOR UPDATE" : ""}`,
    [id],
    connection,
  );
  return row ? toWorkDocument(row) : null;
}

export async function canViewWorkDocument(
  connection: Connection,
  user: SessionUser,
  document: Pick<
    WorkDocument,
    "id" | "ownerId" | "deletedAt" | "folderId"
  >,
) {
  if (document.ownerId === user.id) return true;
  // Dokumen di sampah hanya terlihat oleh pemiliknya.
  if (document.deletedAt) return false;

  const [owner] = await query(
    "SELECT division_id,supervisor_id,active FROM employees WHERE id=$1",
    [document.ownerId],
    connection,
  );
  if (!owner || !owner.active) return false;

  const shares = await query(
    "SELECT audience FROM work_document_shares WHERE document_id=$1 AND enabled",
    [document.id],
    connection,
  );
  const folderShares = document.folderId
    ? await query(
        `SELECT s.audience FROM work_document_folder_shares s
         JOIN work_document_folders f ON f.id=s.folder_id
         WHERE s.folder_id=$1 AND s.enabled AND f.owner_id=$2`,
        [document.folderId, document.ownerId],
        connection,
      )
    : [];
  const [viewer] = await query(
    "SELECT division_id,active FROM employees WHERE id=$1",
    [user.id],
    connection,
  );
  if (!viewer || !viewer.active) return false;

  // Target eksplisit: divisi mana pun atau atasan mana pun yang dipilih
  // pemilik. Target nonaktif tidak memberi akses.
  const targets = document.folderId
    ? await query(
        `SELECT t.audience,t.target_id
         FROM work_document_share_targets t
         LEFT JOIN divisions td
           ON t.audience='division' AND td.id=t.target_id AND td.active
         LEFT JOIN employees te
           ON t.audience='supervisor' AND te.id=t.target_id AND te.active AND te.role='atasan'
         WHERE t.document_id=$1
           AND ((t.audience='division' AND td.id IS NOT NULL)
             OR (t.audience='supervisor' AND te.id IS NOT NULL))
         UNION ALL
         SELECT ft.audience,ft.target_id
         FROM work_document_folder_share_targets ft
         JOIN work_document_folders f ON f.id=ft.folder_id AND f.owner_id=$2
         LEFT JOIN divisions fd
           ON ft.audience='division' AND fd.id=ft.target_id AND fd.active
         LEFT JOIN employees fe
           ON ft.audience='supervisor' AND fe.id=ft.target_id AND fe.active AND fe.role='atasan'
         WHERE ft.folder_id=$3
           AND ((ft.audience='division' AND fd.id IS NOT NULL)
             OR (ft.audience='supervisor' AND fe.id IS NOT NULL))`,
        [document.id, document.ownerId, document.folderId],
        connection,
      )
    : await query(
        `SELECT t.audience,t.target_id
         FROM work_document_share_targets t
         LEFT JOIN divisions td
           ON t.audience='division' AND td.id=t.target_id AND td.active
         LEFT JOIN employees te
           ON t.audience='supervisor' AND te.id=t.target_id AND te.active AND te.role='atasan'
         WHERE t.document_id=$1
           AND ((t.audience='division' AND td.id IS NOT NULL)
             OR (t.audience='supervisor' AND te.id IS NOT NULL))`,
        [document.id],
        connection,
      );
  if (
    targets.some(
      (row) => row.audience === "supervisor" && row.target_id === user.id,
    )
  ) {
    return true;
  }
  if (
    targets.some(
      (row) =>
        row.audience === "division" &&
        Boolean(viewer.division_id) &&
        row.target_id === viewer.division_id,
    )
  ) {
    return true;
  }

  // Baris sakelar lama tetap berlaku sampai pemilik menyimpan pilihan baru.
  const audiences = new Set(
    [...shares, ...folderShares].map((row) => row.audience as string),
  );
  if (audiences.has("supervisor") && owner.supervisor_id === user.id) {
    return true;
  }
  if (
    audiences.has("division") &&
    owner.division_id &&
    viewer.division_id === owner.division_id
  ) {
    return true;
  }
  return false;
}

/** Dipakai setiap pratinjau dan unduhan agar pencabutan berbagi langsung berlaku. */
export async function loadViewableWorkDocument(
  user: SessionUser,
  id: string,
): Promise<WorkDocument | null> {
  const document = await loadWorkDocument(pool(), id);
  if (!document) return null;
  return (await canViewWorkDocument(pool(), user, document)) ? document : null;
}

/** Super admin tidak otomatis dapat membuka dokumen privat orang lain. */
export function canManageWorkDocument(
  user: Pick<SessionUser, "id">,
  document: Pick<WorkDocument, "ownerId" | "deletedAt">,
) {
  return document.ownerId === user.id && !document.deletedAt;
}
