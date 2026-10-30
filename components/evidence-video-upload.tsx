"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { Film, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Alert, AlertDescription } from "@/components/reui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ProgressBar } from "@/components/ui";
import { formatVideoDuration, isVideoMime, VIDEO_ACCEPT } from "@/lib/video";

interface PendingVideo {
  file: File;
  preview: string;
  durationSeconds: number | null;
}

interface UploadTarget {
  [key: string]: string | undefined;
}

function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      resolve(value);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      finish(
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.round(video.duration)
          : null,
      );
    video.onerror = () => finish(null);
    // Metadata yang tidak pernah termuat tidak boleh menahan dialog selamanya.
    timer = setTimeout(() => finish(null), 8_000);
    video.src = url;
  });
}

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(
          new Error(
            "Unggahan video ke penyimpanan ditolak. Coba lagi atau pilih video lain.",
          ),
        );
      }
    };
    request.onerror = () =>
      reject(new Error("Koneksi ke penyimpanan terputus. Periksa jaringan."));
    request.onabort = () => reject(new Error("Unggahan video dibatalkan."));
    request.send(file);
  });
}

async function readMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Video dokumentasi hanya dipilih dari galeri perangkat, tidak direkam
 * aplikasi. Byte dikirim langsung ke object storage lewat URL bertanda tangan;
 * server hanya menerbitkan URL dan memverifikasi objek setelah selesai.
 */
export function EvidenceVideoUpload({
  prepareUrl,
  completeUrl,
  target = {},
  maxBytes,
  captionMaxLength = 300,
  captionRequired = false,
  disabled = false,
  disabledReason,
  onUploaded,
  buttonLabel = "Video",
  title = "Tambah video dokumentasi",
  description = "Pilih video dari galeri perangkat.",
}: {
  prepareUrl: string;
  completeUrl: string;
  target?: UploadTarget;
  maxBytes: number;
  captionMaxLength?: number;
  captionRequired?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onUploaded: (id?: string) => void;
  buttonLabel?: string;
  title?: string;
  description?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const captionId = useId();
  const [pending, setPending] = useState<PendingVideo | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    if (pending) URL.revokeObjectURL(pending.preview);
    setPending(null);
    setCaption("");
    setError(null);
    setProgress(0);
  }

  function close() {
    if (uploading) return;
    reset();
  }

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (!isVideoMime(file.type)) {
      toast.error("Format video harus MP4, WEBM, atau MOV.");
      return;
    }
    if (file.size <= 0) {
      toast.error("Berkas video kosong.");
      return;
    }
    if (file.size > maxBytes) {
      toast.error(
        `Ukuran video melebihi batas ${Math.round(maxBytes / 1024 / 1024)} MB.`,
      );
      return;
    }
    const durationSeconds = await readVideoDuration(file);
    setPending({
      file,
      preview: URL.createObjectURL(file),
      durationSeconds,
    });
    setCaption("");
    setProgress(0);
  }

  async function upload() {
    if (!pending || uploading) return;
    if (captionRequired && caption.trim().length < 3) {
      setError("Tambahkan keterangan minimal 3 karakter.");
      return;
    }
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const prepareResponse = await fetch(prepareUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: pending.file.name,
          mimeType: pending.file.type,
          sizeBytes: pending.file.size,
          ...target,
        }),
      });
      if (!prepareResponse.ok) {
        throw new Error(
          await readMessage(
            prepareResponse,
            "URL unggah video gagal dibuat. Coba lagi.",
          ),
        );
      }
      const prepared = (await prepareResponse.json()) as {
        upload?: {
          key?: string;
          url?: string;
          headers?: Record<string, string>;
        };
      };
      const upload = prepared.upload;
      if (!upload?.url || !upload.key) {
        throw new Error("URL unggah video tidak lengkap. Coba lagi.");
      }

      await putWithProgress(
        upload.url,
        pending.file,
        upload.headers?.["Content-Type"] ?? pending.file.type,
        setProgress,
      );

      const completeResponse = await fetch(completeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: upload.key,
          fileName: pending.file.name,
          mimeType: pending.file.type,
          sizeBytes: pending.file.size,
          durationSeconds: pending.durationSeconds,
          caption: caption.trim(),
          ...target,
        }),
      });
      if (!completeResponse.ok) {
        throw new Error(
          await readMessage(
            completeResponse,
            "Video gagal disimpan. Coba lagi.",
          ),
        );
      }
      const saved = (await completeResponse.json()) as {
        photo?: { id?: string };
        documentation?: { id?: string };
      };
      toast.success("Video dokumentasi tersimpan.");
      reset();
      onUploaded(saved.photo?.id ?? saved.documentation?.id);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Video gagal diunggah. Coba lagi.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="sr-only"
        onChange={choose}
        aria-label="Pilih video dari galeri"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
      >
        <Film aria-hidden="true" />
        {buttonLabel}
      </Button>

      <Modal
        open={pending !== null}
        onClose={close}
        title={title}
        description={description}
        size="lg"
        dismissible={!uploading}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {pending ? formatVideoDuration(pending.durationSeconds) ?? "" : ""}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={close}
                disabled={uploading}
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void upload()}
                disabled={uploading}
              >
                {uploading ? <Spinner /> : <UploadCloud aria-hidden="true" />}
                {uploading ? `Mengunggah ${progress}%` : "Unggah video"}
              </Button>
            </div>
          </div>
        }
      >
        {pending && (
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-lg bg-black">
              {/* Pratinjau lokal sebelum unggah; bukan aset publik. */}
              <video
                src={pending.preview}
                controls
                playsInline
                preload="metadata"
                className="max-h-[50vh] w-full"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="min-w-0 truncate">{pending.file.name}</span>
              <span className="tabular-nums">
                {(pending.file.size / 1024 / 1024).toFixed(1)} /{" "}
                {Math.round(maxBytes / 1024 / 1024)} MB
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={captionId}>
                Keterangan{" "}
                {!captionRequired && (
                  <span className="font-normal text-muted-foreground">
                    (opsional)
                  </span>
                )}
              </Label>
              <Textarea
                id={captionId}
                value={caption}
                maxLength={captionMaxLength}
                rows={3}
                placeholder="Contoh: Pemeriksaan rak setelah pemindahan selesai."
                onChange={(event) => setCaption(event.target.value)}
                disabled={uploading}
              />
              <span className="self-end text-xs text-muted-foreground tabular-nums">
                {caption.length}/{captionMaxLength}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Video dipilih dari galeri dan tidak memiliki cap waktu di dalam
              berkas. Waktu unggah server dicatat terpisah.
            </p>
            {uploading && <ProgressBar value={progress} max={100} />}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
