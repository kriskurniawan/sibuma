"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ImagePlus, PenLine, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/compress-image";
import {
  NOTE_MAX_DIVISIONS,
  NOTE_MAX_EMPLOYEES,
  NOTE_MAX_PHOTOS,
  NOTE_MAX_TOTAL_BYTES,
  UPLOAD_MAX_BYTES,
} from "@/lib/constants";
import type { NoteAudience, NoteOptions } from "@/lib/note-types";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

interface DraftPhoto {
  file: File;
  url: string;
}

function newRequestId() {
  return crypto.randomUUID();
}

export function NoteComposer({
  options,
  label = "Tulis catatan",
}: {
  options: NoteOptions;
  label?: string;
}) {
  const router = useRouter();
  const formId = `note-form-${useId().replaceAll(":", "")}`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const myDivision = options.divisions.find(
    (division) => division.id === options.myDivisionId,
  );
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientRequestId, setClientRequestId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] =
    useState<NoteAudience>("division");
  const [divisionIds, setDivisionIds] = useState<string[]>(
    myDivision ? [myDivision.id] : [],
  );
  const [divisionSearch, setDivisionSearch] = useState("");
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
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

  const divisionTerm = divisionSearch.trim().toLowerCase();
  const filteredDivisions = options.divisions.filter(
    (division) =>
      !divisionTerm || division.name.toLowerCase().includes(divisionTerm),
  );
  const crossDivision = divisionIds.length > 1;

  const search = employeeSearch.trim().toLowerCase();
  const filteredEmployees = options.employees.filter((employee) => {
    if (!search) return true;
    return (
      employee.name.toLowerCase().includes(search) ||
      (employee.divisionName ?? "").toLowerCase().includes(search)
    );
  });

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

  function reset() {
    draftTokenRef.current += 1;
    setTitle("");
    setBody("");
    setAudienceType("division");
    setDivisionIds(myDivision ? [myDivision.id] : []);
    setDivisionSearch("");
    setEmployeeIds([]);
    setEmployeeSearch("");
    for (const photo of photosRef.current) URL.revokeObjectURL(photo.url);
    commitPhotos([]);
    activeTasksRef.current.clear();
    setProcessingTasks(new Set());
    setError(null);
    setClientRequestId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openComposer() {
    setError(null);
    setClientRequestId(newRequestId());
    setOpen(true);
  }

  function close() {
    if (submitting) return;
    setOpen(false);
    reset();
  }

  function toggleDivision(id: string, checked: boolean) {
    if (
      checked &&
      !divisionIds.includes(id) &&
      divisionIds.length >= NOTE_MAX_DIVISIONS
    ) {
      toast.error(`Maksimal ${NOTE_MAX_DIVISIONS} divisi tujuan.`);
      return;
    }
    setDivisionIds((current) =>
      checked
        ? [...new Set([...current, id])]
        : current.filter((value) => value !== id),
    );
  }

  function toggleEmployee(id: string, checked: boolean) {
    if (
      checked &&
      !employeeIds.includes(id) &&
      employeeIds.length >= NOTE_MAX_EMPLOYEES
    ) {
      toast.error(`Maksimal ${NOTE_MAX_EMPLOYEES} karyawan penerima.`);
      return;
    }
    setEmployeeIds((current) =>
      checked
        ? [...new Set([...current, id])]
        : current.filter((value) => value !== id),
    );
  }

  async function processPhotos(files: File[], token: number) {
    for (const file of files) {
      if (token !== draftTokenRef.current) return;
      if (photosRef.current.length >= NOTE_MAX_PHOTOS) {
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
      const current = photosRef.current;
      if (current.length >= NOTE_MAX_PHOTOS) {
        toast.error(`Maksimal ${NOTE_MAX_PHOTOS} foto per catatan.`);
        return;
      }
      const total = current.reduce((sum, photo) => sum + photo.file.size, 0);
      if (total + optimized.size > NOTE_MAX_TOTAL_BYTES) {
        toast.error(
          `Total foto maksimal ${(NOTE_MAX_TOTAL_BYTES / 1024 / 1024).toFixed(0)} MB.`,
        );
        return;
      }

      commitPhotos([
        ...current,
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

  function removePhoto(index: number) {
    const current = photosRef.current;
    const photo = current[index];
    if (photo) URL.revokeObjectURL(photo.url);
    commitPhotos(current.filter((_, position) => position !== index));
  }

  const totalPhotoBytes = photos.reduce(
    (sum, photo) => sum + photo.file.size,
    0,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (activeTasksRef.current.size > 0) {
      setError("Tunggu sampai foto selesai diproses, lalu kirim lagi.");
      return;
    }
    if (audienceType === "division" && divisionIds.length === 0) {
      setError("Pilih minimal satu divisi tujuan.");
      return;
    }
    if (audienceType === "employees" && employeeIds.length === 0) {
      setError("Pilih minimal satu karyawan penerima.");
      return;
    }

    const currentPhotos = photosRef.current;
    const requestId = clientRequestId || newRequestId();
    if (!clientRequestId) setClientRequestId(requestId);
    setSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("body", body.trim());
      form.set("audienceType", audienceType);
      form.set("clientRequestId", requestId);
      form.set(
        "divisionIds",
        JSON.stringify(audienceType === "division" ? divisionIds : []),
      );
      form.set(
        "employeeIds",
        JSON.stringify(audienceType === "employees" ? employeeIds : []),
      );
      for (const photo of currentPhotos) {
        form.append("photo", photo.file, photo.file.name || "catatan.jpg");
      }

      const response = await fetch("/api/catatan", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; duplicate?: boolean }
        | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? "Catatan gagal disimpan.");
      }

      toast.success(
        payload.duplicate ? "Catatan sudah tersimpan." : "Catatan dikirim.",
      );
      setOpen(false);
      reset();
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Catatan gagal disimpan. Coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const disabled =
    submitting ||
    photoProcessing ||
    title.trim().length === 0 ||
    body.trim().length === 0 ||
    (audienceType === "division"
      ? divisionIds.length === 0
      : employeeIds.length === 0);

  return (
    <>
      <Button type="button" size="sm" onClick={openComposer}>
        <PenLine />
        {label}
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Tulis catatan"
        description="Catatan singkat untuk satu atau beberapa divisi, atau rekan kerja tertentu. Penerima dapat membacanya di halaman Catatan; tidak ada balasan atau notifikasi."
        size="lg"
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
              {submitting ? <Spinner /> : <PenLine />}
              {submitting ? "Mengirim…" : "Kirim catatan"}
            </Button>
          </>
        }
      >
        <form id={formId} className="flex flex-col gap-4" onSubmit={submit}>
          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Catatan belum terkirim</AlertTitle>
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
                placeholder="Contoh: Kunci ruangan A"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-body`}>Isi catatan</Label>
              <Textarea
                id={`${formId}-body`}
                value={body}
                maxLength={2_000}
                rows={5}
                required
                placeholder="Tulis informasi yang perlu diketahui penerima."
                onChange={(event) => setBody(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {body.length}/2.000 karakter
              </p>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">Penerima</legend>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`${formId}-audience`}
                    value="division"
                    checked={audienceType === "division"}
                    onChange={() => setAudienceType("division")}
                    className="size-4 accent-primary"
                  />
                  Divisi
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`${formId}-audience`}
                    value="employees"
                    checked={audienceType === "employees"}
                    onChange={() => setAudienceType("employees")}
                    className="size-4 accent-primary"
                  />
                  Karyawan tertentu
                </label>
              </div>

              {audienceType === "division" ? (
                options.divisions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Belum ada divisi aktif yang dapat dipilih.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        Pilih satu atau beberapa divisi.
                      </span>
                      {crossDivision && (
                        <Badge variant="info-light">Lintas divisi</Badge>
                      )}
                    </div>
                    <Input
                      value={divisionSearch}
                      autoComplete="off"
                      placeholder="Cari divisi tujuan"
                      aria-label="Cari divisi tujuan"
                      onChange={(event) =>
                        setDivisionSearch(event.target.value)
                      }
                    />
                    <div className="max-h-52 overflow-y-auto rounded-md border border-border p-2">
                      {filteredDivisions.length === 0 ? (
                        <p className="px-1 py-2 text-xs text-muted-foreground">
                          Tidak ada divisi yang cocok.
                        </p>
                      ) : (
                        filteredDivisions.map((division) => (
                          <label
                            key={division.id}
                            htmlFor={`${formId}-division-${division.id}`}
                            className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1.5 transition-colors hover:bg-muted/50"
                          >
                            <Checkbox
                              id={`${formId}-division-${division.id}`}
                              checked={divisionIds.includes(division.id)}
                              onCheckedChange={(checked) =>
                                toggleDivision(division.id, checked === true)
                              }
                            />
                            <span className="min-w-0 break-words text-sm">
                              {division.name}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {divisionIds.length}/{NOTE_MAX_DIVISIONS} divisi dipilih.
                    </p>
                  </div>
                )
              ) : (
                <div className="flex flex-col gap-2">
                  <Input
                    value={employeeSearch}
                    autoComplete="off"
                    placeholder="Cari nama atau divisi"
                    aria-label="Cari karyawan penerima"
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                  />
                  <div className="max-h-52 overflow-y-auto rounded-md border border-border p-2">
                    {filteredEmployees.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-muted-foreground">
                        Tidak ada karyawan yang cocok.
                      </p>
                    ) : (
                      filteredEmployees.map((employee) => (
                        <label
                          key={employee.id}
                          htmlFor={`${formId}-employee-${employee.id}`}
                          className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1.5 transition-colors hover:bg-muted/50"
                        >
                          <Checkbox
                            id={`${formId}-employee-${employee.id}`}
                            checked={employeeIds.includes(employee.id)}
                            onCheckedChange={(checked) =>
                              toggleEmployee(employee.id, checked === true)
                            }
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="break-words text-sm">
                              {employee.name}
                            </span>
                            {employee.divisionName && (
                              <span className="break-words text-xs text-muted-foreground">
                                {employee.divisionName}
                              </span>
                            )}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {employeeIds.length}/{NOTE_MAX_EMPLOYEES} karyawan dipilih.
                    Hanya akun pekerja yang dapat dipilih.
                  </p>
                </div>
              )}
            </fieldset>

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
                disabled={submitting || photos.length >= NOTE_MAX_PHOTOS}
                onChange={(event) => pickPhotos(event.target.files)}
              />
              <p className="text-xs text-muted-foreground">
                {photoProcessing
                  ? "Mengompres foto…"
                  : photos.length >= NOTE_MAX_PHOTOS
                    ? `${NOTE_MAX_PHOTOS} foto dipilih — hapus salah satu untuk menambahkan yang lain.`
                    : `JPG, PNG, atau WEBP. Tiap foto dikompres hingga maksimal 1,5 MB; total ${(NOTE_MAX_TOTAL_BYTES / 1024 / 1024).toFixed(0)} MB.`}
              </p>
              {photoProcessing && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Spinner />
                  Foto sedang diproses. Tombol kirim aktif setelah selesai.
                </p>
              )}
              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {photos.map((photo, index) => (
                    <div
                      key={photo.url}
                      className="relative overflow-hidden rounded-md border border-border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={`Pratinjau foto ${index + 1}: ${photo.file.name}`}
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="destructive"
                        className="absolute right-1.5 top-1.5"
                        aria-label={`Hapus foto ${index + 1}`}
                        onClick={() => removePhoto(index)}
                        disabled={submitting}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length > 0 && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {photos.length}/{NOTE_MAX_PHOTOS} foto ·{" "}
                  {Math.max(1, Math.round(totalPhotoBytes / 1024))} KB
                </p>
              )}
            </div>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ImagePlus
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              Catatan tidak mengirim WhatsApp. Penerima melihatnya saat
              membuka aplikasi.
            </p>
          </fieldset>
        </form>
      </Modal>
    </>
  );
}
