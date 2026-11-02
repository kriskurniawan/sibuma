"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ImagePlus, PencilLine, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/compress-image";
import {
  NOTE_MAX_PHOTOS,
  NOTE_MAX_TOTAL_BYTES,
  UPLOAD_MAX_BYTES,
} from "@/lib/constants";
import type { NoteAttachment } from "@/lib/note-types";
import { cn } from "@/lib/utils";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

interface DraftPhoto {
  file: File;
  url: string;
}

function mediaUrl(noteId: string, attachmentId: string) {
  return `/api/catatan/${encodeURIComponent(noteId)}/media?photo=${encodeURIComponent(attachmentId)}`;
}

function EditPhoto({
  src,
  name,
  index,
  retryable,
  isNew,
  disabled,
  onRemove,
}: {
  src: string;
  name: string;
  index: number;
  retryable: boolean;
  isNew: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const retrySrc =
    retryable && attempt > 0 ? `${src}&retry=${attempt}` : src;
  const photoLabel = `foto ${index}: ${name}`;

  return (
    <div className="relative overflow-hidden rounded-md border border-border">
      <div className="relative aspect-[4/3] w-full bg-muted">
        {status === "loading" && (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}

        {status === "error" ? (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 px-2 text-center">
            <p className="text-xs text-muted-foreground">Foto gagal dimuat</p>
            {retryable && (
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  setStatus("loading");
                  setAttempt((value) => value + 1);
                }}
              >
                Coba lagi
              </Button>
            )}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={attempt}
            src={retrySrc}
            alt={`Pratinjau ${photoLabel}`}
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

        <Button
          type="button"
          size="icon-xs"
          variant="destructive"
          className="absolute right-1.5 top-1.5"
          aria-label={`Hapus ${photoLabel}`}
          onClick={onRemove}
          disabled={disabled}
        >
          <X />
        </Button>

        {isNew && (
          <Badge variant="info-light" className="absolute bottom-1.5 left-1.5">
            Baru
          </Badge>
        )}
      </div>

      <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground">
        {name}
      </span>
    </div>
  );
}

export function NoteEdit({
  noteId,
  initialTitle,
  initialBody,
  initialAttachments,
  updatedAt,
}: {
  noteId: string;
  initialTitle: string;
  initialBody: string;
  initialAttachments: NoteAttachment[];
  updatedAt: string;
}) {
  const router = useRouter();
  const formId = `note-edit-${useId().replaceAll(":", "")}`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [kept, setKept] = useState<NoteAttachment[]>(initialAttachments);
  const keptRef = useRef<NoteAttachment[]>(initialAttachments);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const photosRef = useRef<DraftPhoto[]>([]);
  const draftTokenRef = useRef(0);
  const pickQueueRef = useRef<Promise<void>>(Promise.resolve());
  const taskCounterRef = useRef(0);
  const activeTasksRef = useRef<Set<number>>(new Set());
  const [processingTasks, setProcessingTasks] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const photoProcessing = processingTasks.size > 0;

  useEffect(
    () => () => {
      draftTokenRef.current += 1;
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.url);
    },
    [],
  );

  const keptIds = new Set(kept.map((attachment) => attachment.id));
  const photosUnchanged =
    kept.length === initialAttachments.length &&
    initialAttachments.every((attachment) => keptIds.has(attachment.id));
  const unchanged =
    title.trim() === initialTitle.trim() &&
    body.trim() === initialBody.trim() &&
    photosUnchanged &&
    photos.length === 0;
  const disabled =
    submitting ||
    photoProcessing ||
    unchanged ||
    !title.trim() ||
    !body.trim();

  const photoCount = kept.length + photos.length;
  const totalBytes =
    kept.reduce((sum, attachment) => sum + attachment.sizeBytes, 0) +
    photos.reduce((sum, photo) => sum + photo.file.size, 0);

  function commitKept(next: NoteAttachment[]) {
    keptRef.current = next;
    setKept(next);
  }

  function commitPhotos(next: DraftPhoto[]) {
    photosRef.current = next;
    setPhotos(next);
  }

  function beginTask() {
    const id = taskCounterRef.current + 1;
    taskCounterRef.current = id;
    activeTasksRef.current.add(id);
    setProcessingTasks((current) => new Set(current).add(id));
    return id;
  }

  function endTask(id: number) {
    activeTasksRef.current.delete(id);
    setProcessingTasks((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function resetDraft() {
    draftTokenRef.current += 1;
    setTitle(initialTitle);
    setBody(initialBody);
    commitKept(initialAttachments);
    for (const photo of photosRef.current) URL.revokeObjectURL(photo.url);
    commitPhotos([]);
    activeTasksRef.current.clear();
    setProcessingTasks(new Set());
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openEditor() {
    resetDraft();
    setOpen(true);
  }

  function close() {
    if (submitting) return;
    setOpen(false);
    resetDraft();
  }

  function removeKept(attachmentId: string) {
    commitKept(
      keptRef.current.filter((attachment) => attachment.id !== attachmentId),
    );
  }

  function removePhoto(index: number) {
    const current = photosRef.current;
    const photo = current[index];
    if (photo) URL.revokeObjectURL(photo.url);
    commitPhotos(current.filter((_, position) => position !== index));
  }

  async function processPhotos(files: File[], token: number) {
    for (const file of files) {
      if (token !== draftTokenRef.current) return;
      if (
        keptRef.current.length + photosRef.current.length >=
        NOTE_MAX_PHOTOS
      ) {
        toast.error(`Maksimal ${NOTE_MAX_PHOTOS} foto per catatan.`);
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name}: pilih berkas JPG, PNG, atau WEBP.`);
        continue;
      }
      if (file.size > MAX_SOURCE_BYTES) {
        toast.error(`${file.name}: ukuran asli maksimal 12 MB.`);
        continue;
      }

      const optimized = await compressImage(file, UPLOAD_MAX_BYTES);
      if (token !== draftTokenRef.current) return;
      if (optimized.size > UPLOAD_MAX_BYTES) {
        toast.error(
          `${optimized.name}: masih melebihi ${(UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(1)} MB setelah dikompres.`,
        );
        continue;
      }

      // Baca ulang ref tepat sebelum menambah agar dua pemilihan yang
      // bertumpuk tidak dapat melewati batas jumlah maupun total ukuran.
      const currentKept = keptRef.current;
      const currentPhotos = photosRef.current;
      if (currentKept.length + currentPhotos.length >= NOTE_MAX_PHOTOS) {
        toast.error(`Maksimal ${NOTE_MAX_PHOTOS} foto per catatan.`);
        return;
      }
      const currentTotal =
        currentKept.reduce(
          (sum, attachment) => sum + attachment.sizeBytes,
          0,
        ) +
        currentPhotos.reduce((sum, photo) => sum + photo.file.size, 0);
      if (currentTotal + optimized.size > NOTE_MAX_TOTAL_BYTES) {
        toast.error(
          `Total foto maksimal ${(NOTE_MAX_TOTAL_BYTES / 1024 / 1024).toFixed(0)} MB.`,
        );
        return;
      }

      commitPhotos([
        ...currentPhotos,
        { file: optimized, url: URL.createObjectURL(optimized) },
      ]);
    }
  }

  function pickPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const selected = [...files];
    if (fileInputRef.current) fileInputRef.current.value = "";

    const token = draftTokenRef.current;
    const taskId = beginTask();
    const task = pickQueueRef.current
      .then(() => processPhotos(selected, token))
      .catch((processingError) => {
        console.error("Gagal memproses foto catatan:", processingError);
        toast.error("Foto gagal diproses. Coba pilih lagi.");
      })
      .finally(() => endTask(taskId));
    pickQueueRef.current = task;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    if (activeTasksRef.current.size > 0) {
      setError("Tunggu sampai foto selesai diproses, lalu simpan lagi.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("body", body.trim());
      form.set("expectedUpdatedAt", updatedAt);
      form.set(
        "keepAttachmentIds",
        JSON.stringify(keptRef.current.map((attachment) => attachment.id)),
      );
      for (const photo of photosRef.current) {
        form.append("photo", photo.file, photo.file.name || "catatan.jpg");
      }

      const response = await fetch(`/api/catatan/${noteId}`, {
        method: "PATCH",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        if (response.status === 409) {
          router.refresh();
        }
        throw new Error(payload?.message ?? "Catatan gagal diubah.");
      }

      toast.success("Catatan diperbarui.");
      setOpen(false);
      resetDraft();
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Catatan gagal diubah. Coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={openEditor}
      >
        <PencilLine aria-hidden="true" />
        Edit catatan
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Ubah catatan"
        description="Perbarui judul, isi, dan foto catatan. Penerima tidak berubah."
        size="md"
        dismissible={!submitting}
        mobileSheet
        stickyFooter
        footer={
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={close}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              form={formId}
              disabled={disabled}
            >
              {submitting ? <Spinner /> : <PencilLine aria-hidden="true" />}
              {submitting ? "Menyimpan…" : "Simpan perubahan"}
            </Button>
          </>
        }
      >
        <form id={formId} className="flex flex-col gap-4" onSubmit={submit}>
          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Catatan belum tersimpan</AlertTitle>
              <AlertDescription className="break-words">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <fieldset
            disabled={submitting}
            className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-title`}>Judul</Label>
              <Input
                id={`${formId}-title`}
                value={title}
                maxLength={160}
                required
                autoComplete="off"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-body`}>Isi catatan</Label>
              <Textarea
                id={`${formId}-body`}
                value={body}
                maxLength={2_000}
                rows={6}
                required
                onChange={(event) => setBody(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {body.length}/2.000 karakter
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-photo`}>
                Foto (opsional, maks. {NOTE_MAX_PHOTOS})
              </Label>
              <Input
                id={`${formId}-photo`}
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={submitting || photoCount >= NOTE_MAX_PHOTOS}
                onChange={(event) => pickPhotos(event.target.files)}
              />
              <p className="text-xs text-muted-foreground">
                {photoProcessing
                  ? "Mengompres foto…"
                  : photoCount >= NOTE_MAX_PHOTOS
                    ? `${NOTE_MAX_PHOTOS} foto dipilih — hapus salah satu untuk menambahkan yang lain.`
                    : `JPG, PNG, atau WEBP. Tiap foto dikompres hingga maksimal 1,5 MB; total ${(NOTE_MAX_TOTAL_BYTES / 1024 / 1024).toFixed(0)} MB.`}
              </p>
              {photoProcessing && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Spinner />
                  Foto sedang diproses. Tombol simpan aktif setelah selesai.
                </p>
              )}
              {photoCount > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {kept.map((attachment, index) => (
                    <EditPhoto
                      key={attachment.id}
                      src={mediaUrl(noteId, attachment.id)}
                      name={attachment.fileName}
                      index={index + 1}
                      retryable
                      isNew={false}
                      disabled={submitting}
                      onRemove={() => removeKept(attachment.id)}
                    />
                  ))}
                  {photos.map((photo, index) => (
                    <EditPhoto
                      key={photo.url}
                      src={photo.url}
                      name={photo.file.name}
                      index={kept.length + index + 1}
                      retryable={false}
                      isNew
                      disabled={submitting}
                      onRemove={() => removePhoto(index)}
                    />
                  ))}
                </div>
              )}
              {photoCount > 0 && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {photoCount}/{NOTE_MAX_PHOTOS} foto ·{" "}
                  {Math.max(1, Math.round(totalBytes / 1024))} KB
                </p>
              )}
            </div>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ImagePlus
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              Foto yang dihapus akan dibersihkan dari penyimpanan setelah
              catatan tersimpan.
            </p>
          </fieldset>
        </form>
      </Modal>
    </>
  );
}
