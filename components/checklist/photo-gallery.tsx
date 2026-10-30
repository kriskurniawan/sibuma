"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Film, ImagePlus, Play, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
import { EvidenceVideoUpload } from "@/components/evidence-video-upload";
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
import type {
  ChecklistPhoto,
  ChecklistPhotoStage,
} from "@/lib/checklist-types";
import { formatDateTime } from "@/lib/time";
import { formatVideoDuration } from "@/lib/video";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

type FailedPhoto = {
  id: string;
  file: File;
  preview: string;
  message: string;
};

export function ChecklistPhotoGallery({
  photos,
  inspectionId,
  answerId,
  followUpId,
  canUpload,
  canDelete,
  stage = "temuan",
  maxPhotos,
  maxVideos,
  videoMaxBytes,
  videoEnabled,
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
  maxPhotos: number;
  maxVideos: number;
  videoMaxBytes: number;
  videoEnabled: boolean;
  onChanged: () => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const failedRef = useRef<FailedPhoto[]>([]);
  const nextIdRef = useRef(0);
  const [failedPhotos, setFailedPhotos] = useState<FailedPhoto[]>([]);
  // ID foto yang sudah diunggah tetapi daftar dari server belum memuatnya.
  // Foto yang sama tidak dihitung dua kali setelah refresh selesai.
  const [optimisticIds, setOptimisticIds] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ChecklistPhoto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChecklistPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const allowDelete = canDelete ?? canUpload;
  const photoItems = photos.filter((photo) => photo.kind !== "video");
  const videoItems = photos.filter((photo) => photo.kind === "video");
  const visibleIds = new Set(photos.map((photo) => photo.id));
  const pendingUploads = optimisticIds.filter((id) => !visibleIds.has(id)).length;
  const totalCount = photoItems.length + failedPhotos.length + pendingUploads;
  const atLimit = totalCount >= maxPhotos;
  const remainingSlots = Math.max(0, maxPhotos - totalCount);
  const videoAtLimit = videoItems.length >= maxVideos;
  const videoAvailable = videoEnabled && maxVideos > 0;

  useEffect(() => {
    return () => {
      for (const photo of failedRef.current) {
        URL.revokeObjectURL(photo.preview);
      }
    };
  }, []);

  function replaceFailed(next: FailedPhoto[]) {
    failedRef.current = next;
    setFailedPhotos(next);
  }

  function removeFailed(id: string) {
    const target = failedRef.current.find((photo) => photo.id === id);
    if (target) URL.revokeObjectURL(target.preview);
    replaceFailed(failedRef.current.filter((photo) => photo.id !== id));
    setError(null);
  }

  function clearFailed() {
    for (const photo of failedRef.current) {
      URL.revokeObjectURL(photo.preview);
    }
    replaceFailed([]);
    setError(null);
  }

  function onGalleryChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    // Reset segera agar memilih file yang sama tetap memicu onChange.
    event.target.value = "";
    void addFiles(chosen);
  }

  async function uploadOne(file: File) {
    const optimized = await compressImage(file, UPLOAD_MAX_BYTES);
    if (optimized.size > UPLOAD_MAX_BYTES) {
      throw new Error(
        "Foto masih terlalu besar setelah dikompresi. Pilih foto lain.",
      );
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
    let message = "Gagal mengunggah foto.";
    let photoId = "";
    try {
      const data = (await response.json()) as {
        message?: string;
        photo?: { id?: string };
      };
      if (data.message) message = data.message;
      if (data.photo?.id) photoId = data.photo.id;
    } catch {
      // Respons non-JSON tetap memakai pesan umum di atas.
    }
    if (!response.ok) throw new Error(message);
    return photoId;
  }

  async function addFiles(chosen: File[]) {
    if (!canUpload || uploading) return;
    if (chosen.length === 0) return;

    const notices: string[] = [];
    const valid = chosen.filter((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        notices.push(`${file.name}: format harus JPG, PNG, atau WEBP.`);
        return false;
      }
      if (file.size > MAX_SOURCE_BYTES) {
        notices.push(`${file.name}: ukuran asli maksimal 12 MB.`);
        return false;
      }
      return true;
    });

    const slots = Math.max(0, maxPhotos - totalCount);
    if (slots === 0) {
      setNotice(null);
      setError(
        `Batas ${maxPhotos} foto sudah tercapai. Hapus foto lama terlebih dahulu.`,
      );
      return;
    }

    const accepted = valid.slice(0, slots);
    if (valid.length > slots) {
      notices.push(
        `Hanya ${slots} foto lagi yang dapat ditambahkan pada item ini.`,
      );
    }
    if (accepted.length === 0) {
      setError(null);
      setNotice(notices[0] ?? null);
      return;
    }

    setError(null);
    setNotice(null);
    setUploading(true);
    onUploadingChange?.(true);
    let success = 0;
    let firstError = "";
    const failures: FailedPhoto[] = [];

    try {
      for (let index = 0; index < accepted.length; index += 1) {
        const file = accepted[index];
        setProgress({ current: index + 1, total: accepted.length });
        try {
          const photoId = await uploadOne(file);
          success += 1;
          if (photoId) {
            setOptimisticIds((ids) =>
              ids.includes(photoId) ? ids : [...ids, photoId],
            );
          }
        } catch (uploadError) {
          const message =
            uploadError instanceof Error
              ? uploadError.message
              : "Gagal mengunggah foto. Periksa koneksi.";
          if (!firstError) firstError = message;
          nextIdRef.current += 1;
          failures.push({
            id: `failed-${nextIdRef.current}`,
            file,
            preview: URL.createObjectURL(file),
            message,
          });
        }
      }
    } finally {
      setUploading(false);
      setProgress(null);
      onUploadingChange?.(false);
    }

    if (failures.length > 0) {
      replaceFailed([...failedRef.current, ...failures]);
    }
    if (success > 0) {
      toast.success(
        success === 1 ? "Foto ditambahkan." : `${success} foto ditambahkan.`,
      );
      onChanged();
    }
    if (failures.length > 0) {
      setError(
        `${failures.length} foto gagal diunggah. ${firstError} Kamu dapat mencoba lagi tanpa memilih ulang.`,
      );
      toast.error(
        failures.length === 1
          ? "Satu foto gagal diunggah."
          : `${failures.length} foto gagal diunggah.`,
      );
    }
    if (notices.length > 0) {
      setNotice(
        `${notices[0]}${notices.length > 1 ? ` (+${notices.length - 1} catatan lain)` : ""}`,
      );
    }
  }

  async function retryFailed() {
    if (!canUpload || uploading || failedRef.current.length === 0) return;

    const snapshot = [...failedRef.current];
    const slots = Math.max(
      0,
      maxPhotos - (photoItems.length + pendingUploads),
    );
    if (slots === 0) {
      setNotice(null);
      setError(
        `Batas ${maxPhotos} foto sudah tercapai. Hapus foto lama terlebih dahulu.`,
      );
      return;
    }

    const attempted = snapshot.slice(0, slots);
    const skipped = snapshot.slice(slots);
    setError(null);
    setNotice(
      skipped.length > 0
        ? `Hanya ${slots} foto dapat diunggah karena batas ${maxPhotos} foto.`
        : null,
    );
    setUploading(true);
    onUploadingChange?.(true);
    let success = 0;
    let firstError = "";
    const failures: FailedPhoto[] = [];

    try {
      for (let index = 0; index < attempted.length; index += 1) {
        const photo = attempted[index];
        setProgress({ current: index + 1, total: attempted.length });
        try {
          const photoId = await uploadOne(photo.file);
          success += 1;
          URL.revokeObjectURL(photo.preview);
          if (photoId) {
            setOptimisticIds((ids) =>
              ids.includes(photoId) ? ids : [...ids, photoId],
            );
          }
        } catch (uploadError) {
          const message =
            uploadError instanceof Error
              ? uploadError.message
              : "Gagal mengunggah foto. Periksa koneksi.";
          if (!firstError) firstError = message;
          failures.push({ ...photo, message });
        }
      }
    } finally {
      setUploading(false);
      setProgress(null);
      onUploadingChange?.(false);
    }

    replaceFailed([...failures, ...skipped]);
    if (success > 0) {
      toast.success(
        success === 1 ? "Foto ditambahkan." : `${success} foto ditambahkan.`,
      );
      onChanged();
    }
    if (failures.length > 0) {
      setError(
        `${failures.length} foto masih gagal diunggah. ${firstError}`,
      );
      toast.error(
        failures.length === 1
          ? "Satu foto masih gagal diunggah."
          : `${failures.length} foto masih gagal diunggah.`,
      );
    }
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
        {photoItems.map((photo) => (
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
              className="size-full object-cover group-hover:opacity-90"
            />
            {photo.stage === "perbaikan" && (
              <span className="absolute inset-x-0 bottom-0 bg-foreground/70 py-0.5 text-center text-xs leading-none text-background">
                Perbaikan
              </span>
            )}
          </button>
        ))}

        {videoItems.map((video) => (
          <button
            key={video.id}
            type="button"
            onClick={() => setPreview(video)}
            className="group relative size-16 overflow-hidden rounded-md bg-black outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={video.caption || "Buka video checklist"}
          >
            <video
              src={`/api/checklist/photos/${video.id}#t=0.5`}
              preload="metadata"
              muted
              playsInline
              className="size-full object-cover group-hover:opacity-90"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Play
                className="size-5 text-white"
                fill="currentColor"
                aria-hidden="true"
              />
            </span>
            <span className="absolute inset-x-0 bottom-0 bg-foreground/70 py-0.5 text-center text-xs leading-none text-background">
              {formatVideoDuration(video.durationSeconds) ?? "Video"}
            </span>
          </button>
        ))}

        {failedPhotos.map((photo) => (
          <div key={photo.id} className="flex w-16 flex-col gap-1">
            <div className="relative">
              <div
                className="size-16 overflow-hidden rounded-md bg-muted ring-1 ring-destructive/50"
                title={photo.message}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.preview}
                  alt="Pratinjau foto yang gagal diunggah"
                  className="size-full object-cover"
                />
              </div>
              <Button
                type="button"
                size="icon-xs"
                variant="secondary"
                className="absolute -right-1.5 -top-1.5"
                onClick={() => removeFailed(photo.id)}
                disabled={uploading}
                aria-label="Hapus foto yang gagal diunggah"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <span className="truncate text-center text-xs text-destructive">
              Gagal
            </span>
          </div>
        ))}

        {canUpload && (
          <>
            <input
              ref={galleryRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={onGalleryChange}
              aria-label="Pilih beberapa foto checklist dari galeri"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCameraOpen(true)}
              disabled={uploading || atLimit}
              title={
                atLimit
                  ? `Maksimal ${maxPhotos} foto per item atau tindak lanjut.`
                  : undefined
              }
            >
              <Camera aria-hidden="true" />
              Kamera
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => galleryRef.current?.click()}
              disabled={uploading || atLimit}
              title={
                atLimit
                  ? `Maksimal ${maxPhotos} foto per item atau tindak lanjut.`
                  : undefined
              }
            >
              <ImagePlus aria-hidden="true" />
              Galeri
            </Button>
            {videoAvailable && (
              <EvidenceVideoUpload
                prepareUrl={`/api/checklist/inspections/${inspectionId}/videos/prepare`}
                completeUrl={`/api/checklist/inspections/${inspectionId}/videos/complete`}
                target={
                  followUpId
                    ? { followUpId, stage: "perbaikan" }
                    : { answerId, stage }
                }
                maxBytes={videoMaxBytes}
                disabled={uploading || videoAtLimit}
                disabledReason={
                  videoAtLimit
                    ? `Maksimal ${maxVideos} video per item atau tindak lanjut.`
                    : uploading
                      ? "Tunggu unggahan sebelumnya selesai."
                      : undefined
                }
                onUploaded={() => onChanged()}
              />
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {totalCount}/{maxPhotos} foto
            </span>
            {videoItems.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {videoItems.length}/{maxVideos} video
              </span>
            )}
          </>
        )}

        {photos.length === 0 && failedPhotos.length === 0 && !canUpload && (
          <span className="text-xs text-muted-foreground">
            Belum ada foto atau video.
          </span>
        )}
      </div>

      {uploading && progress && (
        <p
          className="flex items-center gap-2 text-xs text-muted-foreground"
          role="status"
        >
          <Spinner />
          Mengunggah foto {progress.current} dari {progress.total}…
        </p>
      )}

      {notice && (
        <p className="text-xs text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {canUpload && failedPhotos.length > 0 && !uploading && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={retryFailed}
          >
            <RotateCcw aria-hidden="true" />
            Coba unggah {failedPhotos.length} foto
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearFailed}
          >
            Abaikan
          </Button>
        </div>
      )}

      {atLimit && (
        <p className="text-xs text-muted-foreground">
          Batas {maxPhotos} foto tercapai.
        </p>
      )}

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={
          preview?.caption ||
          (preview?.kind === "video" ? "Video checklist" : "Foto checklist")
        }
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
              {preview.kind === "video" ? "Hapus video" : "Hapus foto"}
            </Button>
          ) : undefined
        }
      >
        {preview &&
          (preview.kind === "video" ? (
            <video
              src={`/api/checklist/photos/${preview.id}`}
              controls
              playsInline
              preload="metadata"
              className="max-h-[65vh] w-full rounded-md bg-black"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/checklist/photos/${preview.id}`}
              alt={preview.caption || "Foto checklist"}
              className="max-h-[65vh] w-full object-contain"
            />
          ))}
      </Modal>

      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={async (file) => {
          await addFiles([file]);
        }}
        disabled={atLimit || uploading}
        disabledReason={
          atLimit
            ? `Batas ${maxPhotos} foto tercapai. Hapus foto lama terlebih dahulu.`
            : uploading
              ? "Tunggu unggahan foto sebelumnya selesai."
              : undefined
        }
        title="Ambil foto checklist"
        description={`${remainingSlots} slot foto tersisa`}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hapus {deleteTarget?.kind === "video" ? "video" : "foto"} ini?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "video" ? "Video" : "Foto"} akan dihapus
              dari checklist dan penyimpanan privat. Tindakan ini tidak dapat
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={remove}
              disabled={deleting}
            >
              {deleting
                ? "Menghapus…"
                : `Hapus ${deleteTarget?.kind === "video" ? "video" : "foto"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
