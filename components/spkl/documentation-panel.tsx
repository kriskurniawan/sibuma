"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Clock3,
  ImagePlus,
  MapPin,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/compress-image";
import { buildDocumentationMarker } from "@/lib/documentation-marker";
import { readImageExif } from "@/lib/exif";
import {
  formatDateHuman,
  formatTime,
} from "@/lib/time";
import type { Documentation, Employee, GeoPoint } from "@/lib/types";
import {
  documentSrc,
  fileSizeLabel,
} from "@/lib/utils";

type DocumentationWithEmployee = Documentation & {
  employee: Employee | null;
};

interface DocumentationPanelProps {
  spklId: string;
  spklTitle: string;
  spklNumber: string;
  documents: DocumentationWithEmployee[];
  canUpload: boolean;
  uploadBlockedReason?: string;
  maxUploads: number;
  remainingUploads: number;
  maxBytes: number;
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
  uploadBlockedReason,
  maxUploads,
  remainingUploads,
  maxBytes,
}: DocumentationPanelProps) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selected, setSelected] = useState<DocumentationWithEmployee | null>(
    null,
  );
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
            )} WIB`,
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
    if (description.trim().length < 3) {
      setError("Tambahkan deskripsi minimal 3 karakter.");
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

  const remainingSlots = Math.max(0, remainingUploads - queue.length);
  const exifLocationCount = queue.filter((photo) => photo.exifLocation).length;

  return (
    <Frame id="dokumentasi">
      <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <FrameTitle>Dokumentasi pekerjaan</FrameTitle>
          <FrameDescription className="text-xs">
            {documents.length} foto · terlihat oleh anggota dan atasan SPKL
          </FrameDescription>
        </div>
        {canUpload ? (
          <Button type="button" size="sm" onClick={openUpload}>
            <ImagePlus />
            Tambah foto
          </Button>
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
                ? "Ambil foto hasil pekerjaan dan tambahkan keterangan singkat. Foto akan tersimpan sebagai bukti."
                : "Foto pekerjaan dari anggota tim akan muncul di sini."
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
                onClick={() => setSelected(doc)}
              />
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
          Foto disimpan pada penyimpanan privat dan hanya dapat diakses pengguna
          yang terhubung dengan SPKL ini.
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
                      {formatTime(photo.capturedAt)} WIB
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
            <p className="text-xs leading-relaxed text-muted-foreground">
              JPG, PNG, atau WEBP, otomatis dikompresi hingga{" "}
              {fileSizeLabel(maxBytes)}. Foto kamera memakai waktu tombol ambil;
              foto galeri memakai EXIF bila tersedia, jika tidak waktu unggah
              dicetak dan ditandai &quot;Diunggah&quot;. Waktu unggah di server
              tetap disimpan terpisah untuk audit.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-description">Deskripsi pekerjaan</Label>
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
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Detail dokumentasi"
        description={selected ? selected.description : undefined}
        size="xl"
        footer={
          selected ? (
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
                    Waktu foto {formatDateHuman(selected.takenAt, "d MMM yyyy")} ·{" "}
                    {formatTime(selected.takenAt)} WIB
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Diunggah {formatDateHuman(selected.createdAt, "d MMM yyyy")} ·{" "}
                    {formatTime(selected.createdAt)} WIB
                  </p>
                </div>
              </div>
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
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-lg bg-muted">
              <img
                src={documentSrc(selected.storageKey)}
                alt={selected.description}
                className="max-h-[60vh] w-full object-contain"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">
                {fileSizeLabel(selected.sizeBytes)}
              </Badge>
              <Badge variant="outline">
                {selected.mimeType.replace("image/", "").toUpperCase()}
              </Badge>
              {selected.location && (
                <Badge variant="outline">
                  {selected.location.latitude.toFixed(5)},{" "}
                  {selected.location.longitude.toFixed(5)}
                </Badge>
              )}
            </div>
            <p className="rounded-md bg-muted/50 px-3.5 py-3 text-sm leading-relaxed text-foreground">
              {selected.description}
            </p>
          </div>
        )}
      </Modal>

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
