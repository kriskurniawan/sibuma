import { DocumentPageShell } from "@/components/dokumen/document-page-shell";
import { documentStorageConfigMessage, isDocumentStorageConfigured } from "@/lib/document-storage-config";

export default function DokumenLoading() {
  return <DocumentPageShell storageReady={isDocumentStorageConfigured()} storageMessage={documentStorageConfigMessage()} />;
}
