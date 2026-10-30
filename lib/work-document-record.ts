import type {
  WorkDocument,
  WorkDocumentExtension,
  WorkDocumentFolder,
} from "./work-document-types";

export function toIsoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function toIsoStringOrNull(value: unknown) {
  return value ? toIsoString(value) : null;
}

export function toWorkDocument(row: Record<string, unknown>): WorkDocument {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    folderId: (row.folder_id as string | null) ?? null,
    title: row.title as string,
    description: (row.description as string) ?? "",
    storageKey: row.storage_key as string,
    fileName: row.file_name as string,
    extension: row.extension as WorkDocumentExtension,
    mimeType: row.mime_type as string,
    sizeBytes: Number(row.size_bytes),
    checksumSha256: row.checksum_sha256 as string,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    deletedAt: toIsoStringOrNull(row.deleted_at),
    deletedBy: (row.deleted_by as string | null) ?? null,
    purgeAfter: toIsoStringOrNull(row.purge_after),
  };
}

export function toWorkDocumentFolder(
  row: Record<string, unknown>,
): WorkDocumentFolder {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    documentCount: Number(row.document_count ?? 0),
    sizeBytes: Number(row.size_bytes ?? 0),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}
