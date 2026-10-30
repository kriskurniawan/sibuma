"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Download,
  Eye,
  FileLock2,
  FolderInput,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import {
  DocumentShareBadges,
  DocumentTypeBadge,
} from "@/components/dokumen/document-badges";
import { DocumentFileIcon } from "@/components/dokumen/document-file-icon";
import { DocumentSharePanel } from "@/components/dokumen/document-share-panel";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Badge, DataRow, InfoBanner, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import {
  formatDocumentBytes,
  WORK_DOCUMENT_PREVIEW_EXTENSIONS,
  type WorkDocumentDetail,
  type WorkDocumentFolder,
  type WorkDocumentSettings,
  type WorkDocumentShareOptions,
} from "@/lib/work-document-types";

type ConfirmAction = "delete" | "restore" | "purge" | null;
const NO_FOLDER = "none";

export function DocumentDetailView({
  document,
  settings,
  shareOptions,
  folders,
  storageReady,
  storageMessage,
  readOnly,
}: {
  document: WorkDocumentDetail;
  settings: WorkDocumentSettings;
  shareOptions: WorkDocumentShareOptions;
  folders: WorkDocumentFolder[];
  storageReady: boolean;
  storageMessage: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [title, setTitle] = useState(document.title);
  const [description, setDescription] = useState(document.description);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveFolderId, setMoveFolderId] = useState(
    document.folderId ?? NO_FOLDER,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const canPreview = WORK_DOCUMENT_PREVIEW_EXTENSIONS.has(document.extension);
  const fileUrl = `/api/dokumen/${document.id}/file`;
  const downloadUrl = `${fileUrl}?download=1`;

  function openRename() {
    setTitle(document.title);
    setDescription(document.description);
    setRenameOpen(true);
  }

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("rename");
    try {
      const response = await fetch(`/api/dokumen/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Dokumen gagal diubah.");
      }
      toast.success("Dokumen kerja diperbarui.");
      setRenameOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Dokumen gagal diubah.",
      );
    } finally {
      setBusy(null);
    }
  }

  function openMove() {
    setMoveFolderId(document.folderId ?? NO_FOLDER);
    setMoveOpen(true);
  }

  async function move(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("move");
    try {
      const response = await fetch(`/api/dokumen/${document.id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: moveFolderId === NO_FOLDER ? null : moveFolderId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Dokumen gagal dipindahkan.");
      }
      toast.success(
        moveFolderId === NO_FOLDER
          ? "Dokumen dipindahkan ke luar folder."
          : "Dokumen dipindahkan ke folder.",
      );
      setMoveOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Dokumen gagal dipindahkan.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function run(action: Exclude<ConfirmAction, null>) {
    if (busy) return;
    setBusy(action);
    try {
      const endpoint =
        action === "delete"
          ? `/api/dokumen/${document.id}`
          : action === "restore"
            ? `/api/dokumen/${document.id}/restore`
            : `/api/dokumen/${document.id}/purge`;
      const response = await fetch(endpoint, {
        method: action === "delete" ? "DELETE" : "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Tindakan gagal dijalankan.");
      }
      setConfirm(null);
      if (action === "delete") {
        toast.success("Dokumen dipindahkan ke sampah.");
        router.push("/dokumen?tab=sampah");
      } else if (action === "purge") {
        toast.success("Dokumen dihapus permanen.");
        router.push("/dokumen?tab=sampah");
      } else {
        toast.success("Dokumen dipulihkan dari sampah.");
        router.refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Tindakan gagal dijalankan.",
      );
    } finally {
      setBusy(null);
    }
  }

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {storageReady && (
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<a href={downloadUrl} />}
        >
          <Download aria-hidden="true" />
          Unduh
        </Button>
      )}
      {document.isOwner && !readOnly && !document.deletedAt && (
        <>
          <Button size="sm" variant="outline" onClick={openRename}>
            <Pencil aria-hidden="true" />
            Ubah
          </Button>
          {folders.length > 0 && (
            <Button size="sm" variant="outline" onClick={openMove}>
              <FolderInput aria-hidden="true" />
              Pindahkan
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirm("delete")}
          >
            <Trash2 aria-hidden="true" />
            Hapus
          </Button>
        </>
      )}
      {document.isOwner && !readOnly && document.deletedAt && (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => setConfirm("restore")}
          >
            <RotateCcw aria-hidden="true" />
            Pulihkan
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy !== null}
            onClick={() => setConfirm("purge")}
          >
            <Trash2 aria-hidden="true" />
            Hapus permanen
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        eyebrow="Dokumen kerja"
        title={document.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <DocumentTypeBadge extension={document.extension} />
            <span className="tabular-nums">
              {formatDocumentBytes(document.sizeBytes)}
            </span>
            {document.deletedAt ? (
              <Badge variant="warning-light">Di sampah</Badge>
            ) : (
              <DocumentShareBadges shares={document.shares} />
            )}
          </span>
        }
        action={actionButtons}
      />

      {document.deletedAt ? (
        <InfoBanner tone="warning" icon={Trash2}>
          Dokumen ini berada di sampah dan hanya kamu yang dapat melihatnya.
          {document.purgeAfter
            ? ` Akan dihapus permanen pada ${formatDateTime(
                document.purgeAfter,
                "d MMM yyyy, HH:mm",
              )}.`
            : ""}
        </InfoBanner>
      ) : !document.isOwner ? (
        <InfoBanner tone="info" icon={Eye}>
          Dokumen ini dibagikan kepadamu secara hanya-baca. Akses dapat ditutup
          pemilik kapan saja.
        </InfoBanner>
      ) : readOnly ? (
        <InfoBanner tone="info" icon={FileLock2}>
          Akunmu berada dalam mode hanya-baca. Kamu tetap dapat membuka dan
          mengunduh dokumen ini, tetapi perubahan dan berbagi dinonaktifkan.
        </InfoBanner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Frame stacked spacing="sm">
            <FrameHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <FrameTitle>Pratinjau</FrameTitle>
                <FrameDescription className="text-xs">
                  {canPreview
                    ? "Pratinjau langsung dari penyimpanan privat."
                    : "Berkas Office hanya dapat diunduh pada tahap ini."}
                </FrameDescription>
              </div>
              {storageReady && (
                <Button
                  size="sm"
                  variant="ghost"
                  nativeButton={false}
                  render={
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <FileLock2 aria-hidden="true" />
                  Buka di tab baru
                </Button>
              )}
            </FrameHeader>
            <FramePanel className="overflow-hidden p-0">
              {!storageReady ? (
                <div className="px-4 py-6">
                  <InfoBanner tone="warning" icon={Trash2}>
                    {storageMessage}
                  </InfoBanner>
                </div>
              ) : document.extension === "pdf" ? (
                <iframe
                  src={fileUrl}
                  title={`Pratinjau ${document.title}`}
                  className="h-[min(70vh,44rem)] w-full bg-muted/30"
                />
              ) : document.extension === "jpg" ||
                document.extension === "jpeg" ||
                document.extension === "png" ? (
                <div className="flex items-center justify-center bg-muted/30 p-3">
                  {/* Berkas privat di balik route ber-otorisasi; bukan aset publik. */}
                  <img
                    src={fileUrl}
                    alt={`Pratinjau ${document.title}`}
                    className="max-h-[70vh] w-auto max-w-full rounded-md object-contain"
                  />
                </div>
              ) : document.extension === "mp4" ||
                document.extension === "webm" ||
                document.extension === "mov" ? (
                <div className="flex items-center justify-center bg-black/90 p-0">
                  {/* Video dialihkan ke URL bertanda tangan 15 menit; byte tidak
                      melewati fungsi Vercel sehingga seek tetap berfungsi. */}
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    className="max-h-[70vh] w-full"
                    src={fileUrl}
                  >
                    Browser ini tidak dapat memutar video{" "}
                    {document.extension.toUpperCase()}.
                  </video>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                  <DocumentFileIcon
                    extension={document.extension}
                    size="lg"
                  />
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">
                      Pratinjau belum tersedia
                    </p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      Berkas {document.extension.toUpperCase()} dapat dibuka
                      setelah diunduh. Akses tetap diperiksa setiap unduhan.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<a href={downloadUrl} />}
                  >
                    <Download aria-hidden="true" />
                    Unduh berkas
                  </Button>
                </div>
              )}
            </FramePanel>
          </Frame>

          {document.description && (
            <Frame stacked spacing="sm">
              <FrameHeader>
                <FrameTitle>Keterangan</FrameTitle>
              </FrameHeader>
              <FramePanel>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {document.description}
                </p>
              </FramePanel>
            </Frame>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {document.isOwner && !document.deletedAt && !readOnly ? (
            <DocumentSharePanel
              document={document}
              settings={settings}
              options={shareOptions}
            />
          ) : (
            <Frame stacked spacing="sm">
              <FrameHeader>
                <FrameTitle>Akses</FrameTitle>
                <FrameDescription className="text-xs">
                  {document.deletedAt
                    ? "Dokumen di sampah tidak dibagikan ke siapa pun."
                    : document.isOwner
                      ? "Pembagian akses dinonaktifkan pada mode hanya-baca."
                      : "Dibagikan oleh pemilik dokumen."}
                </FrameDescription>
              </FrameHeader>
              <FramePanel className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {document.ownerName}
                  </span>
                  <DocumentShareBadges shares={document.shares} />
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Eye className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {document.isOwner
                      ? "Kamu tetap dapat membuka dan mengunduh. Perubahan dan berbagi dinonaktifkan selama akun berada di mode hanya-baca."
                      : "Kamu hanya dapat melihat dan mengunduh. Perubahan dan berbagi hanya dapat dilakukan pemilik."}
                  </span>
                </div>
              </FramePanel>
            </Frame>
          )}

          <Frame stacked spacing="sm">
            <FrameHeader>
              <FrameTitle>Informasi berkas</FrameTitle>
            </FrameHeader>
            <FramePanel className="flex flex-col py-0">
              <DataRow
                label="Pemilik"
                value={
                  <span className="text-right">
                    {document.ownerName}
                    <span className="block text-xs text-muted-foreground">
                      {document.ownerDivisionName ?? "Tanpa divisi"}
                    </span>
                  </span>
                }
              />
              <DataRow
                label="Folder"
                value={
                  document.folderId ? (
                    <Link
                      href={`/dokumen?folder=${document.folderId}`}
                      className="max-w-52 truncate transition-colors hover:text-primary"
                    >
                      {document.folderName ?? "Folder"}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Tanpa folder</span>
                  )
                }
              />
              <DataRow
                label="Nama berkas"
                value={
                  <span className="max-w-52 truncate" title={document.fileName}>
                    {document.fileName}
                  </span>
                }
              />
              <DataRow
                label="Ukuran"
                value={
                  <span className="tabular-nums">
                    {formatDocumentBytes(document.sizeBytes)}
                  </span>
                }
              />
              <DataRow
                label="Diunggah"
                value={
                  <span className="flex items-center gap-1 tabular-nums">
                    <CalendarClock
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    {formatDateTime(document.createdAt, "d MMM yyyy, HH:mm")}
                  </span>
                }
              />
              <DataRow
                label="Diperbarui"
                value={
                  <span className="tabular-nums">
                    {formatDateTime(document.updatedAt, "d MMM yyyy, HH:mm")}
                  </span>
                }
                className="border-b-0"
              />
            </FramePanel>
          </Frame>
        </div>
      </div>

      <Modal
        open={renameOpen}
        onClose={() => {
          if (busy !== "rename") setRenameOpen(false);
        }}
        title="Ubah dokumen kerja"
        description="Nama dan keterangan dapat diubah kapan saja. Berkas tetap sama."
        size="md"
        dismissible={busy !== "rename"}
        footer={
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={busy === "rename"}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              form="document-rename-form"
              disabled={busy === "rename" || title.trim().length === 0}
            >
              {busy === "rename" ? <Spinner /> : <Pencil aria-hidden="true" />}
              {busy === "rename" ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        }
      >
        <form
          id="document-rename-form"
          className="flex flex-col gap-4"
          onSubmit={rename}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="document-rename-title">Nama dokumen</Label>
            <Input
              id="document-rename-title"
              value={title}
              maxLength={160}
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="document-rename-description">Keterangan</Label>
            <Textarea
              id="document-rename-description"
              value={description}
              maxLength={1_000}
              rows={4}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Opsional: kegunaan atau sumber referensi."
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={moveOpen}
        onClose={() => {
          if (busy !== "move") setMoveOpen(false);
        }}
        title="Pindahkan dokumen"
        description="Berbagi mengikuti folder tujuan. Dokumen di luar folder tetap memakai berbagi per dokumen."
        size="sm"
        dismissible={busy !== "move"}
        footer={
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMoveOpen(false)}
              disabled={busy === "move"}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              form="document-move-form"
              disabled={busy === "move"}
            >
              {busy === "move" ? <Spinner /> : <FolderInput aria-hidden="true" />}
              {busy === "move" ? "Memindahkan…" : "Pindahkan"}
            </Button>
          </>
        }
      >
        <form
          id="document-move-form"
          className="flex flex-col gap-4"
          onSubmit={move}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="document-move-folder">Folder tujuan</Label>
            <Select
              value={moveFolderId}
              onValueChange={(value) => setMoveFolderId(value as string)}
              items={[
                { value: NO_FOLDER, label: "Tanpa folder" },
                ...folders.map((folder) => ({
                  value: folder.id,
                  label: folder.name,
                })),
              ]}
            >
              <SelectTrigger id="document-move-folder" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FOLDER}>Tanpa folder</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Nama dan deskripsi folder mewakili seluruh berkas di dalamnya.
            </p>
          </div>
        </form>
      </Modal>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "delete"
                ? "Pindahkan ke sampah?"
                : confirm === "restore"
                  ? "Pulihkan dokumen?"
                  : "Hapus permanen dokumen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? `Dokumen "${document.title}" akan dipindahkan ke sampah dan dihapus permanen setelah ${settings.trashRetentionDays} hari. Berbagi otomatis ditutup.`
                : confirm === "restore"
                  ? `Dokumen "${document.title}" akan kembali aktif dan dapat dibagikan lagi.`
                  : `Dokumen "${document.title}" beserta berkasnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Batal</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant={confirm === "purge" ? "destructive" : "default"}
              disabled={busy !== null}
              onClick={() => {
                if (confirm) void run(confirm);
              }}
            >
              {busy !== null && <Spinner />}
              {busy !== null
                ? "Memproses…"
                : confirm === "delete"
                  ? "Pindahkan"
                  : confirm === "restore"
                    ? "Pulihkan"
                    : "Hapus permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="text-xs text-muted-foreground">
        <Link
          href="/dokumen"
          className="transition-colors hover:text-foreground"
        >
          Kembali ke daftar dokumen
        </Link>
      </p>
    </div>
  );
}
