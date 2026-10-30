import "server-only";
import { insertAudit } from "./audit";
import { pool, query, type Connection } from "./db";
import { toIsoStringOrNull } from "./work-document-record";
import { WorkDocumentError } from "./work-document-errors";
import { getWorkDocumentSettings } from "./work-document-settings";
import type { WorkDocumentShareInput } from "./work-document-validation";
import type {
  WorkDocumentAudience,
  WorkDocumentShareOption,
  WorkDocumentShareOptions,
  WorkDocumentShareTarget,
  WorkDocumentShares,
} from "./work-document-types";

const AUDIENCE_ORDER: Record<WorkDocumentAudience, number> = {
  division: 0,
  supervisor: 1,
};

interface ShareScope {
  kind: "dokumen" | "folder";
  id: string;
  ownerId: string;
  title: string;
  targetTable: "work_document_share_targets" | "work_document_folder_share_targets";
  keyColumn: "document_id" | "folder_id";
  legacyTable: "work_document_shares" | "work_document_folder_shares";
  auditAction: "dokumen_berbagi_diubah" | "folder_dokumen_berbagi_diubah";
}

interface OwnerShareInfo {
  division_id: string | null;
  division_name: string | null;
  division_active: boolean | null;
  division_member_count: number | string | null;
  supervisor_id: string | null;
  supervisor_name: string | null;
  supervisor_active: boolean | null;
  supervisor_role: string | null;
  supervisor_division_name: string | null;
}

function documentScope(document: {
  id: string;
  ownerId: string;
  title: string;
}): ShareScope {
  return {
    kind: "dokumen",
    id: document.id,
    ownerId: document.ownerId,
    title: document.title,
    targetTable: "work_document_share_targets",
    keyColumn: "document_id",
    legacyTable: "work_document_shares",
    auditAction: "dokumen_berbagi_diubah",
  };
}

function folderScope(folder: {
  id: string;
  ownerId: string;
  name: string;
}): ShareScope {
  return {
    kind: "folder",
    id: folder.id,
    ownerId: folder.ownerId,
    title: folder.name,
    targetTable: "work_document_folder_share_targets",
    keyColumn: "folder_id",
    legacyTable: "work_document_folder_shares",
    auditAction: "folder_dokumen_berbagi_diubah",
  };
}

/** Divisi aktif dan atasan aktif yang dapat dipilih pemilik. */
export async function loadWorkDocumentShareOptions(
  ownerId: string,
  connection: Connection = pool(),
): Promise<WorkDocumentShareOptions> {
  const divisionRows = await query(
    `SELECT d.id,d.name,
      count(e.id) FILTER (WHERE e.active AND e.role='pekerja')::integer AS member_count
     FROM divisions d
     LEFT JOIN employees e ON e.division_id=d.id
     WHERE d.active
     GROUP BY d.id,d.name
     ORDER BY lower(d.name),d.id`,
    [],
    connection,
  );
  const supervisorRows = await query(
    `SELECT e.id,e.name,d.name AS division_name
     FROM employees e
     LEFT JOIN divisions d ON d.id=e.division_id AND d.active
     WHERE e.active AND e.role='atasan' AND e.id<>$1
     ORDER BY lower(e.name),e.id`,
    [ownerId],
    connection,
  );
  return {
    divisions: divisionRows.map(
      (row): WorkDocumentShareOption => ({
        id: row.id as string,
        name: row.name as string,
        description: `${Number(row.member_count ?? 0)} anggota aktif`,
      }),
    ),
    supervisors: supervisorRows.map(
      (row): WorkDocumentShareOption => ({
        id: row.id as string,
        name: row.name as string,
        description: (row.division_name as string | null) ?? "Tanpa divisi",
      }),
    ),
  };
}

async function loadOwnerShareInfo(
  connection: Connection,
  ownerId: string,
): Promise<OwnerShareInfo | null> {
  const [row] = await query(
    `SELECT e.division_id,d.name AS division_name,d.active AS division_active,
      (SELECT count(*)::integer FROM employees m
        WHERE m.division_id=e.division_id AND m.active) AS division_member_count,
      e.supervisor_id,sp.name AS supervisor_name,sp.active AS supervisor_active,
      sp.role AS supervisor_role,spd.name AS supervisor_division_name
     FROM employees e
     LEFT JOIN divisions d ON d.id=e.division_id
     LEFT JOIN employees sp ON sp.id=e.supervisor_id
     LEFT JOIN divisions spd ON spd.id=sp.division_id
     WHERE e.id=$1`,
    [ownerId],
    connection,
  );
  if (!row) return null;
  return {
    division_id: (row.division_id as string | null) ?? null,
    division_name: (row.division_name as string | null) ?? null,
    division_active: row.division_active === null ? null : Boolean(row.division_active),
    division_member_count: (row.division_member_count as number | string | null) ?? null,
    supervisor_id: (row.supervisor_id as string | null) ?? null,
    supervisor_name: (row.supervisor_name as string | null) ?? null,
    supervisor_active:
      row.supervisor_active === null ? null : Boolean(row.supervisor_active),
    supervisor_role: (row.supervisor_role as string | null) ?? null,
    supervisor_division_name:
      (row.supervisor_division_name as string | null) ?? null,
  };
}

function targetKey(audience: string, targetId: string) {
  return `${audience}:${targetId}`;
}

async function loadExplicitTargets(
  connection: Connection,
  scope: ShareScope,
): Promise<WorkDocumentShareTarget[]> {
  const rows = await query(
    `SELECT t.audience,t.target_id,t.created_at AS updated_at,u.name AS updated_by_name,
      d.name AS division_name,d.active AS division_active,
      (SELECT count(*)::integer FROM employees m
        WHERE m.division_id=d.id AND m.active) AS member_count,
      e.name AS employee_name,e.active AS employee_active,e.role AS employee_role,
      ed.name AS employee_division_name
     FROM ${scope.targetTable} t
     LEFT JOIN divisions d ON t.audience='division' AND d.id=t.target_id
     LEFT JOIN employees e ON t.audience='supervisor' AND e.id=t.target_id
     LEFT JOIN divisions ed ON ed.id=e.division_id
     LEFT JOIN employees u ON u.id=t.created_by
     WHERE t.${scope.keyColumn}=$1`,
    [scope.id],
    connection,
  );
  const targets: WorkDocumentShareTarget[] = [];
  for (const row of rows) {
    const audience = row.audience as WorkDocumentAudience;
    if (audience === "division") {
      if (!row.division_name || !row.division_active) continue;
      targets.push({
        audience,
        targetId: row.target_id as string,
        name: row.division_name as string,
        description: `${Number(row.member_count ?? 0)} anggota aktif`,
        legacy: false,
        updatedAt: toIsoStringOrNull(row.updated_at),
        updatedByName: (row.updated_by_name as string | null) ?? null,
      });
      continue;
    }
    if (
      !row.employee_name ||
      !row.employee_active ||
      row.employee_role !== "atasan"
    ) {
      continue;
    }
    targets.push({
      audience,
      targetId: row.target_id as string,
      name: row.employee_name as string,
      description: (row.employee_division_name as string | null) ?? "Tanpa divisi",
      legacy: false,
      updatedAt: toIsoStringOrNull(row.updated_at),
      updatedByName: (row.updated_by_name as string | null) ?? null,
    });
  }
  return targets;
}

async function loadLegacyTargets(
  connection: Connection,
  scope: ShareScope,
  owner: OwnerShareInfo | null,
): Promise<WorkDocumentShareTarget[]> {
  if (!owner) return [];
  const rows = await query(
    `SELECT s.audience,s.updated_at,u.name AS updated_by_name
     FROM ${scope.legacyTable} s
     LEFT JOIN employees u ON u.id=s.updated_by
     WHERE s.${scope.keyColumn}=$1 AND s.enabled`,
    [scope.id],
    connection,
  );
  const targets: WorkDocumentShareTarget[] = [];
  for (const row of rows) {
    const audience = row.audience as WorkDocumentAudience;
    const updatedAt = toIsoStringOrNull(row.updated_at);
    const updatedByName = (row.updated_by_name as string | null) ?? null;
    if (audience === "division") {
      if (
        !owner.division_id ||
        !owner.division_name ||
        !owner.division_active
      ) {
        continue;
      }
      targets.push({
        audience,
        targetId: owner.division_id,
        name: owner.division_name,
        description: `${Number(owner.division_member_count ?? 0)} anggota aktif`,
        legacy: true,
        updatedAt,
        updatedByName,
      });
      continue;
    }
    if (
      !owner.supervisor_id ||
      !owner.supervisor_name ||
      !owner.supervisor_active ||
      owner.supervisor_role !== "atasan"
    ) {
      continue;
    }
    targets.push({
      audience,
      targetId: owner.supervisor_id,
      name: owner.supervisor_name,
      description: owner.supervisor_division_name ?? "Tanpa divisi",
      legacy: true,
      updatedAt,
      updatedByName,
    });
  }
  return targets;
}

async function loadShareTargets(
  connection: Connection,
  scope: ShareScope,
): Promise<WorkDocumentShareTarget[]> {
  const [explicit, owner] = [
    await loadExplicitTargets(connection, scope),
    await loadOwnerShareInfo(connection, scope.ownerId),
  ];
  const legacy = await loadLegacyTargets(connection, scope, owner);
  const merged = new Map<string, WorkDocumentShareTarget>();
  for (const target of explicit) {
    merged.set(targetKey(target.audience, target.targetId), target);
  }
  for (const target of legacy) {
    const key = targetKey(target.audience, target.targetId);
    if (!merged.has(key)) merged.set(key, target);
  }
  return [...merged.values()].sort(
    (left, right) =>
      AUDIENCE_ORDER[left.audience] - AUDIENCE_ORDER[right.audience] ||
      left.name.localeCompare(right.name, "id"),
  );
}

export async function loadWorkDocumentShareTargets(
  connection: Connection,
  document: { id: string; ownerId: string; title: string },
) {
  return loadShareTargets(connection, documentScope(document));
}

export async function loadWorkDocumentFolderShareTargets(
  connection: Connection,
  folder: { id: string; ownerId: string; name: string },
) {
  return loadShareTargets(connection, folderScope(folder));
}

export function sharesFromTargets(
  targets: WorkDocumentShareTarget[],
): WorkDocumentShares {
  return {
    division: targets.some((target) => target.audience === "division"),
    supervisor: targets.some((target) => target.audience === "supervisor"),
  };
}

function targetIds(targets: WorkDocumentShareTarget[], audience: WorkDocumentAudience) {
  return targets
    .filter((target) => target.audience === audience)
    .map((target) => target.targetId);
}

async function validateTargetIds(
  connection: Connection,
  scope: ShareScope,
  divisionIds: string[],
  supervisorIds: string[],
) {
  if (divisionIds.length > 0) {
    const rows = await query(
      "SELECT id FROM divisions WHERE id=ANY($1::text[]) AND active",
      [divisionIds],
      connection,
    );
    if (rows.length !== divisionIds.length) {
      throw new WorkDocumentError(
        "Sebagian divisi tidak ditemukan atau sudah nonaktif.",
      );
    }
  }
  if (supervisorIds.length > 0) {
    const rows = await query(
      `SELECT id FROM employees
       WHERE id=ANY($1::text[]) AND active AND role='atasan' AND id<>$2`,
      [supervisorIds, scope.ownerId],
      connection,
    );
    if (rows.length !== supervisorIds.length) {
      throw new WorkDocumentError(
        "Sebagian atasan tidak ditemukan atau sudah nonaktif.",
      );
    }
  }
}

async function replaceShareTargets(
  connection: Connection,
  scope: ShareScope,
  input: WorkDocumentShareInput,
  actor: { id: string; name: string },
) {
  await query(
    "SELECT 1 FROM work_document_settings WHERE id='settings' FOR SHARE",
    [],
    connection,
  );
  const settings = await getWorkDocumentSettings(connection);
  const beforeTargets = await loadShareTargets(connection, scope);
  const beforeDivisions = new Set(targetIds(beforeTargets, "division"));
  const beforeSupervisors = new Set(targetIds(beforeTargets, "supervisor"));
  const divisionIds = [...new Set(input.divisionIds)];
  const supervisorIds = [...new Set(input.supervisorIds)].filter(
    (id) => id !== actor.id,
  );

  if (
    divisionIds.some((id) => !beforeDivisions.has(id)) &&
    !settings.shareToDivision
  ) {
    throw new WorkDocumentError(
      "Berbagi ke divisi sedang dinonaktifkan oleh super admin.",
      403,
    );
  }
  if (
    supervisorIds.some((id) => !beforeSupervisors.has(id)) &&
    !settings.shareToSupervisor
  ) {
    throw new WorkDocumentError(
      "Berbagi ke atasan sedang dinonaktifkan oleh super admin.",
      403,
    );
  }

  await validateTargetIds(connection, scope, divisionIds, supervisorIds);

  const now = new Date().toISOString();
  await query(
    `DELETE FROM ${scope.targetTable} WHERE ${scope.keyColumn}=$1`,
    [scope.id],
    connection,
  );
  await query(
    `DELETE FROM ${scope.legacyTable} WHERE ${scope.keyColumn}=$1`,
    [scope.id],
    connection,
  );
  if (divisionIds.length > 0) {
    await query(
      `INSERT INTO ${scope.targetTable}(${scope.keyColumn},audience,target_id,created_by,created_at)
       SELECT $1,'division',target_id,$2,$3::timestamptz
       FROM unnest($4::text[]) AS target_id`,
      [scope.id, actor.id, now, divisionIds],
      connection,
    );
  }
  if (supervisorIds.length > 0) {
    await query(
      `INSERT INTO ${scope.targetTable}(${scope.keyColumn},audience,target_id,created_by,created_at)
       SELECT $1,'supervisor',target_id,$2,$3::timestamptz
       FROM unnest($4::text[]) AS target_id`,
      [scope.id, actor.id, now, supervisorIds],
      connection,
    );
  }

  const afterTargets = await loadShareTargets(connection, scope);
  const total = afterTargets.length;
  await insertAudit(connection, {
    actorId: actor.id,
    actorName: actor.name,
    action: scope.auditAction,
    objectType: "dokumen",
    objectId: scope.id,
    summary:
      total === 0
        ? `${actor.name} menutup seluruh akses hanya-baca ${scope.kind} "${scope.title}".`
        : `${actor.name} memperbarui akses hanya-baca ${scope.kind} "${scope.title}" untuk ${afterTargets.filter((target) => target.audience === "division").length} divisi dan ${afterTargets.filter((target) => target.audience === "supervisor").length} atasan.`,
    before: {
      divisionIds: targetIds(beforeTargets, "division"),
      supervisorIds: targetIds(beforeTargets, "supervisor"),
    },
    after: {
      divisionIds: targetIds(afterTargets, "division"),
      supervisorIds: targetIds(afterTargets, "supervisor"),
    },
  });

  return {
    shares: sharesFromTargets(afterTargets),
    targets: afterTargets,
  };
}

export async function saveWorkDocumentShareTargets(
  connection: Connection,
  document: { id: string; ownerId: string; title: string },
  input: WorkDocumentShareInput,
  actor: { id: string; name: string },
) {
  return replaceShareTargets(connection, documentScope(document), input, actor);
}

export async function saveWorkDocumentFolderShareTargets(
  connection: Connection,
  folderId: string,
  input: WorkDocumentShareInput,
  actor: { id: string; name: string },
) {
  const [row] = await query(
    "SELECT id,owner_id,name FROM work_document_folders WHERE id=$1 FOR UPDATE",
    [folderId],
    connection,
  );
  if (!row) throw new WorkDocumentError("Folder tidak ditemukan.", 404);
  if (row.owner_id !== actor.id) {
    throw new WorkDocumentError(
      "Hanya pemilik folder yang dapat mengatur berbagi.",
      403,
    );
  }
  return replaceShareTargets(
    connection,
    folderScope({
      id: row.id as string,
      ownerId: row.owner_id as string,
      name: row.name as string,
    }),
    input,
    actor,
  );
}
