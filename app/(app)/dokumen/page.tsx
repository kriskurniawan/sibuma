import { redirect } from "next/navigation";
import Link from "next/link";
import { FileLock2, FolderOpen, Search, Trash2, UsersRound } from "lucide-react";
import { DocumentFilters } from "@/components/dokumen/document-filters";
import { DocumentFolderHeader } from "@/components/dokumen/document-folder-header";
import { DocumentFolders } from "@/components/dokumen/document-folders";
import { DocumentList } from "@/components/dokumen/document-list";
import { DocumentPagination } from "@/components/dokumen/document-pagination";
import { DocumentTabs } from "@/components/dokumen/document-tabs";
import { DocumentUploadDialog } from "@/components/dokumen/document-upload-dialog";
import { DocumentUsagePanel } from "@/components/dokumen/document-usage-panel";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { EmptyState, InfoBanner, PageHeader } from "@/components/ui";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import {
  documentStorageConfigMessage,
  isDocumentStorageConfigured,
} from "@/lib/document-storage-config";
import { pageRequest } from "@/lib/pagination";
import {
  getWorkDocumentPage,
  getWorkDocumentUsage,
} from "@/lib/work-document-queries";
import {
  getWorkDocumentFolderDetail,
  listWorkDocumentFolders,
} from "@/lib/work-document-folders";
import { purgeExpiredWorkDocuments } from "@/lib/work-document-purge";
import { getWorkDocumentSettings } from "@/lib/work-document-settings";
import { loadWorkDocumentShareOptions } from "@/lib/work-document-sharing";
import {
  formatDocumentBytes,
  type WorkDocumentTab,
} from "@/lib/work-document-types";

export const metadata = { title: "Dokumen Kerja" };

const TABS = new Set<WorkDocumentTab>(["saya", "dibagikan", "sampah"]);

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const readOnly = isReadOnly(user);

  const params = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const requestedTab = first(params.tab);
  const tab: WorkDocumentTab =
    requestedTab && TABS.has(requestedTab as WorkDocumentTab)
      ? (requestedTab as WorkDocumentTab)
      : "saya";
  const search = (first(params.search) ?? "").trim().slice(0, 120);
  const request = pageRequest(first(params.page), first(params.size));
  const storageReady = isDocumentStorageConfigured();
  const storageMessage = documentStorageConfigMessage();

  // Folder hanya berlaku pada dokumen milik sendiri; tab "dibagikan"
  // menampilkan berkas dari banyak pemilik tanpa struktur folder.
  const FOLDER_ID = /^fld_[a-z0-9-]{36}$/;
  const requestedFolder = first(params.folder);
  const folderFilter: string | null | undefined =
    tab === "saya" && requestedFolder && requestedFolder !== "all"
      ? requestedFolder === "none"
        ? null
        : FOLDER_ID.test(requestedFolder)
          ? requestedFolder
          : undefined
      : undefined;

  await purgeExpiredWorkDocuments().catch((error) => {
    console.warn("Gagal menjalankan pembersihan sampah dokumen:", error);
  });

  const [settings, data, folders] = await Promise.all([
    getWorkDocumentSettings(),
    getWorkDocumentPage(user, {
      tab,
      search,
      page: request,
      folderId: folderFilter,
    }),
    tab === "saya"
      ? listWorkDocumentFolders(user.id)
      : Promise.resolve([]),
  ]);
  const selectedFolder =
    tab === "saya" && typeof folderFilter === "string"
      ? await getWorkDocumentFolderDetail(folderFilter, user.id)
      : null;
  const usage = await getWorkDocumentUsage(user, settings);
  const shareOptions =
    selectedFolder && !readOnly
      ? await loadWorkDocumentShareOptions(user.id)
      : { divisions: [], supervisors: [] };
  const unfiledCount = Math.max(
    0,
    usage.activeCount -
      folders.reduce((sum, folder) => sum + folder.documentCount, 0),
  );
  const activeFolder = folderFilter === null ? "none" : (folderFilter ?? "all");
  const counts = {
    saya: usage.activeCount,
    dibagikan: usage.sharedCount,
    sampah: usage.trashCount,
  };
  const filtered = search.length > 0;
  const uploadAction =
    storageReady && !readOnly ? (
      <DocumentUploadDialog
        settings={settings}
        usedBytes={usage.usedBytes}
        folders={folders}
        currentFolderId={
          typeof folderFilter === "string" ? folderFilter : null
        }
      />
    ) : undefined;
  const ownEmptyAction = readOnly ? (
    <Button
      size="sm"
      variant="outline"
      nativeButton={false}
      render={<Link href="/dokumen?tab=dibagikan" />}
    >
      <UsersRound aria-hidden="true" />
      Dokumen dibagikan
    </Button>
  ) : (
    uploadAction
  );

  const empty = {
    saya: {
      icon: selectedFolder ? FolderOpen : FileLock2,
      title: filtered
        ? "Tidak ada dokumen yang cocok"
        : selectedFolder
          ? `Folder "${selectedFolder.name}" masih kosong`
          : folderFilter === null
            ? "Belum ada dokumen tanpa folder"
            : "Belum ada dokumen kerja",
      description: filtered
        ? "Ubah kata kunci pencarian atau kembali ke seluruh dokumen."
        : readOnly
          ? "Akunmu berada dalam mode hanya-baca, jadi belum dapat mengunggah dokumen kerja. Dokumen yang dibagikan tetap dapat dibuka."
          : selectedFolder
            ? "Unggah berkas untuk mengisi folder ini. Setiap berkas dapat diberi deskripsi sendiri saat diunggah."
            : folderFilter === null
              ? "Dokumen yang belum dimasukkan ke folder akan muncul di sini."
              : "Unggah referensi, panduan, atau tutorial kerja. Dokumen tetap privat sampai kamu membagikannya.",
      action: filtered ? (
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/dokumen" />}
        >
          <Search aria-hidden="true" />
          Hapus pencarian
        </Button>
      ) : selectedFolder || folderFilter === null
        ? uploadAction
        : ownEmptyAction,
    },
    dibagikan: {
      icon: UsersRound,
      title: filtered
        ? "Tidak ada dokumen yang cocok"
        : "Belum ada dokumen dibagikan",
      description: filtered
        ? "Ubah kata kunci atau kembali ke seluruh dokumen yang dibagikan."
        : "Dokumen rekan kerja atau atasan akan muncul di sini setelah mereka membuka akses hanya-baca.",
      action: filtered ? (
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/dokumen?tab=dibagikan" />}
        >
          <Search aria-hidden="true" />
          Hapus pencarian
        </Button>
      ) : undefined,
    },
    sampah: {
      icon: Trash2,
      title: filtered ? "Tidak ada dokumen yang cocok" : "Sampah kosong",
      description: filtered
        ? "Ubah kata kunci atau kembali ke seluruh isi sampah."
        : `Dokumen yang kamu hapus akan tersimpan di sini selama ${settings.trashRetentionDays} hari sebelum dihapus permanen.`,
      action: filtered ? (
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/dokumen?tab=sampah" />}
        >
          <Search aria-hidden="true" />
          Hapus pencarian
        </Button>
      ) : undefined,
    },
  }[tab];

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        eyebrow="Dokumen kerja"
        title="Dokumen Kerja"
        description="Dokumen pendukung pekerjaanmu. Privat secara default, dapat dibagikan hanya-baca ke divisi atau atasan yang dipilih, dan aksesnya dapat ditutup kapan saja."
        action={uploadAction}
      />

      {!storageReady && (
        <InfoBanner tone="warning" icon={FolderOpen}>
          {storageMessage}
        </InfoBanner>
      )}

      {!readOnly && usage.usedBytes >= usage.quotaBytes && (
        <InfoBanner tone="warning" icon={Trash2}>
          Kuota dokumen penuh ({formatDocumentBytes(usage.usedBytes)} dari{" "}
          {formatDocumentBytes(usage.quotaBytes)}). Hapus dokumen permanen dari
          sampah untuk mengosongkan ruang sebelum mengunggah berkas baru.
        </InfoBanner>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Frame
          stacked
          spacing="sm"
          className="order-2 min-w-0 xl:order-1"
        >
          <FrameHeader className="flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-0.5">
              <FrameTitle>Daftar dokumen</FrameTitle>
              <FrameDescription className="text-xs">
                {data.total} dokumen pada tampilan ini.
              </FrameDescription>
            </div>
            <DocumentTabs tab={tab} counts={counts} />
          </FrameHeader>

          {selectedFolder && (
            <FramePanel>
              <DocumentFolderHeader
                folder={selectedFolder}
                settings={settings}
                options={shareOptions}
                readOnly={readOnly}
              />
            </FramePanel>
          )}

          <FramePanel>
            <DocumentFilters search={search} />
          </FramePanel>

          <FramePanel className="p-0">
            {data.rows.length === 0 ? (
              <EmptyState
                icon={empty.icon}
                title={empty.title}
                description={empty.description}
                action={empty.action}
              />
            ) : (
              <DocumentList
                rows={data.rows}
                total={data.total}
                pagination={data.page}
                tab={tab}
                readOnly={readOnly}
                trashRetentionDays={settings.trashRetentionDays}
              />
            )}
          </FramePanel>

          {data.total > 0 && (
            <FrameFooter>
              <DocumentPagination
                page={data.page.pageIndex}
                pageSize={data.page.pageSize}
                total={data.total}
              />
            </FrameFooter>
          )}
        </Frame>

        <div className="order-1 flex min-w-0 flex-col gap-4 xl:order-2">
          {tab === "saya" && (
            <DocumentFolders
              folders={folders}
              activeFolder={activeFolder}
              unfiledCount={unfiledCount}
              readOnly={readOnly}
            />
          )}
          <DocumentUsagePanel usage={usage} />
        </div>
      </div>
    </div>
  );
}
