import { cache, Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileLock2, FolderOpen, Search, Trash2, UsersRound } from "lucide-react";
import { DataLoadError } from "@/components/data-load-error";
import { DocumentFolderHeader } from "@/components/dokumen/document-folder-header";
import { DocumentFolders } from "@/components/dokumen/document-folders";
import { DocumentList } from "@/components/dokumen/document-list";
import { DocumentPagination } from "@/components/dokumen/document-pagination";
import { DocumentPageShell, DocumentRowsSkeleton, DocumentUploadPending } from "@/components/dokumen/document-page-shell";
import { DocumentTabs } from "@/components/dokumen/document-tabs";
import { DocumentUploadDialog } from "@/components/dokumen/document-upload-dialog";
import { DocumentUsagePanel } from "@/components/dokumen/document-usage-panel";
import { FrameFooter, FramePanel } from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, InfoBanner } from "@/components/ui";
import { isReadOnly } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { documentStorageConfigMessage, isDocumentStorageConfigured } from "@/lib/document-storage-config";
import { pageRequest } from "@/lib/pagination";
import type { SessionUser } from "@/lib/types";
import { getWorkDocumentPage, getWorkDocumentUsage } from "@/lib/work-document-queries";
import { getWorkDocumentFolderDetail, listWorkDocumentFolders } from "@/lib/work-document-folders";
import { purgeExpiredWorkDocuments } from "@/lib/work-document-purge";
import { getWorkDocumentSettings } from "@/lib/work-document-settings";
import { loadWorkDocumentShareOptions } from "@/lib/work-document-sharing";
import { formatDocumentBytes, type WorkDocumentTab } from "@/lib/work-document-types";

export const metadata = { title: "Dokumen Kerja" };

const maintainDocuments = cache(async () => {
  // Semua pembacaan mengikuti pembersihan yang sama agar jumlah dan daftar konsisten.
  await purgeExpiredWorkDocuments().catch((error) => {
    console.warn("Gagal menjalankan pembersihan sampah dokumen:", error);
  });
});
const loadSettings = cache(getWorkDocumentSettings);
const loadUsage = cache(async (user: SessionUser) => {
  const settings = await loadSettings();
  await maintainDocuments();
  return getWorkDocumentUsage(user, settings);
});
const loadFolders = cache(async (userId: string) => {
  await maintainDocuments();
  return listWorkDocumentFolders(userId);
});

type View = {
  tab: WorkDocumentTab;
  search: string;
  folderFilter: string | null | undefined;
  request: ReturnType<typeof pageRequest>;
  storageReady: boolean;
};

function PendingUpload({ mobile = false, allowed }: { mobile?: boolean; allowed: boolean }) {
  return allowed ? <DocumentUploadPending mobile={mobile} /> : null;
}

async function UploadAction({ user, view, mobile = false }: { user: SessionUser; view: View; mobile?: boolean }) {
  if (!view.storageReady || isReadOnly(user)) return null;
  let prerequisites;
  try {
    prerequisites = await Promise.all([
      loadSettings(),
      loadUsage(user),
      view.tab === "saya" ? loadFolders(user.id) : Promise.resolve([]),
    ]);
  } catch {
    return <DocumentUploadPending mobile={mobile} />;
  }
  const [settings, usage, folders] = prerequisites;
  return <DocumentUploadDialog trigger={mobile ? "fab" : "default"} settings={settings} usedBytes={usage.usedBytes} folders={folders} currentFolderId={typeof view.folderFilter === "string" ? view.folderFilter : null} />;
}

async function UsageRegion({ user }: { user: SessionUser }) {
  let usage;
  try { usage = await loadUsage(user); }
  catch { return <DocumentUsagePanel error={<DataLoadError message="Kuota dokumen belum dapat dimuat." />} />; }
  return <DocumentUsagePanel usage={usage} />;
}

async function TabsRegion({ user, tab }: { user: SessionUser; tab: WorkDocumentTab }) {
  let usage;
  try { usage = await loadUsage(user); }
  catch { return <DocumentTabs tab={tab} counts={null} />; }
  return <DocumentTabs tab={tab} counts={{ saya: usage.activeCount, dibagikan: usage.sharedCount, sampah: usage.trashCount }} />;
}

async function QuotaWarning({ user }: { user: SessionUser }) {
  if (isReadOnly(user)) return null;
  let usage;
  try { usage = await loadUsage(user); }
  catch { return null; }
  if (usage.usedBytes < usage.quotaBytes) return null;
  return <InfoBanner tone="warning" icon={Trash2}>Kuota dokumen penuh ({formatDocumentBytes(usage.usedBytes)} dari {formatDocumentBytes(usage.quotaBytes)}). Hapus dokumen permanen dari sampah untuk mengosongkan ruang sebelum mengunggah berkas baru.</InfoBanner>;
}

async function FoldersRegion({ user, view }: { user: SessionUser; view: View }) {
  let data;
  try { data = await Promise.all([loadFolders(user.id), loadUsage(user)]); }
  catch { return <DocumentFolders folders={[]} activeFolder={view.folderFilter === null ? "none" : (view.folderFilter ?? "all")} readOnly={isReadOnly(user)} error={<DataLoadError message="Folder dokumen belum dapat dimuat." />} />; }
  const [folders, usage] = data;
  const unfiledCount = Math.max(0, usage.activeCount - folders.reduce((sum, folder) => sum + folder.documentCount, 0));
  return <DocumentFolders folders={folders} activeFolder={view.folderFilter === null ? "none" : (view.folderFilter ?? "all")} unfiledCount={unfiledCount} readOnly={isReadOnly(user)} />;
}

const loadSelectedFolder = cache(async (id: string, user: SessionUser) => {
  const folder = await getWorkDocumentFolderDetail(id, user.id);
  const options = folder && !isReadOnly(user) ? await loadWorkDocumentShareOptions(user.id) : { divisions: [], supervisors: [] };
  return { folder, options };
});

async function FolderRegion({ user, id }: { user: SessionUser; id: string }) {
  let data;
  try { data = await Promise.all([loadSelectedFolder(id, user), loadSettings()]); }
  catch { return <FramePanel><DataLoadError message="Folder terpilih belum dapat dimuat." /></FramePanel>; }
  const [{ folder, options }, settings] = data;
  return folder ? <FramePanel><DocumentFolderHeader folder={folder} settings={settings} options={options} readOnly={isReadOnly(user)} /></FramePanel> : null;
}

const loadRows = cache(async (user: SessionUser, view: View) => {
  // Pemeliharaan hanya dipanggil oleh region setelah autentikasi halaman.
  await maintainDocuments();
  return getWorkDocumentPage(user, { tab: view.tab, search: view.search, page: view.request, folderId: view.folderFilter });
});

async function TotalRegion({ user, view }: { user: SessionUser; view: View }) {
  let data;
  try { data = await loadRows(user, view); }
  catch { return "Jumlah dokumen belum tersedia."; }
  return <>{data.total} dokumen pada tampilan ini.</>;
}

async function RowsRegion({ user, view }: { user: SessionUser; view: View }) {
  let result;
  try { result = await Promise.all([loadRows(user, view), loadSettings()]); }
  catch {
    return <>
      <FramePanel><DataLoadError message="Daftar dokumen belum dapat dimuat." /></FramePanel>
      <Suspense fallback={<PendingUpload mobile allowed={view.storageReady && !isReadOnly(user)} />}><UploadAction user={user} view={view} mobile /></Suspense>
    </>;
  }
  const [data, settings] = result;
  const readOnly = isReadOnly(user);
  const filtered = view.search.length > 0;
  const upload = <Suspense fallback={<PendingUpload allowed={view.storageReady && !readOnly} />}><UploadAction user={user} view={view} /></Suspense>;
  const mobileUpload = <Suspense fallback={<PendingUpload mobile allowed={view.storageReady && !readOnly} />}><UploadAction user={user} view={view} mobile /></Suspense>;
  const resetHref = view.tab === "saya" ? "/dokumen" : `/dokumen?tab=${view.tab}`;
  const browse = <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dokumen?tab=dibagikan" />}><UsersRound aria-hidden="true" />Dokumen dibagikan</Button>;
  const empty = {
    saya: {
      icon: typeof view.folderFilter === "string" ? FolderOpen : FileLock2,
      title: filtered ? "Tidak ada dokumen yang cocok" : typeof view.folderFilter === "string" ? "Folder ini masih kosong" : view.folderFilter === null ? "Belum ada dokumen tanpa folder" : "Belum ada dokumen kerja",
      description: filtered ? "Ubah kata kunci pencarian atau kembali ke seluruh dokumen." : readOnly ? "Akunmu berada dalam mode hanya-baca, jadi belum dapat mengunggah dokumen kerja. Dokumen yang dibagikan tetap dapat dibuka." : typeof view.folderFilter === "string" ? "Unggah berkas untuk mengisi folder ini. Setiap berkas dapat diberi deskripsi sendiri saat diunggah." : view.folderFilter === null ? "Dokumen yang belum dimasukkan ke folder akan muncul di sini." : "Unggah referensi, panduan, atau tutorial kerja. Dokumen tetap privat sampai kamu membagikannya.",
      action: readOnly ? browse : <div className="max-md:hidden">{upload}</div>,
    },
    dibagikan: { icon: UsersRound, title: filtered ? "Tidak ada dokumen yang cocok" : "Belum ada dokumen dibagikan", description: filtered ? "Ubah kata kunci atau kembali ke seluruh dokumen yang dibagikan." : "Dokumen rekan kerja atau atasan akan muncul di sini setelah mereka membuka akses hanya-baca.", action: <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dokumen" />}>Dokumen saya</Button> },
    sampah: { icon: Trash2, title: filtered ? "Tidak ada dokumen yang cocok" : "Sampah kosong", description: filtered ? "Ubah kata kunci atau kembali ke seluruh isi sampah." : `Dokumen yang kamu hapus akan tersimpan di sini selama ${settings.trashRetentionDays} hari sebelum dihapus permanen.`, action: <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dokumen" />}>Dokumen saya</Button> },
  }[view.tab];
  return <>
    <FramePanel className="p-0">
      {data.rows.length === 0 ? <EmptyState icon={empty.icon} title={empty.title} description={empty.description} action={filtered ? <Button size="sm" variant="outline" nativeButton={false} render={<Link href={resetHref} />}><Search aria-hidden="true" />Hapus pencarian</Button> : empty.action} /> : <DocumentList rows={data.rows} total={data.total} pagination={data.page} tab={view.tab} readOnly={readOnly} trashRetentionDays={settings.trashRetentionDays} mobileFab={mobileUpload} />}
    </FramePanel>
    {data.total > 0 && <FrameFooter><DocumentPagination page={data.page.pageIndex} pageSize={data.page.pageSize} total={data.total} /></FrameFooter>}
    {data.rows.length === 0 ? mobileUpload : null}
  </>;
}

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const requestedTab = first(params.tab);
  const tab: WorkDocumentTab = requestedTab === "dibagikan" || requestedTab === "sampah" ? requestedTab : "saya";
  const folder = first(params.folder);
  const folderFilter = tab === "saya" && folder && folder !== "all" ? folder === "none" ? null : /^fld_[a-z0-9-]{36}$/.test(folder) ? folder : undefined : undefined;
  const view: View = { tab, search: (first(params.search) ?? "").trim().slice(0, 120), request: pageRequest(first(params.page), first(params.size)), folderFilter, storageReady: isDocumentStorageConfigured() };
  const canUpload = view.storageReady && !isReadOnly(user);
  return <DocumentPageShell
    storageReady={view.storageReady}
    storageMessage={documentStorageConfigMessage()}
    action={<Suspense fallback={<PendingUpload allowed={canUpload} />}><UploadAction user={user} view={view} /></Suspense>}
    mobileAction={false}
    warning={<Suspense fallback={null}><QuotaWarning user={user} /></Suspense>}
    total={<Suspense fallback={<Skeleton className="h-3 w-44 max-w-full" />}><TotalRegion user={user} view={view} /></Suspense>}
    tabs={<Suspense fallback={<DocumentTabs tab={tab} />}><TabsRegion user={user} tab={tab} /></Suspense>}
    folderHeader={tab === "saya" && typeof folderFilter === "string" ? <Suspense fallback={<FramePanel><Skeleton className="h-8 w-48" /></FramePanel>}><FolderRegion user={user} id={folderFilter} /></Suspense> : undefined}
    rows={<Suspense key={JSON.stringify(params)} fallback={<><DocumentRowsSkeleton /><PendingUpload mobile allowed={canUpload} /></>}><RowsRegion user={user} view={view} /></Suspense>}
    folders={tab === "saya" ? <Suspense fallback={<DocumentFolders folders={[]} activeFolder={folderFilter === null ? "none" : (folderFilter ?? "all")} readOnly={isReadOnly(user)} loading />}><FoldersRegion user={user} view={view} /></Suspense> : undefined}
    usage={<Suspense fallback={<DocumentUsagePanel />}><UsageRegion user={user} /></Suspense>}
  />;
}
