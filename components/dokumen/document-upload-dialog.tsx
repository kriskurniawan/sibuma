"use client";

import { useMemo, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { FolderUp, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { DocumentFileIcon } from "@/components/dokumen/document-file-icon";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  formatDocumentBytes,
  isWorkDocumentVideo,
  WORK_DOCUMENT_ACCEPT,
  type WorkDocumentFolder,
  type WorkDocumentSettings,
} from "@/lib/work-document-types";

interface QueueItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

const MAX_FILES = 10;
const NO_FOLDER = "none";

export function DocumentUploadDialog({
  settings,
  usedBytes,
  folders,
  currentFolderId,
}: {
  settings: WorkDocumentSettings;
  usedBytes: number;
  folders: WorkDocumentFolder[];
  currentFolderId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [folderId, setFolderId] = useState<string>(
    currentFolderId ?? NO_FOLDER,
  );
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const pending = items.filter((item) => item.status !== "done");
  const quotaFull = usedBytes >= settings.quotaBytes;
  const uploadDisabled = !settings.uploadsEnabled || quotaFull;
  const totalBytes = useMemo(
    () => items.reduce((sum, item) => sum + item.file.size, 0),
    [items],
  );

  const folderItems = [
    { value: NO_FOLDER, label: "Tanpa folder" },
    ...folders.map((folder) => ({ value: folder.id, label: folder.name })),
  ];

  function reset() {
    setItems([]);
    setError(null);
    setFolderId(currentFolderId ?? NO_FOLDER);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    reset();
  }

  function addFiles(list: FileList | File[] | null) {
    const incoming = Array.from(list ?? []);
    if (incoming.length === 0) return;
    const accepted: QueueItem[] = [];
    const messages: string[] = [];
    const allowed = settings.allowedExtensions as string[];

    for (const file of incoming) {
      const extension = (file.name.split(".").pop() ?? "").toLowerCase();
      if (!extension || !allowed.includes(extension)) {
        messages.push(`${file.name}: jenis berkas tidak diizinkan.`);
        continue;
      }
      const video = isWorkDocumentVideo(extension);
      const limit = video ? settings.maxVideoBytes : settings.maxFileBytes;
      if (file.size > limit) {
        messages.push(
          `${file.name}: ${video ? "video" : "berkas"} melebihi ${formatDocumentBytes(limit)}.`,
        );
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        status: "pending",
        progress: 0,
      });
    }

    setItems((current) => [...current, ...accepted].slice(0, MAX_FILES));
    if (incoming.length > MAX_FILES) {
      messages.push(`Maksimal ${MAX_FILES} berkas sekali unggah.`);
    }
    if (messages.length > 0) setError(messages.slice(0, 4).join(" "));
    else setError(null);
    if (accepted.length > 0 && items.length + accepted.length > MAX_FILES) {
      toast.warning(`Hanya ${MAX_FILES} berkas pertama yang disimpan di antrean.`);
    }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    addFiles(event.dataTransfer.files);
  }

  function updateItem(id: string, patch: Partial<QueueItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  async function submit() {
    const queue = items.filter((item) => item.status !== "done");
    if (queue.length === 0 || busy) return;

    if (usedBytes + totalBytes > settings.quotaBytes) {
      setError(
        `Kuota tidak cukup. Berkas terpilih ${formatDocumentBytes(totalBytes)}, sisa kuota ${formatDocumentBytes(Math.max(0, settings.quotaBytes - usedBytes))}.`,
      );
      return;
    }

    setBusy(true);
    setError(null);
    let uploaded = 0;

    for (const item of queue) {
      const extension = (item.file.name.split(".").pop() ?? "").toLowerCase();
      const video = isWorkDocumentVideo(extension);
      updateItem(item.id, { status: "uploading", progress: 0, error: undefined });
      try {
        const prepareResponse = await fetch("/api/dokumen/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: item.file.name,
            sizeBytes: item.file.size,
          }),
        });
        const prepared = (await prepareResponse.json().catch(() => null)) as {
          message?: string;
          upload?: {
            key: string;
            url: string;
            headers: Record<string, string>;
          };
        } | null;
        if (!prepareResponse.ok || !prepared?.upload) {
          throw new Error(
            prepared?.message ?? "Persiapan unggahan dokumen gagal.",
          );
        }

        // Video 100 MB tidak di-hash di perangkat; server memakai ETag objek.
        const checksum = video ? undefined : await sha256Hex(item.file);
        await putFile(
          prepared.upload.url,
          item.file,
          prepared.upload.headers["Content-Type"] ?? item.file.type,
          (percent) => updateItem(item.id, { progress: percent }),
        );

        const completeResponse = await fetch("/api/dokumen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: prepared.upload.key,
            fileName: item.file.name,
            sizeBytes: item.file.size,
            checksumSha256: checksum,
            folderId: folderId === NO_FOLDER ? null : folderId,
          }),
        });
        const completed = (await completeResponse.json().catch(() => null)) as {
          message?: string;
        } | null;
        if (!completeResponse.ok) {
          throw new Error(completed?.message ?? "Dokumen gagal disimpan.");
        }

        uploaded += 1;
        updateItem(item.id, { status: "done", progress: 100 });
      } catch (uploadError) {
        updateItem(item.id, {
          status: "error",
          error:
            uploadError instanceof Error
              ? uploadError.message
              : "Dokumen gagal diunggah.",
        });
      }
    }

    setBusy(false);
    if (uploaded > 0) {
      toast.success(
        uploaded === 1
          ? "Dokumen kerja diunggah."
          : `${uploaded} dokumen kerja diunggah.`,
      );
      router.refresh();
    }
    setItems((current) => current.filter((item) => item.status !== "done"));
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        disabled={uploadDisabled}
        title={
          !settings.uploadsEnabled
            ? "Unggahan dinonaktifkan oleh super admin."
            : quotaFull
              ? "Kuota dokumen penuh. Hapus dokumen lama atau kosongkan sampah."
              : undefined
        }
      >
        <UploadCloud aria-hidden="true" />
        Unggah dokumen
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Unggah dokumen kerja"
        description="Berkas privat; hanya kamu dan penerima berbagi folder yang dapat membukanya."
        size="md"
        dismissible={!busy}
        footer={
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={close}
              disabled={busy}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={pending.length === 0 || busy}
            >
              {busy ? <Spinner /> : <UploadCloud aria-hidden="true" />}
              {busy
                ? "Mengunggah…"
                : pending.length > 1
                  ? `Unggah ${pending.length} berkas`
                  : "Unggah"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="document-folder"
              className="text-sm font-medium text-foreground"
            >
              Folder tujuan
            </label>
            <Select
              value={folderId}
              onValueChange={(value) => setFolderId(value as string)}
              items={folderItems}
            >
              <SelectTrigger id="document-folder" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {folderItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Nama dan deskripsi folder mewakili seluruh berkas di dalamnya.
            </p>
          </div>

          <div
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors",
              dragging && "border-primary bg-primary/5",
            )}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragging(false);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
              <FolderUp aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-foreground">
                Tarik berkas ke sini
              </p>
              <p className="text-xs text-muted-foreground">
                Maksimal {MAX_FILES} berkas · dokumen{" "}
                {formatDocumentBytes(settings.maxFileBytes)}, video{" "}
                {formatDocumentBytes(settings.maxVideoBytes)}
              </p>
            </div>
            <label className="inline-flex">
              <span className="sr-only">Pilih berkas dokumen kerja</span>
              <input
                type="file"
                multiple
                accept={WORK_DOCUMENT_ACCEPT}
                disabled={busy}
                className="sr-only"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted">
                Pilih berkas
              </span>
            </label>
          </div>

          {items.length > 0 && (
            <ul className="flex flex-col divide-y divide-border/70 rounded-lg border border-border">
              {items.map((item) => {
                const extension = (
                  item.file.name.split(".").pop() ?? ""
                ).toLowerCase();
                return (
                  <li key={item.id} className="flex items-start gap-3 p-3">
                    <DocumentFileIcon extension={extension} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-sm font-medium text-foreground">
                        {item.file.name}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDocumentBytes(item.file.size)} ·{" "}
                        {extension.toUpperCase()}
                        {item.status === "uploading" && ` · ${item.progress}%`}
                      </span>
                      {item.error && (
                        <span className="text-xs font-medium text-destructive">
                          {item.error}
                        </span>
                      )}
                    </div>
                    {item.status === "done" ? (
                      <Badge variant="success-light">Selesai</Badge>
                    ) : (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Hapus ${item.file.name} dari antrean`}
                        disabled={busy}
                        onClick={() =>
                          setItems((current) =>
                            current.filter((entry) => entry.id !== item.id),
                          )
                        }
                      >
                        <X aria-hidden="true" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive"
            >
              {error}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Sampah dokumen dihapus permanen setelah{" "}
            {settings.trashRetentionDays} hari. Kuota terpakai{" "}
            {formatDocumentBytes(usedBytes)} dari{" "}
            {formatDocumentBytes(settings.quotaBytes)}.
          </p>
        </div>
      </Modal>
    </>
  );
}

async function sha256Hex(file: File) {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Browser ini tidak mendukung pemeriksaan berkas. Gunakan browser terbaru.",
    );
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Berkas dikirim langsung ke object storage memakai URL bertanda tangan.
 * XHR dipakai agar progres unggahan besar tetap terlihat.
 */
function putFile(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    if (contentType) request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(
        Math.min(100, Math.round((event.loaded / event.total) * 100)),
      );
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Penyimpanan menolak berkas (${request.status}). Silakan coba lagi.`,
        ),
      );
    };
    request.onerror = () => {
      reject(
        new Error(
          "Berkas tidak dapat dikirim ke penyimpanan. Periksa koneksi lalu coba lagi.",
        ),
      );
    };
    request.onabort = () => reject(new Error("Unggahan dibatalkan."));
    request.send(file);
  });
}
