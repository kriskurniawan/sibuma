import "server-only";
import { pool, query, type Connection } from "./db";
import { clampPage, type PageRequest } from "./pagination";
import { canViewWorkDocument } from "./work-document-access";
import { toWorkDocument } from "./work-document-record";
import { loadWorkDocumentShareTargets } from "./work-document-sharing";
import type {
  WorkDocumentDetail,
  WorkDocumentPage,
  WorkDocumentRow,
  WorkDocumentSettings,
  WorkDocumentTab,
  WorkDocumentUsage,
} from "./work-document-types";
import type { SessionUser } from "./types";

const DOCUMENT_SELECT = `d.*,e.name AS owner_name,dv.name AS owner_division_name,f.name AS folder_name,
 (coalesce(sd.enabled,false) OR EXISTS (
   SELECT 1 FROM work_document_share_targets st
   JOIN divisions std ON std.id=st.target_id AND std.active
   WHERE st.document_id=d.id AND st.audience='division')) AS share_division,
 (coalesce(ss.enabled,false) OR EXISTS (
   SELECT 1 FROM work_document_share_targets st
   JOIN employees ste ON ste.id=st.target_id AND ste.active AND ste.role='atasan'
   WHERE st.document_id=d.id AND st.audience='supervisor')) AS share_supervisor`;
const DOCUMENT_JOINS = `JOIN employees e ON e.id=d.owner_id
 LEFT JOIN divisions dv ON dv.id=e.division_id
 LEFT JOIN work_document_folders f ON f.id=d.folder_id
 LEFT JOIN work_document_shares sd ON sd.document_id=d.id AND sd.audience='division'
 LEFT JOIN work_document_shares ss ON ss.document_id=d.id AND ss.audience='supervisor'`;

/** Izin dokumen sendiri atau izin folder tempat dokumen berada. */
const SHARED_EXISTS = `(EXISTS (
  SELECT 1 FROM work_document_shares s
  WHERE s.document_id=d.id AND s.enabled
    AND ((s.audience='supervisor' AND e.supervisor_id=$1)
      OR (s.audience='division' AND $2::text IS NOT NULL AND e.division_id=$2)))
 OR EXISTS (
  SELECT 1 FROM work_document_share_targets st
  LEFT JOIN divisions std
    ON st.audience='division' AND std.id=st.target_id AND std.active
  LEFT JOIN employees ste
    ON st.audience='supervisor' AND ste.id=st.target_id AND ste.active AND ste.role='atasan'
  WHERE st.document_id=d.id
    AND ((st.audience='supervisor' AND st.target_id=$1 AND ste.id IS NOT NULL)
      OR (st.audience='division' AND st.target_id=$2 AND std.id IS NOT NULL)))
 OR EXISTS (
  SELECT 1 FROM work_document_folder_shares fs
  JOIN work_document_folders sf ON sf.id=fs.folder_id AND sf.owner_id=d.owner_id
  WHERE fs.folder_id=d.folder_id AND fs.enabled
    AND ((fs.audience='supervisor' AND e.supervisor_id=$1)
      OR (fs.audience='division' AND $2::text IS NOT NULL AND e.division_id=$2)))
 OR EXISTS (
  SELECT 1 FROM work_document_folder_share_targets ft
  JOIN work_document_folders sf ON sf.id=ft.folder_id AND sf.owner_id=d.owner_id
  LEFT JOIN divisions ftd
    ON ft.audience='division' AND ftd.id=ft.target_id AND ftd.active
  LEFT JOIN employees fte
    ON ft.audience='supervisor' AND fte.id=ft.target_id AND fte.active AND fte.role='atasan'
  WHERE ft.folder_id=d.folder_id
    AND ((ft.audience='supervisor' AND ft.target_id=$1 AND fte.id IS NOT NULL)
      OR (ft.audience='division' AND ft.target_id=$2 AND ftd.id IS NOT NULL))))`;

function likePattern(search: string) {
  return `%${search.replace(/[\\%_]/g, "\\$&")}%`;
}

function toRow(row: Record<string, unknown>, viewerId: string): WorkDocumentRow {
  return {
    ...toWorkDocument(row),
    ownerName: row.owner_name as string,
    ownerDivisionName: (row.owner_division_name as string | null) ?? null,
    folderName: (row.folder_name as string | null) ?? null,
    shares: {
      division: Boolean(row.share_division),
      supervisor: Boolean(row.share_supervisor),
    },
    canManage: row.owner_id === viewerId && !row.deleted_at,
  };
}

async function viewerDivisionId(userId: string) {
  const [row] = await query(
    "SELECT division_id FROM employees WHERE id=$1",
    [userId],
  );
  return (row?.division_id as string | null) ?? null;
}

async function listOwned(
  user: SessionUser,
  options: {
    trash: boolean;
    search: string;
    page: PageRequest;
    folderId?: string | null;
  },
): Promise<WorkDocumentPage> {
  const activeFilter = options.trash
    ? "d.deleted_at IS NOT NULL"
    : "d.deleted_at IS NULL";
  const searchable = `($2='' OR d.title ILIKE $3 ESCAPE '\\' OR d.file_name ILIKE $3 ESCAPE '\\' OR d.description ILIKE $3 ESCAPE '\\')`;
  const values: unknown[] = [user.id, options.search, likePattern(options.search)];
  let folderFilter = "";
  if (options.folderId === null) {
    folderFilter = " AND d.folder_id IS NULL";
  } else if (typeof options.folderId === "string") {
    values.push(options.folderId);
    folderFilter = ` AND d.folder_id=$${values.length}`;
  }
  const [countRow] = await query(
    `SELECT count(*)::integer total FROM work_documents d WHERE d.owner_id=$1 AND ${activeFilter} AND ${searchable}${folderFilter}`,
    values,
  );
  const total = Number(countRow?.total ?? 0);
  const safe = clampPage(options.page, total);
  const rows = await query(
    `SELECT ${DOCUMENT_SELECT} FROM work_documents d ${DOCUMENT_JOINS}
     WHERE d.owner_id=$1 AND ${activeFilter} AND ${searchable}${folderFilter}
     ORDER BY ${options.trash ? "d.deleted_at DESC" : "d.updated_at DESC"},d.id
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, safe.pageSize, safe.pageIndex * safe.pageSize],
  );
  return {
    rows: rows.map((row) => toRow(row, user.id)),
    total,
    page: safe,
  };
}

async function listShared(
  user: SessionUser,
  options: { search: string; page: PageRequest },
): Promise<WorkDocumentPage> {
  const divisionId = await viewerDivisionId(user.id);
  const sharedFilter = `d.deleted_at IS NULL AND d.owner_id<>$1 AND e.active AND ${SHARED_EXISTS}`;
  const searchable = `($3='' OR d.title ILIKE $4 ESCAPE '\\' OR d.file_name ILIKE $4 ESCAPE '\\' OR d.description ILIKE $4 ESCAPE '\\')`;
  const values = [user.id, divisionId, options.search, likePattern(options.search)];
  const [countRow] = await query(
    `SELECT count(*)::integer total FROM work_documents d JOIN employees e ON e.id=d.owner_id
     WHERE ${sharedFilter} AND ${searchable}`,
    values,
  );
  const total = Number(countRow?.total ?? 0);
  const safe = clampPage(options.page, total);
  const rows = await query(
    `SELECT ${DOCUMENT_SELECT} FROM work_documents d ${DOCUMENT_JOINS}
     WHERE ${sharedFilter} AND ${searchable}
     ORDER BY d.updated_at DESC,d.id
     LIMIT $5 OFFSET $6`,
    [...values, safe.pageSize, safe.pageIndex * safe.pageSize],
  );
  return {
    rows: rows.map((row) => toRow(row, user.id)),
    total,
    page: safe,
  };
}

export async function getWorkDocumentPage(
  user: SessionUser,
  options: {
    tab: WorkDocumentTab;
    search: string;
    page: PageRequest;
    folderId?: string | null;
  },
): Promise<WorkDocumentPage> {
  if (options.tab === "dibagikan") {
    return listShared(user, options);
  }
  return listOwned(user, {
    trash: options.tab === "sampah",
    search: options.search,
    page: options.page,
    folderId: options.folderId,
  });
}

export async function getWorkDocumentUsage(
  user: SessionUser,
  settings: WorkDocumentSettings,
): Promise<WorkDocumentUsage> {
  const [row] = await query(
    `SELECT
      count(*) FILTER (WHERE deleted_at IS NULL)::integer active_count,
      coalesce(sum(size_bytes) FILTER (WHERE deleted_at IS NULL),0)::bigint active_bytes,
      count(*) FILTER (WHERE deleted_at IS NOT NULL)::integer trash_count,
      coalesce(sum(size_bytes) FILTER (WHERE deleted_at IS NOT NULL),0)::bigint trash_bytes
     FROM work_documents WHERE owner_id=$1`,
    [user.id],
  );
  const divisionId = await viewerDivisionId(user.id);
  const [shared] = await query(
    `SELECT count(*)::integer total FROM work_documents d JOIN employees e ON e.id=d.owner_id
     WHERE d.deleted_at IS NULL AND d.owner_id<>$1 AND e.active AND ${SHARED_EXISTS}`,
    [user.id, divisionId],
  );
  const activeBytes = Number(row?.active_bytes ?? 0);
  const trashBytes = Number(row?.trash_bytes ?? 0);
  return {
    activeCount: Number(row?.active_count ?? 0),
    activeBytes,
    trashCount: Number(row?.trash_count ?? 0),
    trashBytes,
    sharedCount: Number(shared?.total ?? 0),
    usedBytes: activeBytes + trashBytes,
    quotaBytes: settings.quotaBytes,
    maxFileBytes: settings.maxFileBytes,
    maxVideoBytes: settings.maxVideoBytes,
  };
}

export async function getWorkDocumentDetail(
  user: SessionUser,
  id: string,
): Promise<WorkDocumentDetail | null> {
  const [row] = await query(
    `SELECT ${DOCUMENT_SELECT},e.division_id AS owner_division_id,sp.name AS owner_supervisor_name
     FROM work_documents d ${DOCUMENT_JOINS}
     LEFT JOIN employees sp ON sp.id=e.supervisor_id
     WHERE d.id=$1`,
    [id],
  );
  if (!row) return null;
  const document = toRow(row, user.id);
  if (!(await canViewWorkDocument(pool(), user, document))) return null;

  const isOwner = document.ownerId === user.id;
  const shareTargets = isOwner
    ? await loadWorkDocumentShareTargets(pool(), {
        id: document.id,
        ownerId: document.ownerId,
        title: document.title,
      })
    : [];

  return {
    ...document,
    ownerDivisionId: (row.owner_division_id as string | null) ?? null,
    ownerSupervisorName: (row.owner_supervisor_name as string | null) ?? null,
    shareTargets,
    isOwner,
  };
}

/** Kuota dihitung termasuk berkas di sampah sampai dihapus permanen. */
export async function workDocumentUsedBytes(
  connection: Connection,
  ownerId: string,
) {
  const [row] = await query(
    "SELECT coalesce(sum(size_bytes),0)::bigint total FROM work_documents WHERE owner_id=$1",
    [ownerId],
    connection,
  );
  return Number(row?.total ?? 0);
}
