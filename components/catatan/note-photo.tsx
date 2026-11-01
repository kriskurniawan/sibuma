"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { NoteAttachment } from "@/lib/note-types";

function sizeLabel(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const SHELL =
  "w-36 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:w-44";

/**
 * Foto catatan dimuat terpisah agar kegagalan satu berkas tidak menjatuhkan
 * seluruh halaman detail. Tautan baru aktif setelah gambar benar-benar siap.
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
  const [attempt, setAttempt] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const retry = attempt > 0 ? `&retry=${attempt}` : "";
  const mediaUrl = `/api/catatan/${encodeURIComponent(noteId)}/media?photo=${encodeURIComponent(attachment.id)}${retry}`;
  const photoLabel = `foto ${index + 1}: ${attachment.fileName}`;

  // Gambar dari HTML server dapat selesai dimuat sebelum hidrasi, sehingga
  // event onLoad tidak selalu terpanggil. Sinkronkan status dari elemen asli.
  useEffect(() => {
    const image = imageRef.current;
    if (!image?.complete) return;
    setStatus(image.naturalWidth > 0 ? "ready" : "error");
  }, [attempt]);

  return (
    <div className={cn(SHELL, "relative")}>
      <div className="relative aspect-[4/3] w-full bg-muted">
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
              "size-full object-cover",
              status === "loading" && "opacity-0",
            )}
            loading="lazy"
            decoding="async"
            onLoad={() => setStatus("ready")}
            onError={() => setStatus("error")}
          />
        )}
      </div>

      <span className="flex min-w-0 items-center justify-between gap-2 px-2 py-1.5 text-xs text-muted-foreground">
        <span className="truncate">{attachment.fileName}</span>
        <span className="shrink-0 tabular-nums">
          {sizeLabel(attachment.sizeBytes)}
        </span>
      </span>

      {status === "ready" && (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Buka ${photoLabel}`}
          className="absolute inset-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        />
      )}
    </div>
  );
}
