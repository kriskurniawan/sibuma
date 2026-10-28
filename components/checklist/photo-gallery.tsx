"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
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
import { compressImage } from "@/lib/compress-image";
import { UPLOAD_MAX_BYTES } from "@/lib/constants";
import { formatDateTime } from "@/lib/time";
import type { ChecklistPhoto, ChecklistPhotoStage } from "@/lib/checklist-types";

export function ChecklistPhotoGallery({
  photos,
  inspectionId,
  answerId,
  followUpId,
  canUpload,
  canDelete,
  stage = "temuan",
  onChanged,
  onUploadingChange,
}: {
  photos: ChecklistPhoto[];
  inspectionId: string;
  answerId?: string;
  followUpId?: string;
  canUpload: boolean;
  /** Defaults to canUpload for callers that have a single permission. */
  canDelete?: boolean;
  stage?: ChecklistPhotoStage;
  onChanged: () => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ChecklistPhoto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChecklistPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const allowDelete = canDelete ?? canUpload;

  async function uploadFile(file: File) {
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const optimized = await compressImage(file, UPLOAD_MAX_BYTES);
      if (optimized.size > UPLOAD_MAX_BYTES) {
        setPendingFile(null);
        toast.error("Foto masih terlalu besar setelah dikompresi. Pilih foto lain.");
        return;
      }
      const body = new FormData();
      body.set("file", optimized);
      body.set("stage", followUpId ? "perbaikan" : stage);
      if (answerId) body.set("answerId", answerId);
      if (followUpId) body.set("followUpId", followUpId);
      const response = await fetch(
        `/api/checklist/inspections/${inspectionId}/photos`,
        { method: "POST", body },
      );
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok) {
        setPendingFile(file);
        toast.error(data.message ?? "Gagal mengunggah foto.");
        return;
      }
      setPendingFile(null);
      toast.success("Foto ditambahkan.");
      onChanged();
    } catch {
      setPendingFile(file);
      toast.error("Gagal mengunggah foto. Periksa koneksi lalu coba lagi.");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPendingFile(null);
    await uploadFile(file);
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/checklist/photos/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal menghapus foto.");
        return;
      }
      toast.success("Foto dihapus.");
      setDeleteTarget(null);
      setPreview(null);
      onChanged();
    } catch {
      toast.error("Gagal menghapus foto. Coba lagi.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setPreview(photo)}
            className="group relative size-16 overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={photo.caption || "Buka foto checklist"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/checklist/photos/${photo.id}`}
              alt={photo.caption || "Foto checklist"}
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition-opacity group-hover:opacity-90"
            />
            {photo.stage === "perbaikan" && (
              <span className="absolute inset-x-0 bottom-0 bg-foreground/70 py-0.5 text-center text-xs leading-none text-background">
                Perbaikan
              </span>
            )}
          </button>
        ))}

        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={upload}
              aria-label="Pilih foto checklist"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Spinner /> : <ImagePlus />}
              {uploading ? "Mengunggah…" : "Tambah foto"}
            </Button>
          </>
        )}
        {photos.length === 0 && !canUpload && (
          <span className="text-xs text-muted-foreground">Belum ada foto.</span>
        )}
      </div>

      {pendingFile && !uploading && canUpload && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Foto gagal diunggah.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => uploadFile(pendingFile)}
          >
            <RotateCcw />
            Coba lagi
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPendingFile(null)}
          >
            Abaikan
          </Button>
        </div>
      )}

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.caption || "Foto checklist"}
        description={
          preview?.createdAt
            ? `Diunggah ${formatDateTime(preview.createdAt, "d MMM yyyy, HH:mm")}`
            : undefined
        }
        size="lg"
        footer={
          preview && allowDelete ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(preview)}
            >
              <Trash2 />
              Hapus foto
            </Button>
          ) : undefined
        }
      >
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/checklist/photos/${preview.id}`}
            alt={preview.caption || "Foto checklist"}
            className="max-h-[65vh] w-full object-contain"
          />
        )}
      </Modal>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus foto ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Foto akan dihapus dari checklist dan penyimpanan privat. Tindakan
              ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={remove}
              disabled={deleting}
            >
              {deleting ? "Menghapus…" : "Hapus foto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
