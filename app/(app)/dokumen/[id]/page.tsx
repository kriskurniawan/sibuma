import { notFound, redirect } from "next/navigation";
import { DocumentDetailView } from "@/components/dokumen/document-detail-view";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import {
  documentStorageConfigMessage,
  isDocumentStorageConfigured,
} from "@/lib/document-storage-config";
import { listWorkDocumentFolders } from "@/lib/work-document-folders";
import { getWorkDocumentDetail } from "@/lib/work-document-queries";
import { getWorkDocumentSettings } from "@/lib/work-document-settings";
import { loadWorkDocumentShareOptions } from "@/lib/work-document-sharing";

export const metadata = { title: "Detail Dokumen" };

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const [document, settings] = await Promise.all([
    getWorkDocumentDetail(user, id),
    getWorkDocumentSettings(),
  ]);
  if (!document) notFound();

  const readOnly = isReadOnly(user);
  // Hanya pemilik yang dapat memindahkan berkas, jadi folder milik pengguna
  // lain tidak perlu dimuat.
  const folders =
    document.isOwner && !readOnly
      ? await listWorkDocumentFolders(user.id)
      : [];
  const shareOptions =
    document.isOwner && !readOnly
      ? await loadWorkDocumentShareOptions(user.id)
      : { divisions: [], supervisors: [] };

  return (
    <DocumentDetailView
      document={document}
      settings={settings}
      shareOptions={shareOptions}
      folders={folders}
      storageReady={isDocumentStorageConfigured()}
      storageMessage={documentStorageConfigMessage()}
      readOnly={readOnly}
    />
  );
}
