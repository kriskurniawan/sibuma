"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImageOff, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useDialogHistory } from "@/hooks/use-dialog-history";
import { cn } from "@/lib/utils";
import type { NoteAttachment } from "@/lib/note-types";

function sizeLabel(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const SHELL =
  "w-36 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:w-44";

/**
 * Foto catatan dimuat terpisah agar kegagalan satu berkas tidak menjatuhkan
 * seluruh halaman detail. Pratinjau baru aktif setelah gambar benar-benar siap.
 */
export function NotePhoto({
  noteId,
  attachment,
  index,
  title,
}: {
  noteId: string;
  attachment: NoteAttachment;
  index: number;
  title: string;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const retry = attempt > 0 ? `&retry=${attempt}` : "";
  const mediaUrl = `/api/catatan/${encodeURIComponent(noteId)}/media?photo=${encodeURIComponent(attachment.id)}${retry}`;
  const photoLabel = `foto ${index + 1}: ${attachment.fileName}`;

  useDialogHistory(open, () => setOpen(false));

  // Gambar dari HTML server dapat selesai dimuat sebelum hidrasi, sehingga
  // event onLoad tidak selalu terpanggil. Sinkronkan status dari elemen asli.
  useEffect(() => {
    const image = imageRef.current;
    if (!image?.complete) return;
    setStatus(image.naturalWidth > 0 ? "ready" : "error");
  }, [attempt]);

  async function downloadPhoto() {
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(`${mediaUrl}&download=1`);
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
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success("Foto catatan diunduh.");
    } catch {
      toast.error("Gagal mengunduh foto. Periksa koneksi lalu coba lagi.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={cn(SHELL, "relative")}>
      <div className="group relative aspect-[4/3] w-full bg-muted">
        {status === "loading" && (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}

        {status === "error" ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-2 text-center">
            <ImageOff
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs text-muted-foreground">Foto gagal dimuat</p>
            <Button
              type="button"
              size="xs"
              variant="outline"
              aria-label={`Coba muat ulang ${photoLabel}`}
              onClick={() => {
                setStatus("loading");
                setAttempt((value) => value + 1);
              }}
            >
              <RotateCcw />
              Coba lagi
            </Button>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={attempt}
            ref={imageRef}
            src={mediaUrl}
            alt={`${title} — ${photoLabel}`}
            className={cn(
              "size-full object-cover group-hover:opacity-90",
              status === "loading" && "opacity-0",
            )}
            loading="lazy"
            decoding="async"
            onLoad={() => setStatus("ready")}
            onError={() => setStatus("error")}
          />
        )}

        {status === "ready" && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Buka ${photoLabel}`}
            className="absolute inset-0 cursor-zoom-in rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          />
        )}
      </div>

      <span className="flex min-w-0 items-center justify-between gap-2 px-2 py-1.5 text-xs text-muted-foreground">
        <span className="truncate">{attachment.fileName}</span>
        <span className="shrink-0 tabular-nums">
          {sizeLabel(attachment.sizeBytes)}
        </span>
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 z-[1000000000] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-black p-0 text-white ring-0 outline-none sm:max-w-none"
        >
          <div className="flex shrink-0 items-start gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <DialogTitle className="truncate text-sm text-white">
                {title}
              </DialogTitle>
              <DialogDescription className="truncate text-xs text-white/70">
                Pratinjau foto · {attachment.fileName} ·{" "}
                {sizeLabel(attachment.sizeBytes)}
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              disabled={downloading}
              onClick={() => {
                void downloadPhoto();
              }}
              aria-label={`Unduh ${photoLabel}`}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              {downloading ? <Spinner /> : <Download aria-hidden="true" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => setOpen(false)}
              aria-label={`Tutup pratinjau ${photoLabel}`}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          <div
            className="flex min-h-0 flex-1 items-center justify-center p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl}
              alt={`${title} — ${photoLabel}`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
