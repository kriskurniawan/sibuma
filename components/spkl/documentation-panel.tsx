"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  MapPin,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
  maxBytes: number;
}

async function compressImage(file: File, maxBytes: number) {
  if (file.size <= maxBytes && file.type === "image/jpeg") return file;
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1600;
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    let quality = 0.84;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!blob || blob.size <= maxBytes) break;
      quality -= 0.12;
    }

    if (!blob) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "dokumentasi";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      // Compression runs in an event handler, never during render.
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export function DocumentationPanel({
  spklId,
  spklTitle,
  spklNumber,
  documents,
  canUpload,
  uploadBlockedReason,
  maxUploads,
  maxBytes,
}: DocumentationPanelProps) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<DocumentationWithEmployee | null>(
    null,
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function resetUpload() {
    setFile(null);
    setDescription("");
    setLocation(null);
    setError(null);
    setUploading(false);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function openUpload() {
    resetUpload();
    setUploadOpen(true);
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

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    setError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(chosen.type)) {
      setError("Format foto harus JPG, PNG, atau WEBP.");
      return;
    }
    if (chosen.size > 12 * 1024 * 1024) {
      setError("Ukuran file asli maksimal 12 MB.");
      return;
    }
    const optimized = await compressImage(chosen, maxBytes);
    if (optimized.size > maxBytes) {
      setError(
        `Foto masih ${fileSizeLabel(optimized.size)} setelah dikompresi. Maksimal ${fileSizeLabel(maxBytes)}.`,
      );
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(optimized);
    setPreview(URL.createObjectURL(optimized));
  }

  async function submitUpload() {
    if (!file) {
      setError("Pilih foto terlebih dahulu.");
      return;
    }
    if (description.trim().length < 3) {
      setError("Tambahkan deskripsi minimal 3 karakter.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("description", description.trim());
      if (location) {
        formData.append("location", JSON.stringify(location));
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
        setError(data.message ?? "Gagal mengunggah dokumentasi.");
        return;
      }
      toast.success("Dokumentasi pekerjaan tersimpan.");
      setUploadOpen(false);
      resetUpload();
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi internetmu.");
    } finally {
      setUploading(false);
    }
  }

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
        dismissible={!uploading}
        footer={
          <div className="flex w-full gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUploadOpen(false);
                resetUpload();
              }}
              disabled={uploading}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={submitUpload}
              disabled={uploading || !file}
              className="flex-1"
            >
              {uploading ? (
                <>
                  <Spinner />
                  Mengunggah…
                </>
              ) : (
                <>
                  <UploadCloud />
                  Simpan foto
                </>
              )}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Foto pekerjaan</Label>
            {preview ? (
              <div className="relative overflow-hidden rounded-lg bg-muted">
                <img
                  src={preview}
                  alt="Pratinjau dokumentasi"
                  className="max-h-72 w-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (preview) URL.revokeObjectURL(preview);
                    setPreview(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-foreground/60 text-background backdrop-blur transition-colors hover:bg-foreground/80"
                  aria-label="Hapus foto"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/60"
              >
                <IconTile
                  variant="soft"
                  size="default"
                  className="text-primary"
                  aria-hidden="true"
                >
                  <Camera />
                </IconTile>
                <span className="text-sm font-semibold text-foreground">
                  Ambil atau pilih foto
                </span>
                <span className="text-xs text-muted-foreground">
                  JPG, PNG, atau WEBP · otomatis dikompresi hingga{" "}
                  {fileSizeLabel(maxBytes)}
                </span>
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
              className="hidden"
            />
            {file && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-success-foreground">
                <CheckCircle2 className="size-3.5" />
                {file.name} · {fileSizeLabel(file.size)}
              </p>
            )}
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
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">
                  Lokasi foto{" "}
                  <span className="font-normal text-muted-foreground">
                    (opsional)
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {locating
                    ? "Mengambil titik GPS…"
                    : location
                      ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                      : "Tidak dilampirkan"}
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
            Maksimal {maxUploads} foto per sesi. Unggahan ditutup setelah masa
            tenggang dokumentasi berakhir.
          </p>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Dokumentasi gagal disimpan</AlertTitle>
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
                    {formatDateHuman(selected.takenAt, "EEEE, d MMMM yyyy")} ·{" "}
                    {formatTime(selected.takenAt)} WIB
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
                      rel="noreferrer"
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
    </Frame>
  );
}
