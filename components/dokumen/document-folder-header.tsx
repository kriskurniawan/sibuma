"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderLock, Pencil, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { DocumentFolderDialog } from "@/components/dokumen/document-folder-dialog";
import { DocumentShareDialog } from "@/components/dokumen/document-share-dialog";
import { DocumentShareSummary } from "@/components/dokumen/document-share-summary";
import { Alert, AlertDescription } from "@/components/reui/alert";
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
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui";
import {
  formatDocumentBytes,
  type WorkDocumentFolderDetail,
  type WorkDocumentSettings,
  type WorkDocumentShareOptions,
} from "@/lib/work-document-types";

/**
 * Header folder terpilih: deskripsi, jumlah berkas, dan penerima akses
 * hanya-baca. Membagikan folder membuka seluruh berkas di dalamnya.
 */
export function DocumentFolderHeader({
  folder,
  settings,
  options,
  readOnly,
}: {
  folder: WorkDocumentFolderDetail;
  settings: Pick<
    WorkDocumentSettings,
    "shareToDivision" | "shareToSupervisor"
  >;
  options: WorkDocumentShareOptions;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/dokumen/folders/${folder.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Folder gagal dihapus.");
      }
      toast.success(
        `Folder dihapus. ${folder.documentCount} berkas tetap tersimpan tanpa folder.`,
      );
      router.push("/dokumen");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Folder gagal dihapus.",
      );
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {folder.name}
              </span>
              <Badge variant="outline" className="tabular-nums">
                {folder.documentCount} berkas
              </Badge>
              <Badge variant="outline" className="tabular-nums">
                {formatDocumentBytes(folder.sizeBytes)}
              </Badge>
            </div>
            <p className="max-w-prose whitespace-pre-line text-sm text-muted-foreground">
              {folder.description || "Folder ini belum memiliki deskripsi."}
            </p>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditOpen(true)}
              >
                <Pencil aria-hidden="true" />
                Ubah
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 aria-hidden="true" />
                Hapus
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border/70 pt-3">
          {(!settings.shareToDivision || !settings.shareToSupervisor) && (
            <Alert variant="warning">
              <AlertDescription>
                Sebagian opsi berbagi dinonaktifkan oleh super admin. Penerima
                yang sudah ada tetap berlaku sampai dihapus.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <FolderLock
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  Berbagi hanya-baca
                </span>
                <span className="text-xs text-muted-foreground">
                  Seluruh isi folder dapat dibuka penerima yang dipilih.
                </span>
              </div>
            </div>
            {!readOnly && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShareOpen(true)}
              >
                <UsersRound aria-hidden="true" />
                Atur akses
              </Button>
            )}
          </div>
          <DocumentShareSummary
            targets={folder.shareTargets}
            empty="Privat — hanya kamu yang dapat membuka folder ini."
          />
        </div>
      </div>

      <DocumentFolderDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        folder={folder}
      />

      <DocumentShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        endpoint={`/api/dokumen/folders/${folder.id}/shares`}
        title="Atur akses folder"
        description="Pilih divisi dan atasan yang boleh membuka seluruh isi folder. Akses hanya-baca dan dapat dicabut kapan saja."
        options={options}
        targets={folder.shareTargets}
        settings={settings}
        successMessage="Akses hanya-baca folder diperbarui."
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus folder ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Folder &quot;{folder.name}&quot; akan dihapus, tetapi{" "}
              {folder.documentCount} berkas di dalamnya tetap tersimpan dan
              menjadi tanpa folder. Berbagi folder ikut ditutup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void remove()}
            >
              {deleting && <Spinner />}
              {deleting ? "Menghapus…" : "Hapus folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
