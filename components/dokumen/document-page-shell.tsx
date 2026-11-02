"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { FolderOpen, UploadCloud } from "lucide-react";
import { DocumentFilters } from "@/components/dokumen/document-filters";
import { DocumentFolders } from "@/components/dokumen/document-folders";
import { DocumentListSkeleton } from "@/components/dokumen/document-list";
import { DocumentTabs } from "@/components/dokumen/document-tabs";
import { DocumentUsagePanel } from "@/components/dokumen/document-usage-panel";
import { MobileFab } from "@/components/mobile-fab";
import { useSessionUser } from "@/components/session-user-provider";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { InfoBanner, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isReadOnly } from "@/lib/access";
import type { WorkDocumentTab } from "@/lib/work-document-types";

export function DocumentUploadPending({ mobile = false }: { mobile?: boolean }) {
  const title = "Menunggu pengaturan, kuota, dan folder dokumen.";
  return mobile ? (
    <MobileFab disabled title={title}>
      <UploadCloud aria-hidden="true" />
      Unggah dokumen
    </MobileFab>
  ) : (
    <Button type="button" size="sm" disabled title={title}>
      <UploadCloud aria-hidden="true" />
      Unggah dokumen
    </Button>
  );
}

export function DocumentRowsSkeleton() {
  const user = useSessionUser();
  const params = useSearchParams();
  const requestedTab = params.get("tab");
  const tab: WorkDocumentTab = requestedTab === "dibagikan" || requestedTab === "sampah" ? requestedTab : "saya";
  return <FramePanel className="p-0"><DocumentListSkeleton tab={tab} readOnly={isReadOnly(user)} /></FramePanel>;
}

export function DocumentPageShell({
  storageReady,
  storageMessage,
  action,
  mobileAction,
  warning,
  total,
  tabs,
  folderHeader,
  rows,
  folders,
  usage,
}: {
  storageReady: boolean;
  storageMessage: string;
  action?: ReactNode;
  mobileAction?: ReactNode;
  warning?: ReactNode;
  total?: ReactNode;
  tabs?: ReactNode;
  folderHeader?: ReactNode;
  rows?: ReactNode;
  folders?: ReactNode;
  usage?: ReactNode;
}) {
  const user = useSessionUser();
  const readOnly = isReadOnly(user);
  const params = useSearchParams();
  const requestedTab = params.get("tab");
  const tab: WorkDocumentTab = requestedTab === "dibagikan" || requestedTab === "sampah" ? requestedTab : "saya";
  const search = (params.get("search") ?? "").trim().slice(0, 120);
  const requestedFolder = params.get("folder");
  const activeFolder = requestedFolder === "none" || (requestedFolder && /^fld_[a-z0-9-]{36}$/.test(requestedFolder)) ? requestedFolder : "all";
  const canUpload = storageReady && !readOnly;

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        mobileCompact
        eyebrow="Dokumen kerja"
        title="Dokumen Kerja"
        description="Dokumen pendukung pekerjaanmu. Privat secara default, dapat dibagikan hanya-baca ke divisi atau atasan yang dipilih, dan aksesnya dapat ditutup kapan saja."
        action={canUpload ? <div className="max-md:hidden">{action ?? <DocumentUploadPending />}</div> : undefined}
      />
      {!storageReady && <InfoBanner tone="warning" icon={FolderOpen}>{storageMessage}</InfoBanner>}
      {warning}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Frame stacked spacing="sm" className="order-2 min-w-0 max-md:order-1 xl:order-1">
          <FrameHeader className="flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-0.5">
              <FrameTitle className="max-md:sr-only">Daftar dokumen</FrameTitle>
              <FrameDescription className="text-xs">
                {total ?? <Skeleton className="h-3 w-44 max-w-full" />}
              </FrameDescription>
            </div>
            {tabs ?? <DocumentTabs tab={tab} />}
          </FrameHeader>
          {folderHeader ?? (tab === "saya" && activeFolder !== "all" && activeFolder !== "none" ? <FramePanel><Skeleton className="h-8 w-48" /></FramePanel> : null)}
          <FramePanel><DocumentFilters search={search} /></FramePanel>
          {rows ?? <DocumentRowsSkeleton />}
        </Frame>
        <div className="order-1 flex min-w-0 flex-col gap-4 max-md:order-2 xl:order-2">
          {tab === "saya" && (folders ?? <DocumentFolders folders={[]} activeFolder={activeFolder} readOnly={readOnly} loading />)}
          {usage ?? <DocumentUsagePanel />}
        </div>
      </div>
      {canUpload ? (mobileAction ?? <DocumentUploadPending mobile />) : null}
    </div>
  );
}
