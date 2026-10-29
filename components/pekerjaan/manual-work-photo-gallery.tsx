"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Camera,
  Clock3,
  ImagePlus,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
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
import { buildManualWorkMarker } from "@/lib/documentation-marker";
import { readImageExif } from "@/lib/exif";
import {
  MANUAL_WORK_MAX_PHOTOS,
  type ManualWorkPhoto,
} from "@/lib/manual-work-types";
import { formatDateHuman, formatDateTime } from "@/lib/time";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

type PendingWorkPhoto = {
  id: string;
  file: File;
  preview: string;
  takenAt: string;
  timeLabel: "Diambil" | "Diunggah";
};

export function ManualWorkPhotoGallery({
  photos,
  workId,
  workTitle,
  canUpload,
  canDelete,
  onChanged,
  onUploadingChange,
}: {
  photos: ManualWorkPhoto[];
  workId: string;
  workTitle: string;
  canUpload: boolean;
  canDelete: boolean;
  onChanged: () => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<PendingWorkPhoto[]>([]);
  const nextIdRef = useRef(0);
  const [queue, setQueue] = useState<PendingWorkPhoto[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ManualWorkPhoto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManualWorkPhoto | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const busy = uploading || processing;
  const totalCount = photos.length + queue.length;
  const atLimit = totalCount >= MANUAL_WORK_MAX_PHOTOS;
  const remainingSlots = Math.max(
    0,
    MANUAL_WORK_MAX_PHOTOS - totalCount,
  );

  useEffect(() => {
    return () => {
      for (const photo of queueRef.current) {
        URL.revokeObjectURL(photo.preview);
      }
    };
  }, []);

  function replaceQueue(next: PendingWorkPhoto[]) {
    queueRef.current = next;
    setQueue(next);
  }

  function clearQueue() {
    for (const photo of queueRef.current) {
      URL.revokeObjectURL(photo.preview);
    }
    replaceQueue([]);
    setNotice(null);
    setError(null);
  }

  function removeQueued(id: string) {
    const target = queueRef.current.find((photo) => photo.id === id);
    if (target) URL.revokeObjectURL(target.preview);
    replaceQueue(queueRef.current.filter((photo) => photo.id !== id));
    setError(null);
  }

  function onGalleryChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    // Reset segera agar memilih file yang sama tetap memicu onChange.
    event.target.value = "";
    void addFiles(chosen);
  }

  async function addFiles(
    chosen: File[],
    options?: { cameraCapturedAt?: string },
  ) {
    if (busy) return;
    if (chosen.length === 0) return;

    const slots = remainingSlots;
    if (slots === 0) {
      setError(
        `Batas ${MANUAL_WORK_MAX_PHOTOS} foto sudah tercapai. Hapus foto lama terlebih dahulu.`,
      );
      return;
    }

    const accepted = chosen.slice(0, slots);
    const notices: string[] = [];
    if (chosen.length > slots) {
      notices.push(
        `Hanya ${slots} foto lagi yang dapat ditambahkan pada pekerjaan ini.`,
      );
    }

    setError(null);
    setNotice(null);
    setProcessing(true);
    setProcessingLabel("Menyiapkan foto…");
    onUploadingChange?.(true);
    const next: PendingWorkPhoto[] = [];
    let deviceOnly = 0;

    try {
      for (let index = 0; index < accepted.length; index += 1) {
        setProcessingLabel(
          `Menyiapkan foto ${index + 1} dari ${accepted.length}…`,
        );
        const file = accepted[index];
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          notices.push(`${file.name}: format harus JPG, PNG, atau WEBP.`);
          continue;
        }
        if (file.size > MAX_SOURCE_BYTES) {
          notices.push(`${file.name}: ukuran asli maksimal 12 MB.`);
          continue;
        }

        // Foto dari kamera dalam aplikasi memakai waktu tombol ambil. Foto
        // galeri memakai EXIF; bila tidak ada, waktu unggah dipakai dan label
        // "Diunggah" dicetak agar tidak menyamar sebagai waktu pengambilan.
        const exif = options?.cameraCapturedAt
          ? null
          : await readImageExif(file);
        const takenAt =
          options?.cameraCapturedAt ??
          exif?.takenAt ??
          new Date().toISOString();
        const source = exif?.takenAt ? "exif" : "device";
        const timeLabel =
          options?.cameraCapturedAt || exif?.takenAt ? "Diambil" : "Diunggah";
        if (!options?.cameraCapturedAt && !exif?.takenAt) deviceOnly += 1;
        const optimized = await compressImage(file, UPLOAD_MAX_BYTES, {
          fallbackName: "pekerjaan",
          lines: [
            `SIBUMA · ${workTitle}`,
            `${timeLabel} ${formatDateHuman(
              takenAt,
              "d MMM yyyy, HH.mm",
            )} WIB`,
          ],
          comment: buildManualWorkMarker({ workId, takenAt, source }),
        });
        if (optimized === file) {
          notices.push(
            `${file.name}: cap waktu tidak dapat dicetak. Coba foto lain.`,
          );
          continue;
        }
        if (optimized.size > UPLOAD_MAX_BYTES) {
          notices.push(
            `${file.name}: masih terlalu besar setelah dikompresi. Pilih foto lain.`,
          );
          continue;
        }

        nextIdRef.current += 1;
        next.push({
          id: `pending-${nextIdRef.current}`,
          file: optimized,
          preview: URL.createObjectURL(optimized),
          takenAt,
          timeLabel,
        });
      }
    } catch {
      notices.push("Sebagian foto gagal disiapkan. Coba pilih ulang.");
    } finally {
      setProcessing(false);
      setProcessingLabel(null);
      onUploadingChange?.(false);
    }

    if (next.length > 0) {
      replaceQueue([...queueRef.current, ...next]);
    }
    const messages = [...notices];
    if (deviceOnly > 0) {
      messages.push(
        `${deviceOnly} foto tanpa EXIF memakai waktu unggah dan dicetak sebagai "Diunggah".`,
      );
    }
    if (messages.length > 0) {
      const skipped = chosen.length - next.length;
      setNotice(
        `${skipped > 0 ? `${skipped} foto tidak ditambahkan. ` : ""}${messages[0]}${
          messages.length > 1 ? ` (+${messages.length - 1} catatan lain)` : ""
        }`,
      );
    }
  }

  async function submitUpload() {
    const snapshot = [...queueRef.current];
    if (snapshot.length === 0) return;
    if (busy) return;

    if (snapshot.length > remainingSlots) {
      setError(
        `Hanya ${remainingSlots} foto lagi yang dapat diunggah pada pekerjaan ini.`,
      );
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);
    onUploadingChange?.(true);
    const failed: PendingWorkPhoto[] = [];
    let success = 0;
    let firstError = "";

    try {
      for (let index = 0; index < snapshot.length; index += 1) {
        const photo = snapshot[index];
        setUploadProgress({ current: index + 1, total: snapshot.length });
        try {
          const body = new FormData();
          body.set("file", photo.file);
          const response = await fetch(`/api/pekerjaan/${workId}/photos`, {
            method: "POST",
            body,
          });
          const data = (await response.json()) as {
            ok?: boolean;
            message?: string;
          };
          if (!response.ok) {
            failed.push(photo);
            if (!firstError) {
              firstError = data.message ?? "Gagal mengunggah foto.";
            }
            continue;
          }
          success += 1;
        } catch {
          failed.push(photo);
          if (!firstError) {
            firstError = "Gagal mengunggah foto. Periksa koneksi.";
          }
        }
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
      onUploadingChange?.(false);
    }

    for (const photo of snapshot) {
      if (!failed.some((item) => item.id === photo.id)) {
        URL.revokeObjectURL(photo.preview);
      }
    }
    replaceQueue(failed);
    if (success > 0) {
      toast.success(
        success === 1
          ? "Foto dokumentasi ditambahkan."
          : `${success} foto dokumentasi ditambahkan.`,
      );
      onChanged();
    }
    if (failed.length > 0) {
      setError(
        `${failed.length} foto gagal diunggah. ${firstError} Kamu dapat mencoba lagi tanpa memilih ulang.`,
      );
      toast.error(
        failed.length === 1
          ? "Satu foto gagal diunggah."
          : `${failed.length} foto gagal diunggah.`,
      );
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `/api/pekerjaan/photos/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal menghapus foto.");
        return;
      }
      toast.success("Foto dokumentasi dihapus.");
      setDeleteTarget(null);
      setPreview(null);
      onChanged();
    } catch {
      toast.error("Gagal menghapus foto. Coba lagi.");
    } finally {
      setDeleting(false);
    }
  }

  function previewDescription(photo: ManualWorkPhoto) {
    return (
      <span className="flex flex-col gap-0.5">
        <span>
          {photo.takenAt
            ? photo.captureSource === "exif"
              ? `Diambil ${formatDateTime(photo.takenAt, "d MMM yyyy, HH:mm")} (EXIF kamera)`
              : `Waktu cap ${formatDateTime(photo.takenAt, "d MMM yyyy, HH:mm")} (jam perangkat)`
            : "Waktu ambil tidak tercatat (foto lama)"}
        </span>
        <span>
          Diunggah {formatDateTime(photo.createdAt, "d MMM yyyy, HH:mm")}
        </span>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setPreview(photo)}
            className="group relative size-16 overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={photo.caption || `Buka foto ${workTitle}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/pekerjaan/photos/${photo.id}`}
              alt={photo.caption || `Foto dokumentasi ${workTitle}`}
              loading="lazy"
              decoding="async"
              className="size-full object-cover group-hover:opacity-90"
            />
          </button>
        ))}

        {queue.map((photo) => (
          <div
            key={photo.id}
            className="flex w-16 flex-col gap-1"
            title={`${photo.timeLabel} ${formatDateTime(
              photo.takenAt,
              "d MMM yyyy, HH:mm",
            )}`}
          >
            <div className="relative">
              <div className="size-16 overflow-hidden rounded-md bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.preview}
                  alt={`Pratinjau foto ${workTitle}`}
                  className="size-full object-cover"
                />
              </div>
              <Button
                type="button"
                size="icon-xs"
                variant="secondary"
                className="absolute -right-1.5 -top-1.5"
                onClick={() => removeQueued(photo.id)}
                disabled={busy}
                aria-label="Hapus foto dari antrean"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <span className="truncate text-center text-xs text-muted-foreground">
              {photo.timeLabel}
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
              aria-label="Pilih beberapa foto dari galeri"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCameraOpen(true)}
              disabled={busy || atLimit}
              title={
                atLimit
                  ? `Maksimal ${MANUAL_WORK_MAX_PHOTOS} foto per pekerjaan.`
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
              disabled={busy || atLimit}
              title={
                atLimit
                  ? `Maksimal ${MANUAL_WORK_MAX_PHOTOS} foto per pekerjaan.`
                  : undefined
              }
            >
              <ImagePlus aria-hidden="true" />
              Galeri
            </Button>
          </>
        )}

        {photos.length === 0 && queue.length === 0 && !canUpload && (
          <span className="text-xs text-muted-foreground">Belum ada foto.</span>
        )}
      </div>

      {processing && processingLabel && (
        <p
          className="flex items-center gap-2 text-xs text-muted-foreground"
          role="status"
        >
          <Spinner />
          {processingLabel}
        </p>
      )}

      {uploading && uploadProgress && (
        <p
          className="flex items-center gap-2 text-xs text-muted-foreground"
          role="status"
        >
          <Spinner />
          Mengunggah {uploadProgress.current} dari {uploadProgress.total}…
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

      {queue.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={submitUpload}
            disabled={busy}
          >
            {uploading ? <Spinner /> : <UploadCloud aria-hidden="true" />}
            {uploading ? "Mengunggah…" : `Unggah ${queue.length} foto`}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearQueue}
            disabled={busy}
          >
            Bersihkan
          </Button>
          <span className="text-xs text-muted-foreground">
            Sisa {remainingSlots} slot foto.
          </span>
        </div>
      )}

      {atLimit && (
        <p className="text-xs text-muted-foreground">
          Batas {MANUAL_WORK_MAX_PHOTOS} foto tercapai.
        </p>
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Clock3 className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        Foto kamera memakai waktu tombol Ambil ditekan. Foto galeri memakai EXIF
        bila ada; jika tidak, waktu unggah dicetak dan ditandai &quot;Diunggah&quot;.
        Server menolak foto tanpa cap waktu SIBUMA.
      </p>

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.caption || "Foto dokumentasi"}
        description={preview ? previewDescription(preview) : undefined}
        size="lg"
        footer={
          preview && canDelete ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(preview)}
            >
              <Trash2 aria-hidden="true" />
              Hapus foto
            </Button>
          ) : undefined
        }
      >
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/pekerjaan/photos/${preview.id}`}
            alt={preview.caption || `Foto dokumentasi ${workTitle}`}
            className="max-h-[65vh] w-full object-contain"
          />
        )}
      </Modal>

      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={async (file, capturedAt) => {
          await addFiles([file], { cameraCapturedAt: capturedAt });
        }}
        disabled={atLimit || busy}
        disabledReason={
          atLimit
            ? `Batas ${MANUAL_WORK_MAX_PHOTOS} foto tercapai. Hapus foto lama terlebih dahulu.`
            : busy
              ? "Tunggu proses foto sebelumnya selesai."
              : undefined
        }
        title="Ambil foto pekerjaan"
        description={`${workTitle} · ${remainingSlots} slot tersisa`}
      />

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
              Foto akan dihapus dari pekerjaan dan penyimpanan privat. Tindakan
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
