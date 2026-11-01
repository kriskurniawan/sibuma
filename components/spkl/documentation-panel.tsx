"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Clock3,
  Download,
  ImagePlus,
  MapPin,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
import { EvidenceVideoUpload } from "@/components/evidence-video-upload";
import { Modal } from "@/components/modal";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { DocumentationCard } from "@/components/spkl/documentation-card";
import { Avatar, Badge, EmptyState } from "@/components/ui";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/compress-image";
import { buildDocumentationMarker } from "@/lib/documentation-marker";
import { readImageExif } from "@/lib/exif";
import {
  currentTimeZoneLabel,
  formatDateHuman,
  formatTime,
} from "@/lib/time";
import type { Documentation, Employee, GeoPoint } from "@/lib/types";
import {
  documentSrc,
  fileSizeLabel,
} from "@/lib/utils";
import { formatVideoDuration } from "@/lib/video";

type DocumentationWithEmployee = Documentation & {
  employee: Employee | null;
};

interface DocumentationPanelProps {
  spklId: string;
  spklTitle: string;
  spklNumber: string;
  documents: DocumentationWithEmployee[];
  canUpload: boolean;
  canDeleteDocuments: boolean;
  currentUserId: string;
  uploadBlockedReason?: string;
  maxUploads: number;
  remainingUploads: number;
  maxBytes: number;
  videoLimit: number;
  videoRemaining: number;
  videoMaxBytes: number;
  videoEnabled: boolean;
}

interface PendingDocumentation {
  id: string;
  file: File;
  preview: string;
  capturedAt: string;
  source: "exif" | "device";
  timeLabel: "Diambil" | "Diunggah";
  exifLocation: GeoPoint | null;
  error?: string;
}

export function DocumentationPanel({
  spklId,
  spklTitle,
  spklNumber,
  documents,
  canUpload,
  canDeleteDocuments,
  currentUserId,
  uploadBlockedReason,
  maxUploads,
  remainingUploads,
  maxBytes,
  videoLimit,
  videoRemaining,
  videoMaxBytes,
  videoEnabled,
}: DocumentationPanelProps) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selected, setSelected] = useState<DocumentationWithEmployee | null>(
    null,
  );
  const [photoOpen, setPhotoOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<DocumentationWithEmployee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [queue, setQueue] = useState<PendingDocumentation[]>([]);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<PendingDocumentation[]>([]);
  const nextIdRef = useRef(0);

  useEffect(() => {
    return () => {
      for (const photo of queueRef.current) {
        URL.revokeObjectURL(photo.preview);
      }
    };
  }, []);

  function nextPendingId() {
    nextIdRef.current += 1;
    return `photo-${nextIdRef.current}`;
  }

  function resetUpload() {
    for (const photo of queueRef.current) {
      URL.revokeObjectURL(photo.preview);
    }
    queueRef.current = [];
    setQueue([]);
    setDescription("");
    setLocation(null);
    setError(null);
    setNotice(null);
    setUploading(false);
    setProcessing(false);
    setProcessingLabel(null);
    setUploadProgress(null);
    setCameraOpen(false);
    if (galleryRef.current) galleryRef.current.value = "";
  }

  function refreshLocation() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  function openUpload() {
    resetUpload();
    setUploadOpen(true);
    refreshLocation();
  }

  function onGalleryChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    // Reset segera agar memilih file yang sama tetap memicu onChange.
    event.target.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    void addFiles(chosen);
  }

  async function addFiles(
    chosen: File[],
    options?: { cameraCapturedAt?: string },
  ) {
    if (uploading || processing) return;
    if (chosen.length === 0) return;

    const slots = Math.max(0, remainingUploads - queueRef.current.length);
    if (slots === 0) {
      setError(
        `Batas ${maxUploads} foto per sesi sudah tercapai. Selesaikan sesi lain atau hapus foto terlebih dahulu.`,
      );
      return;
    }

    const accepted = chosen.slice(0, slots);
    const notices: string[] = [];
    if (chosen.length > slots) {
      notices.push(
        `Hanya ${slots} foto lagi yang dapat ditambahkan pada sesi ini.`,
      );
    }

    setError(null);
    setNotice(null);
    setProcessing(true);
    const next: PendingDocumentation[] = [];
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
        if (file.size > 12 * 1024 * 1024) {
          notices.push(`${file.name}: ukuran asli maksimal 12 MB.`);
          continue;
        }

        // Foto kamera memakai waktu tombol ambil. Foto galeri memakai EXIF;
        // bila tidak ada, waktu unggah dipakai dan dicetak sebagai "Diunggah".
        const exif = options?.cameraCapturedAt
          ? null
          : await readImageExif(file);
        const capturedAt =
          options?.cameraCapturedAt ??
          exif?.takenAt ??
          new Date().toISOString();
        const source = exif?.takenAt ? "exif" : "device";
        const timeLabel =
          options?.cameraCapturedAt || exif?.takenAt ? "Diambil" : "Diunggah";
        if (!options?.cameraCapturedAt && !exif?.takenAt) deviceOnly += 1;
        const optimized = await compressImage(file, maxBytes, {
          fallbackName: "dokumentasi",
          lines: [
            `SIBUMA · ${spklNumber}`,
            `${timeLabel} ${formatDateHuman(
              capturedAt,
              "d MMM yyyy, HH.mm",
            )} ${currentTimeZoneLabel()}`,
          ],
          comment: buildDocumentationMarker({
            spklNumber,
            takenAt: capturedAt,
            source,
          }),
        });
        if (optimized === file) {
          notices.push(
            `${file.name}: cap waktu tidak dapat dicetak. Coba foto lain.`,
          );
          continue;
        }
        if (optimized.size > maxBytes) {
          notices.push(
            `${file.name}: masih ${fileSizeLabel(optimized.size)} setelah dikompresi (maksimal ${fileSizeLabel(maxBytes)}).`,
          );
          continue;
        }
        next.push({
          id: nextPendingId(),
          file: optimized,
          preview: URL.createObjectURL(optimized),
          capturedAt,
          source,
          timeLabel,
          exifLocation: exif?.location ?? null,
        });
      }
    } finally {
      setProcessing(false);
      setProcessingLabel(null);
    }

    if (next.length > 0) {
      queueRef.current = [...queueRef.current, ...next];
      setQueue(queueRef.current);
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

  function removePhoto(id: string) {
    const target = queueRef.current.find((photo) => photo.id === id);
    if (target) URL.revokeObjectURL(target.preview);
    queueRef.current = queueRef.current.filter((photo) => photo.id !== id);
    setQueue(queueRef.current);
    setError(null);
    setNotice(null);
  }

  async function submitUpload() {
    const snapshot = [...queueRef.current];
    if (snapshot.length === 0) {
      setError("Pilih minimal satu foto terlebih dahulu.");
      return;
    }
    if (snapshot.length > remainingUploads) {
      setError(
        `Hanya ${remainingUploads} foto lagi yang dapat diunggah pada sesi ini.`,
      );
      return;
    }

    const text = description.trim();
    setUploading(true);
    setError(null);
    setNotice(null);
    const failed: PendingDocumentation[] = [];
    let success = 0;
    let firstError = "";

    try {
      for (let index = 0; index < snapshot.length; index += 1) {
        const photo = snapshot[index];
        setUploadProgress({ current: index + 1, total: snapshot.length });
        try {
          const formData = new FormData();
          formData.append("file", photo.file);
          formData.append("description", text);
          const photoLocation = photo.exifLocation ?? location;
          if (photoLocation) {
            formData.append("location", JSON.stringify(photoLocation));
          }
          const response = await fetch(`/api/spkl/${spklId}/documents`, {
            method: "POST",
            body: formData,
          });
          const data = (await response.json()) as {
            ok: boolean;
            message?: string;
          };
          if (!response.ok || !data.ok) {
            if (!firstError) {
              firstError = data.message ?? "Gagal mengunggah dokumentasi.";
            }
            failed.push({
              ...photo,
              error: data.message ?? "Gagal mengunggah dokumentasi.",
            });
            continue;
          }
          success += 1;
          URL.revokeObjectURL(photo.preview);
        } catch {
          if (!firstError) {
            firstError = "Tidak dapat menghubungi server.";
          }
          failed.push({
            ...photo,
            error: "Tidak dapat menghubungi server. Periksa koneksi.",
          });
        }
      }
    } finally {
      queueRef.current = failed;
      setQueue(failed);
      setUploading(false);
      setUploadProgress(null);
    }

    if (failed.length === 0) {
      toast.success(
        success > 1
          ? `${success} dokumentasi pekerjaan tersimpan.`
          : "Dokumentasi pekerjaan tersimpan.",
      );
      setUploadOpen(false);
      resetUpload();
      router.refresh();
      return;
    }

    setError(
      `${success} dari ${snapshot.length} foto berhasil diunggah. ${firstError}`,
    );
    if (success > 0) router.refresh();
  }

  async function removeDocumentation() {
    if (!deleteTarget) return;
    const isVideo =
      deleteTarget.kind === "video" ||
      deleteTarget.mimeType.startsWith("video/");
    const label = isVideo ? "video" : "foto";
    setDeleting(true);
    try {
      const response = await fetch(
        `/api/spkl/${spklId}/documents/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        toast.error(data.message ?? `Gagal menghapus ${label}.`);
        return;
      }
      toast.success(
        isVideo ? "Video dokumentasi dihapus." : "Foto dokumentasi dihapus.",
      );
      setPhotoOpen(false);
      setSelected(null);
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error(`Gagal menghapus ${label}. Coba lagi.`);
    } finally {
      setDeleting(false);
    }
  }

  async function downloadPhoto() {
    if (!selectedPhoto || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(
        `${documentSrc(selectedPhoto.storageKey)}?download=1`,
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        toast.error(data?.message ?? "Gagal mengunduh foto.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = selectedPhoto.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success("Foto dokumentasi diunduh.");
    } catch {
      toast.error("Gagal mengunduh foto. Periksa koneksi.");
    } finally {
      setDownloading(false);
    }
  }

  const remainingSlots = Math.max(0, remainingUploads - queue.length);
  const exifLocationCount = queue.filter((photo) => photo.exifLocation).length;
  const photoItems = documents.filter((doc) => doc.kind !== "video");
  const videoItems = documents.filter((doc) => doc.kind === "video");
  const photoAtLimit = remainingUploads <= 0;
  const videoAvailable = videoEnabled && videoLimit > 0;
  const selectedIsVideo = Boolean(
    selected &&
      (selected.kind === "video" || selected.mimeType.startsWith("video/")),
  );
  const selectedPhoto = selected && !selectedIsVideo ? selected : null;
  const canDeleteSelected = Boolean(
    selected &&
      canDeleteDocuments &&
      selected.employeeId === currentUserId,
  );
  const deleteTargetIsVideo = Boolean(
    deleteTarget &&
      (deleteTarget.kind === "video" ||
        deleteTarget.mimeType.startsWith("video/")),
  );

  return (
    <Frame id="dokumentasi">
      <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <FrameTitle>Dokumentasi pekerjaan</FrameTitle>
          <FrameDescription className="text-xs">
            {photoItems.length} foto
            {videoEnabled && videoLimit > 0
              ? ` · ${videoItems.length} video`
              : ""}{" "}
            · terlihat oleh anggota dan atasan SPKL
          </FrameDescription>
        </div>
        {canUpload ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={openUpload}
              disabled={photoAtLimit}
              title={
                photoAtLimit
                  ? `Batas ${maxUploads} foto per sesi tercapai.`
                  : undefined
              }
            >
              <ImagePlus />
              Tambah foto
            </Button>
            {videoAvailable && (
              <EvidenceVideoUpload
                prepareUrl={`/api/spkl/${spklId}/documents/video/prepare`}
                completeUrl={`/api/spkl/${spklId}/documents/video/complete`}
                maxBytes={videoMaxBytes}
                captionMaxLength={600}
                disabled={videoRemaining <= 0}
                disabledReason={
                  videoRemaining <= 0
                    ? `Batas ${videoLimit} video per sesi tercapai.`
                    : undefined
                }
                onUploaded={() => router.refresh()}
              />
            )}
          </div>
        ) : (
          <Badge variant="outline">
            {uploadBlockedReason ?? "Unggahan tidak tersedia"}
          </Badge>
        )}
      </FrameHeader>

      <FramePanel className="flex flex-col gap-4">
        {documents.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="Belum ada dokumentasi"
            description={
              canUpload
                ? "Ambil foto hasil pekerjaan dan tambahkan keterangan singkat. Video dapat ditambahkan dari galeri sebagai bukti tambahan."
                : "Foto dan video pekerjaan dari anggota tim akan muncul di sini."
            }
            action={
              canUpload ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openUpload}
                >
                  <UploadCloud />
                  Unggah foto pertama
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {documents.map((doc) => (
              <DocumentationCard
                key={doc.id}
                doc={doc}
                employee={doc.employee}
                onClick={() => {
                  setSelected(doc);
                  setPhotoOpen(
                    doc.kind !== "video" && !doc.mimeType.startsWith("video/"),
                  );
                }}
              />
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
          Foto dan video disimpan pada penyimpanan privat dan hanya dapat
          diakses pengguna yang terhubung dengan SPKL ini.
        </div>
      </FramePanel>

      <Modal
        open={uploadOpen}
        onClose={() => {
          if (uploading) return;
          setUploadOpen(false);
          resetUpload();
        }}
        title="Tambah dokumentasi"
        description={`${spklNumber} · ${spklTitle}`}
        size="md"
        dismissible={!uploading && !processing}
        footer={
          <div className="flex w-full gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUploadOpen(false);
                resetUpload();
              }}
              disabled={uploading || processing}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={submitUpload}
              disabled={uploading || processing || queue.length === 0}
              className="flex-1"
            >
              {uploading ? (
                <>
                  <Spinner />
                  Mengunggah{" "}
                  {uploadProgress
                    ? `${uploadProgress.current}/${uploadProgress.total}`
                    : "…"}
                </>
              ) : (
                <>
                  <UploadCloud />
                  {queue.length > 1
                    ? `Simpan ${queue.length} foto`
                    : "Simpan foto"}
                </>
              )}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Foto pekerjaan</Label>
              <span className="text-xs text-muted-foreground">
                {queue.length} dipilih · sisa {remainingSlots} slot
              </span>
            </div>

            {queue.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {queue.map((photo) => (
                  <div key={photo.id} className="flex min-w-0 flex-col gap-1">
                    <div className="relative overflow-hidden rounded-md bg-muted">
                      <img
                        src={photo.preview}
                        alt="Pratinjau dokumentasi"
                        className="aspect-square w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(photo.id)}
                        disabled={uploading || processing}
                        className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-foreground/60 text-background backdrop-blur transition-colors hover:bg-foreground/80 disabled:opacity-50"
                        aria-label={`Hapus foto ${photo.file.name}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-medium tabular-nums text-foreground">
                      <Clock3 className="size-3" />
                      {formatTime(photo.capturedAt)} {currentTimeZoneLabel()}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {photo.timeLabel === "Diambil"
                        ? photo.source === "exif"
                          ? "Waktu kamera (EXIF)"
                          : "Waktu tombol kamera"
                        : "Waktu unggah"}
                    </span>
                    {photo.error && (
                      <span
                        className="line-clamp-2 text-xs text-destructive"
                        title={photo.error}
                      >
                        Gagal: {photo.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
                <IconTile
                  variant="soft"
                  size="default"
                  className="text-primary"
                  aria-hidden="true"
                >
                  <Camera />
                </IconTile>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-foreground">
                    Tambahkan foto pekerjaan
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Bisa beberapa foto sekaligus. Nomor SPKL dan waktu foto
                    tercetak otomatis.
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setCameraOpen(true)}
                disabled={
                  processing || uploading || remainingSlots === 0
                }
              >
                <Camera />
                Ambil foto
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => galleryRef.current?.click()}
                disabled={
                  processing || uploading || remainingSlots === 0
                }
              >
                <ImagePlus />
                Pilih dari galeri
              </Button>
            </div>

            <input
              ref={galleryRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={onGalleryChange}
              className="hidden"
            />
            {processing && (
              <p
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                role="status"
              >
                <Spinner />
                {processingLabel ?? "Mencetak cap waktu…"}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-description">
              Deskripsi pekerjaan{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </Label>
            <Textarea
              id="doc-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={600}
              rows={3}
              placeholder="Contoh: Rak A selesai dipindai, 3 selisih SKU sudah ditandai."
            />
            <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
              <span>Jelaskan hasil kerja yang terlihat pada foto.</span>
              <span className="shrink-0">{description.length}/600</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <MapPin className="size-4 shrink-0 text-primary" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-xs font-medium text-foreground">
                  Lokasi foto{" "}
                  <span className="font-normal text-muted-foreground">
                    (opsional)
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {locating
                    ? "Mengambil titik GPS…"
                    : exifLocationCount > 0
                      ? `${exifLocationCount} foto memakai GPS dari EXIF`
                      : location
                        ? "Memakai lokasi perangkat sebagai cadangan"
                        : "Foto tanpa GPS EXIF tidak akan punya lokasi"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {location
                    ? `Cadangan ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                    : "Lokasi cadangan belum diambil"}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setLocating(true);
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    setLocation({
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                    });
                    setLocating(false);
                  },
                  () => {
                    setLocating(false);
                    toast.error("Lokasi foto tidak dapat diambil.");
                  },
                  { enableHighAccuracy: true, timeout: 12_000 },
                );
              }}
              disabled={locating}
            >
              {locating ? <Spinner /> : <MapPin />}
              Ambil
            </Button>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Maksimal {maxUploads} foto per sesi, sisa {remainingSlots} slot. Satu
            deskripsi berlaku untuk semua foto pada unggahan ini. Unggahan
            ditutup setelah masa tenggang dokumentasi berakhir.
          </p>

          {notice && (
            <p
              className="text-xs leading-relaxed text-muted-foreground"
              role="status"
            >
              {notice}
            </p>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Terjadi kendala unggah</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </Modal>

      <Modal
        open={selectedIsVideo}
        onClose={() => setSelected(null)}
        title="Detail dokumentasi"
        description={selected?.description || undefined}
        size="xl"
        footer={
          selectedIsVideo && selected ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Avatar
                  name={selected.employee?.name ?? "Pekerja"}
                  seed={selected.employee?.id}
                  size="sm"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {selected.employee?.name ?? "Pekerja"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Diunggah {formatDateHuman(selected.createdAt, "d MMM yyyy")} ·{" "}
                    {formatTime(selected.createdAt)}{" "}
                    {currentTimeZoneLabel()}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selected.location && (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${selected.location.latitude}&mlon=${selected.location.longitude}#map=17/${selected.location.latitude}/${selected.location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <MapPin />
                    Buka lokasi
                  </Button>
                )}
                {canDeleteSelected && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    <Trash2 aria-hidden="true" />
                    Hapus video
                  </Button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {selectedIsVideo && selected && (
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-lg bg-muted">
              <video
                src={documentSrc(selected.storageKey)}
                controls
                playsInline
                preload="metadata"
                className="max-h-[60vh] w-full rounded-lg bg-black"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">
                {fileSizeLabel(selected.sizeBytes)}
              </Badge>
              <Badge variant="outline">
                {`Video · ${formatVideoDuration(selected.durationSeconds) ?? "durasi tidak tercatat"}`}
              </Badge>
              {selected.location && (
                <Badge variant="outline">
                  {selected.location.latitude.toFixed(5)},{" "}
                  {selected.location.longitude.toFixed(5)}
                </Badge>
              )}
            </div>
            {selected.description ? (
              <p className="rounded-md bg-muted/50 px-3.5 py-3 text-sm leading-relaxed text-foreground">
                {selected.description}
              </p>
            ) : (
              <p className="rounded-md bg-muted/50 px-3.5 py-3 text-sm italic leading-relaxed text-muted-foreground">
                Tanpa deskripsi
              </p>
            )}
          </div>
        )}
      </Modal>

      <Dialog
        open={photoOpen && Boolean(selectedPhoto)}
        onOpenChange={(open) => {
          if (!open) setPhotoOpen(false);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 z-[1000000000] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-black p-0 text-white ring-0 outline-none sm:max-w-none"
        >
          {selectedPhoto && (
            <>
              <div className="flex shrink-0 items-start gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <DialogTitle className="truncate text-sm text-white">
                    Dokumentasi pekerjaan
                  </DialogTitle>
                  <DialogDescription className="truncate text-xs text-white/70">
                    {selectedPhoto.employee?.name ?? "Pekerja"} ·{" "}
                    {formatDateHuman(
                      selectedPhoto.takenAt,
                      "d MMM yyyy, HH.mm",
                    )}
                  </DialogDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={downloadPhoto}
                  disabled={downloading}
                  aria-busy={downloading}
                  aria-label={
                    downloading
                      ? "Sedang mengunduh foto dokumentasi"
                      : "Unduh foto dokumentasi"
                  }
                >
                  {downloading ? (
                    <Spinner aria-label="Mengunduh foto" />
                  ) : (
                    <Download aria-hidden="true" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  onClick={() => setPhotoOpen(false)}
                  aria-label="Tutup pratinjau foto"
                  className="text-white hover:bg-white/10 hover:text-white"
                >
                  <X aria-hidden="true" />
                </Button>
              </div>

              <div
                className="flex min-h-0 flex-1 items-center justify-center p-2"
                onClick={(event) => {
                  if (event.target === event.currentTarget) setPhotoOpen(false);
                }}
              >
                <img
                  src={documentSrc(selectedPhoto.storageKey)}
                  alt={selectedPhoto.description || "Dokumentasi pekerjaan"}
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div className="shrink-0 border-t border-white/10 bg-black/80 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="flex flex-col gap-2">
                  <p
                    className={
                      selectedPhoto.description
                        ? "text-sm leading-relaxed text-white"
                        : "text-sm italic leading-relaxed text-white/60"
                    }
                  >
                    {selectedPhoto.description || "Tanpa deskripsi"}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
                    <span className="font-medium text-white">
                      {selectedPhoto.employee?.name ?? "Pekerja"}
                    </span>
                    <span>
                      Diambil{" "}
                      {formatDateHuman(
                        selectedPhoto.takenAt,
                        "d MMM yyyy, HH.mm",
                      )}{" "}
                      {currentTimeZoneLabel()}
                    </span>
                    <span>
                      Diunggah{" "}
                      {formatDateHuman(
                        selectedPhoto.createdAt,
                        "d MMM yyyy, HH.mm",
                      )}{" "}
                      {currentTimeZoneLabel()}
                    </span>
                    <span className="tabular-nums">
                      {fileSizeLabel(selectedPhoto.sizeBytes)}
                    </span>
                    <span>
                      {selectedPhoto.mimeType
                        .replace("image/", "")
                        .toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedPhoto.location && (
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        className="w-fit text-white hover:bg-white/10 hover:text-white"
                        render={
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${selectedPhoto.location.latitude}&mlon=${selectedPhoto.location.longitude}#map=17/${selectedPhoto.location.latitude}/${selectedPhoto.location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        <MapPin aria-hidden="true" />
                        {selectedPhoto.location.latitude.toFixed(5)},{" "}
                        {selectedPhoto.location.longitude.toFixed(5)} · Buka
                        lokasi
                      </Button>
                    )}
                    {canDeleteSelected && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-fit text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          setDeleteTarget(selectedPhoto);
                          setPhotoOpen(false);
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                        Hapus foto
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hapus {deleteTargetIsVideo ? "video" : "foto"} dokumentasi ini?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargetIsVideo ? "Video" : "Foto"} akan dihapus dari
              dokumentasi SPKL dan penyimpanan privat. Tindakan ini tidak dapat
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={removeDocumentation}
              disabled={deleting}
            >
              {deleting
                ? "Menghapus…"
                : `Hapus ${deleteTargetIsVideo ? "video" : "foto"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={async (file, capturedAt) => {
          await addFiles([file], { cameraCapturedAt: capturedAt });
        }}
        disabled={processing || uploading || remainingSlots === 0}
        disabledReason={
          remainingSlots === 0
            ? `Batas ${maxUploads} foto per sesi sudah tercapai.`
            : processing || uploading
              ? "Tunggu proses foto sebelumnya selesai."
              : undefined
        }
        title="Ambil dokumentasi"
        description={`${spklNumber} · ${spklTitle}`}
      />
    </Frame>
  );
}
