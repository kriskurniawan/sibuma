import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { DataLoadError } from "@/components/data-load-error";
import { DocumentDetailShell } from "@/components/dokumen/document-detail-shell";
import { DocumentDetailSkeleton } from "@/components/dokumen/document-detail-skeleton";
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

type PageProps = { params: Promise<{ id: string }> };

export default function DocumentDetailPage({ params }: PageProps) {
  return (
    <DocumentDetailShell>
      <Suspense fallback={<DocumentDetailSkeleton />}>
        <DocumentDetailData params={params} />
      </Suspense>
    </DocumentDetailShell>
  );
}

async function DocumentDetailData({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  let result;
  try {
    result = await Promise.all([
      getWorkDocumentDetail(user, id),
      getWorkDocumentSettings(),
    ]);
  } catch {
    return <DataLoadError message="Dokumen gagal dimuat. Coba lagi." />;
  }
  const [document, settings] = result;
  if (!document) notFound();

  const readOnly = isReadOnly(user);
  // Hanya pemilik yang dapat memindahkan berkas, jadi folder milik pengguna
  // lain tidak perlu dimuat.
  let ownerData;
  try {
    ownerData = await Promise.all([
      document.isOwner && !readOnly ? listWorkDocumentFolders(user.id) : [],
      document.isOwner && !readOnly
        ? loadWorkDocumentShareOptions(user.id)
        : { divisions: [], supervisors: [] },
    ]);
  } catch {
    return <DataLoadError message="Pengaturan dokumen gagal dimuat. Coba lagi." />;
  }
  const [folders, shareOptions] = ownerData;

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
