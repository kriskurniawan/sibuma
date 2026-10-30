import "server-only";
import { insertAudit } from "./audit";
import { pool, query, type Connection } from "./db";
import { toWorkDocumentFolder } from "./work-document-record";
import { WorkDocumentError } from "./work-document-errors";
import {
  loadWorkDocumentFolderShareTargets,
  sharesFromTargets,
} from "./work-document-sharing";
import type { WorkDocumentFolderInput } from "./work-document-validation";
import type {
  WorkDocumentFolder,
  WorkDocumentFolderDetail,
} from "./work-document-types";

const FOLDER_SELECT = `f.*,
  count(d.id) FILTER (WHERE d.deleted_at IS NULL)::integer AS document_count,
  coalesce(sum(d.size_bytes) FILTER (WHERE d.deleted_at IS NULL),0)::bigint AS size_bytes`;

/** Folder satu tingkat milik satu karyawan, lengkap dengan jumlah berkas. */
export async function listWorkDocumentFolders(
  ownerId: string,
  connection: Connection = pool(),
): Promise<WorkDocumentFolder[]> {
  const rows = await query(
    `SELECT ${FOLDER_SELECT}
     FROM work_document_folders f
     LEFT JOIN work_documents d ON d.folder_id=f.id
     WHERE f.owner_id=$1
     GROUP BY f.id
     ORDER BY lower(f.name),f.id`,
    [ownerId],
    connection,
  );
  return rows.map(toWorkDocumentFolder);
}

export async function loadWorkDocumentFolder(
  connection: Connection,
  id: string,
  lock = false,
): Promise<WorkDocumentFolder | null> {
  const [row] = await query(
    `SELECT * FROM work_document_folders WHERE id=$1${lock ? " FOR UPDATE" : ""}`,
    [id],
    connection,
  );
  if (!row) return null;
  const [stats] = await query(
    `SELECT count(*) FILTER (WHERE deleted_at IS NULL)::integer AS document_count,
      coalesce(sum(size_bytes) FILTER (WHERE deleted_at IS NULL),0)::bigint AS size_bytes
     FROM work_documents WHERE folder_id=$1`,
    [id],
    connection,
  );
  return toWorkDocumentFolder({ ...row, ...stats });
}

export async function getWorkDocumentFolderDetail(
  id: string,
  viewerId: string,
  connection: Connection = pool(),
): Promise<WorkDocumentFolderDetail | null> {
  const folder = await loadWorkDocumentFolder(connection, id);
  if (!folder || folder.ownerId !== viewerId) return null;
  const shareTargets = await loadWorkDocumentFolderShareTargets(connection, folder);
  const [owner] = await query(
    `SELECT e.division_id,d.name AS division_name,sp.name AS supervisor_name
     FROM employees e
     LEFT JOIN divisions d ON d.id=e.division_id
     LEFT JOIN employees sp ON sp.id=e.supervisor_id
     WHERE e.id=$1`,
    [folder.ownerId],
    connection,
  );
  return {
    ...folder,
    shares: sharesFromTargets(shareTargets),
    shareTargets,
    canManage: folder.ownerId === viewerId,
    ownerDivisionId: (owner?.division_id as string | null) ?? null,
    ownerDivisionName: (owner?.division_name as string | null) ?? null,
    ownerSupervisorName: (owner?.supervisor_name as string | null) ?? null,
  };
}

export async function createWorkDocumentFolder(
  connection: Connection,
  ownerId: string,
  input: WorkDocumentFolderInput,
  actor: { id: string; name: string },
): Promise<WorkDocumentFolder> {
  const id = `fld_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const existing = await query(
    "SELECT 1 FROM work_document_folders WHERE owner_id=$1 AND lower(name)=lower($2)",
    [ownerId, input.name],
    connection,
  );
  if (existing.length > 0) {
    throw new WorkDocumentError("Folder dengan nama itu sudah ada.", 409);
  }
  await query(
    `INSERT INTO work_document_folders(id,owner_id,name,description,created_at,updated_at)
     VALUES($1,$2,$3,$4,$5,$5)`,
    [id, ownerId, input.name, input.description, now],
    connection,
  );
  await insertAudit(connection, {
    actorId: actor.id,
    actorName: actor.name,
    action: "folder_dokumen_dibuat",
    objectType: "dokumen",
    objectId: id,
    summary: `${actor.name} membuat folder dokumen kerja "${input.name}".`,
    after: { id, name: input.name, description: input.description },
  });
  return {
    id,
    ownerId,
    name: input.name,
    description: input.description,
    documentCount: 0,
    sizeBytes: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateWorkDocumentFolder(
  connection: Connection,
  id: string,
  ownerId: string,
  input: WorkDocumentFolderInput,
  actor: { id: string; name: string },
): Promise<WorkDocumentFolder> {
  const current = await loadWorkDocumentFolder(connection, id, true);
  if (!current) throw new WorkDocumentError("Folder tidak ditemukan.", 404);
  if (current.ownerId !== ownerId) {
    throw new WorkDocumentError("Hanya pemilik folder yang dapat mengubahnya.", 403);
  }
  const duplicate = await query(
    "SELECT 1 FROM work_document_folders WHERE owner_id=$1 AND lower(name)=lower($2) AND id<>$3",
    [ownerId, input.name, id],
    connection,
  );
  if (duplicate.length > 0) {
    throw new WorkDocumentError("Folder dengan nama itu sudah ada.", 409);
  }
  const now = new Date().toISOString();
  await query(
    "UPDATE work_document_folders SET name=$1,description=$2,updated_at=$3 WHERE id=$4",
    [input.name, input.description, now, id],
    connection,
  );
  await insertAudit(connection, {
    actorId: actor.id,
    actorName: actor.name,
    action: "folder_dokumen_diubah",
    objectType: "dokumen",
    objectId: id,
    summary: `${actor.name} mengubah folder dokumen kerja "${input.name}".`,
    before: { name: current.name, description: current.description },
    after: { name: input.name, description: input.description },
  });
  return {
    ...current,
    name: input.name,
    description: input.description,
    updatedAt: now,
  };
}

export async function deleteWorkDocumentFolder(
  connection: Connection,
  id: string,
  ownerId: string,
  actor: { id: string; name: string },
) {
  const current = await loadWorkDocumentFolder(connection, id, true);
  if (!current) throw new WorkDocumentError("Folder tidak ditemukan.", 404);
  if (current.ownerId !== ownerId) {
    throw new WorkDocumentError("Hanya pemilik folder yang dapat menghapusnya.", 403);
  }
  // Berkas tidak ikut terhapus; hanya kehilangan folder (ON DELETE SET NULL).
  await query("DELETE FROM work_document_folders WHERE id=$1", [id], connection);
  await insertAudit(connection, {
    actorId: actor.id,
    actorName: actor.name,
    action: "folder_dokumen_dihapus",
    objectType: "dokumen",
    objectId: id,
    summary: `${actor.name} menghapus folder "${current.name}". ${current.documentCount} berkas tidak ikut terhapus.`,
    before: {
      name: current.name,
      description: current.description,
      documentCount: current.documentCount,
    },
  });
  return { documentCount: current.documentCount };
}

/** Folder harus milik pemilik berkas; dipakai saat unggah dan memindahkan. */
export async function assertOwnedFolder(
  connection: Connection,
  folderId: string,
  ownerId: string,
) {
  const [row] = await query(
    "SELECT 1 FROM work_document_folders WHERE id=$1 AND owner_id=$2",
    [folderId, ownerId],
    connection,
  );
  if (!row) {
    throw new WorkDocumentError("Folder tidak ditemukan.", 404);
  }
}
