"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  Hammer,
  ImageOff,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/date-picker";
import {
  buildDailyCollages,
  dailyReportPhotoUrl,
  DAILY_COLLAGE_PHOTO_LIMIT,
  type CollageBuildOptions,
  type DailyCollage,
} from "@/components/reports/daily-collage";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { DataRow, EmptyState, PageHeader } from "@/components/ui";
import {
  buildDailyReportText,
  formatDailyReportDate,
} from "@/lib/daily-report-text";
import type {
  DailyReportData,
  DailyReportPhoto,
  DailyReportSettings,
} from "@/lib/daily-report-types";
import { cn } from "@/lib/utils";

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(area);
  if (!copied) throw new Error("copy-failed");
}

function ReportPhotoImage({
  photo,
  date,
  className,
  sizes,
}: {
  photo: DailyReportPhoto;
  date: string;
  className?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const alt = photo.itemLabel
    ? `${photo.groupLabel} — ${photo.itemLabel}`
    : photo.groupLabel;

  if (failed) {
    return (
      <span
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-5" aria-hidden="true" />
        <span className="sr-only">Foto tidak dapat dimuat</span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dailyReportPhotoUrl(photo, date)}
      alt={alt}
      loading="lazy"
      sizes={sizes}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}

function priorityLabel(photo: DailyReportPhoto) {
  if (photo.priority === 1) return "Pekerjaan";
  if (photo.priority === 2) return "Checklist";
  return "Tambahan";
}

function priorityVariant(photo: DailyReportPhoto) {
  if (photo.priority === 1) return "info-light" as const;
  if (photo.priority === 2) return "success-light" as const;
  return "invert-light" as const;
}

function ReportPhotoCard({
  photo,
  date,
  onRemove,
  onReplace,
}: {
  photo: DailyReportPhoto;
  date: string;
  onRemove: () => void;
  onReplace: () => void;
}) {
  return (
    <figure className="group relative min-w-0 overflow-hidden rounded-lg border border-border bg-muted">
      <div className="relative aspect-[4/5] w-full">
        <ReportPhotoImage
          photo={photo}
          date={date}
          className="absolute inset-0 size-full"
          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 50vw"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-2">
          <Badge variant={priorityVariant(photo)}>{priorityLabel(photo)}</Badge>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              onClick={onReplace}
              aria-label="Ganti foto"
              title="Ganti foto"
            >
              <RefreshCw />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="destructive"
              onClick={onRemove}
              aria-label="Keluarkan foto dari laporan"
              title="Keluarkan foto dari laporan"
            >
              <Trash2 />
            </Button>
          </div>
        </div>
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2 pt-8 text-white">
          <p className="line-clamp-2 text-xs font-medium">
            {photo.groupLabel}
          </p>
          {photo.itemLabel && (
            <p className="line-clamp-1 text-xs text-white/80">
              {photo.itemLabel}
            </p>
          )}
          {photo.locationName && (
            <p className="line-clamp-1 text-xs text-white/70">
              {photo.locationName}
            </p>
          )}
        </figcaption>
      </div>
    </figure>
  );
}

export function DailyReportView({ data }: { data: DailyReportData }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const [reportTitle, setReportTitle] = useState(data.settings.title);
  const [notes, setNotes] = useState(data.settings.notes);
  const [savedTitle, setSavedTitle] = useState(data.settings.title);
  const [savedNotes, setSavedNotes] = useState(data.settings.notes);
  const [settingsMeta, setSettingsMeta] = useState(() => ({
    sourceDate: data.settings.sourceDate,
    updatedAt: data.settings.updatedAt,
    updatedBy: data.settings.updatedBy,
  }));
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    data.photos.filter((photo) => photo.selected).map((photo) => photo.id),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [collageOpen, setCollageOpen] = useState(false);
  const [collages, setCollages] = useState<DailyCollage[]>([]);
  const [collageIndex, setCollageIndex] = useState(0);
  const [building, setBuilding] = useState(false);
  const [collageError, setCollageError] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const swipeStart = useRef<{
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);
  const swipeImageRef = useRef<HTMLImageElement | null>(null);
  const collageRequest = useRef(0);
  const [swiping, setSwiping] = useState(false);

  const photoById = useMemo(
    () => new Map(data.photos.map((photo) => [photo.id, photo])),
    [data.photos],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedPhotos = useMemo(
    () =>
      selectedIds
        .map((id) => photoById.get(id))
        .filter((photo): photo is DailyReportPhoto => Boolean(photo)),
    [photoById, selectedIds],
  );
  const availablePhotos = useMemo(
    () => data.photos.filter((photo) => !selectedSet.has(photo.id)),
    [data.photos, selectedSet],
  );

  const text = useMemo(
    () =>
      buildDailyReportText(data, {
        title: reportTitle,
        notes,
      }),
    [data, reportTitle, notes],
  );
  const settingsDirty =
    reportTitle.trim() !== savedTitle.trim() ||
    notes.trim() !== savedNotes.trim();
  const settingsStatus = useMemo(() => {
    if (!data.canSaveSettings) {
      return "Judul dan catatan mengikuti simpanan tim.";
    }
    if (settingsError) return "Perubahan belum disimpan.";
    if (savingSettings) return "Menyimpan judul dan catatan…";
    if (settingsDirty) return "Perubahan belum disimpan.";
    if (!settingsMeta.sourceDate) {
      return "Belum disimpan. Judul dan catatan berlaku untuk seluruh tim.";
    }
    if (settingsMeta.sourceDate !== data.date) {
      return `Mengikuti laporan ${formatDailyReportDate(settingsMeta.sourceDate)}${
        settingsMeta.updatedBy ? ` • ${settingsMeta.updatedBy}` : ""
      }.`;
    }
    return `Tersimpan untuk tim${
      settingsMeta.updatedBy ? ` • ${settingsMeta.updatedBy}` : ""
    }.`;
  }, [
    data.canSaveSettings,
    data.date,
    savingSettings,
    settingsDirty,
    settingsError,
    settingsMeta,
  ]);
  const collageCount =
    selectedPhotos.length === 0
      ? 0
      : Math.ceil(selectedPhotos.length / DAILY_COLLAGE_PHOTO_LIMIT);
  const activeCollageIndex =
    collages.length === 0
      ? 0
      : Math.min(Math.max(collageIndex, 0), collages.length - 1);
  const activeCollage = collages[activeCollageIndex] ?? null;
  const canSwitchCollage = collages.length > 1;

  useEffect(() => {
    setCollageIndex((current) =>
      Math.min(Math.max(current, 0), Math.max(collages.length - 1, 0)),
    );
  }, [collages.length]);

  useEffect(() => {
    if (!collageOpen || collages.length < 2) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      resetSwipe();
      const step = event.key === "ArrowRight" ? 1 : -1;
      setCollageIndex((current) => {
        const next = current + step;
        return Math.min(Math.max(next, 0), collages.length - 1);
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [collageOpen, collages.length]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    const urls = collages.map((collage) => collage.url);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [collages]);

  function navigate(nextDate: string, nextSeed?: string) {
    const params = new URLSearchParams();
    params.set("tanggal", nextDate);
    if (nextSeed) params.set("seed", nextSeed);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function changeDate(nextDate: string) {
    if (nextDate === data.date) return;
    navigate(nextDate);
  }

  function reroll() {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    navigate(data.date, values[0].toString(36));
  }

  async function copyReport() {
    try {
      await copyTextToClipboard(text);
      setCopied(true);
      toast.success("Teks laporan disalin.");
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(
        "Teks belum dapat disalin otomatis. Blok teks lalu salin manual.",
      );
    }
  }

  async function saveSettings() {
    if (!data.canSaveSettings || savingSettings) return;
    setSavingSettings(true);
    setSettingsError(null);
    try {
      const response = await fetch("/api/laporan-harian/pengaturan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: data.date,
          title: reportTitle,
          notes,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            settings?: DailyReportSettings;
          }
        | null;
      if (!response.ok || !payload?.settings) {
        throw new Error(
          payload?.message ?? "Judul dan catatan gagal disimpan.",
        );
      }

      const saved = payload.settings;
      setReportTitle(saved.title);
      setNotes(saved.notes);
      setSavedTitle(saved.title);
      setSavedNotes(saved.notes);
      setSettingsMeta({
        sourceDate: saved.sourceDate,
        updatedAt: saved.updatedAt,
        updatedBy: saved.updatedBy,
      });
      toast.success("Judul dan catatan disimpan untuk tim.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Judul dan catatan gagal disimpan.";
      setSettingsError(message);
      toast.error(message);
    } finally {
      setSavingSettings(false);
    }
  }

  function removePhoto(id: string) {
    setSelectedIds((current) => current.filter((value) => value !== id));
  }

  function resetSelection() {
    setSelectedIds(data.photos.map((photo) => photo.id));
  }

  function openAddPhoto() {
    setReplacingId(null);
    setPickerOpen(true);
  }

  function openReplacePhoto(id: string) {
    setReplacingId(id);
    setPickerOpen(true);
  }

  function choosePhoto(id: string) {
    setSelectedIds((current) => {
      if (replacingId) {
        return current.map((value) => (value === replacingId ? id : value));
      }
      return current.includes(id) ? current : [...current, id];
    });
    setPickerOpen(false);
    setReplacingId(null);
  }

  async function generateCollages() {
    if (selectedPhotos.length === 0) return;
    const requestId = ++collageRequest.current;
    setBuilding(true);
    setCollageError(null);
    setDownloadNotice(null);
    setCollageIndex(0);
    resetSwipe();
    const options: CollageBuildOptions = {
      date: data.date,
      title: reportTitle,
      notes,
    };
    try {
      const result = await buildDailyCollages(selectedPhotos, options);
      if (collageRequest.current !== requestId) {
        for (const collage of result) URL.revokeObjectURL(collage.url);
        return;
      }
      setCollages(result);
    } catch (error) {
      if (collageRequest.current !== requestId) return;
      console.error("Gagal membuat kolase laporan harian:", error);
      setCollageError("Kolase gagal dibuat. Periksa koneksi lalu coba lagi.");
    } finally {
      if (collageRequest.current === requestId) setBuilding(false);
    }
  }

  function openCollages() {
    if (selectedPhotos.length === 0) return;
    setCollageOpen(true);
    void generateCollages();
  }

  function stepCollage(step: number) {
    resetSwipe();
    setCollageIndex((current) => {
      const next = current + step;
      return Math.min(Math.max(next, 0), Math.max(collages.length - 1, 0));
    });
  }

  function handleSwipeStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canSwitchCollage || building) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    swipeStart.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSwiping(true);
  }

  function handleSwipeMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
      resetSwipe();
      return;
    }
    const atStart = activeCollageIndex === 0 && dx > 0;
    const atEnd =
      activeCollageIndex === collages.length - 1 && dx < 0;
    if (swipeImageRef.current) {
      const offset = atStart || atEnd ? dx * 0.25 : dx;
      swipeImageRef.current.style.transform = `translate3d(${offset}px, 0, 0)`;
    }
  }

  function resetSwipe() {
    swipeStart.current = null;
    if (swipeImageRef.current) {
      swipeImageRef.current.style.transform = "";
    }
    setSwiping(false);
  }

  function handleSwipeEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    resetSwipe();
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
    stepCollage(dx < 0 ? 1 : -1);
  }

  function downloadCollage(collage: DailyCollage) {
    const anchor = document.createElement("a");
    anchor.href = collage.url;
    anchor.download = collage.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function downloadAll() {
    if (collages.length === 0 || downloadingAll) return;
    setDownloadingAll(true);
    setDownloadNotice(`Menyiapkan ${collages.length} kolase…`);
    try {
      for (const collage of collages) {
        downloadCollage(collage);
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }
      setDownloadNotice(
        `${collages.length} kolase diunduh. Periksa folder unduhan perangkat.`,
      );
    } catch {
      setDownloadNotice(
        "Sebagian kolase gagal diunduh. Coba unduh satu per satu.",
      );
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6 lg:gap-8">
      <PageHeader
        mobileCompact
        eyebrow="Operasional"
        title="Laporan harian"
        description="Teks dan kolase foto siap dibagikan ke WhatsApp."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={copyReport}
            >
              {copied ? <Check /> : <Copy />}
              Salin teks
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={openCollages}
              disabled={selectedPhotos.length === 0}
            >
              <Download />
              Unduh kolase
            </Button>
          </div>
        }
      />

      <Frame spacing="default">
        <FramePanel className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label
                htmlFor="laporan-harian-tanggal"
                className="text-xs font-medium text-muted-foreground"
              >
                Tanggal laporan
              </label>
              <DatePicker
                id="laporan-harian-tanggal"
                value={data.date}
                onChange={changeDate}
                ariaLabel="Pilih tanggal laporan"
                disabled={savingSettings}
                className="sm:w-60"
              />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant="outline">
                <Hammer aria-hidden="true" />
                {data.totals.works} pekerjaan
              </Badge>
              <Badge variant="outline">
                <ClipboardCheck aria-hidden="true" />
                {data.totals.checklists} checklist
              </Badge>
              <Badge variant="outline">
                <Camera aria-hidden="true" />
                {selectedPhotos.length} foto
              </Badge>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="laporan-harian-judul">Judul laporan</Label>
              <Input
                id="laporan-harian-judul"
                value={reportTitle}
                maxLength={80}
                autoComplete="off"
                disabled={savingSettings}
                onChange={(event) => {
                  setReportTitle(event.target.value);
                  if (settingsError) setSettingsError(null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Ditebalkan otomatis di WhatsApp.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="laporan-harian-catatan">Catatan lain</Label>
              <Textarea
                id="laporan-harian-catatan"
                value={notes}
                rows={2}
                maxLength={1_000}
                placeholder="Opsional, tampil satu tingkat di bawah tanggal."
                disabled={savingSettings}
                onChange={(event) => {
                  setNotes(event.target.value);
                  if (settingsError) setSettingsError(null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {notes.length}/1.000 karakter
              </p>
            </div>
          </div>

          {settingsError ? (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>Judul dan catatan gagal disimpan</AlertTitle>
              <AlertDescription>{settingsError}</AlertDescription>
              <AlertAction>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => void saveSettings()}
                >
                  <RotateCcw />
                  Coba lagi
                </Button>
              </AlertAction>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p
              className="text-xs text-muted-foreground"
              aria-live="polite"
            >
              {settingsStatus}
            </p>
            {data.canSaveSettings ? (
              <Button
                size="sm"
                type="button"
                onClick={() => void saveSettings()}
                disabled={savingSettings}
                aria-busy={savingSettings}
              >
                {savingSettings ? <Spinner /> : <Save />}
                Simpan
              </Button>
            ) : null}
          </div>
        </FramePanel>
      </Frame>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Frame spacing="default" className="min-w-0">
          <FrameHeader className="flex flex-row items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <FrameTitle>Teks laporan</FrameTitle>
              <FrameDescription>
                Siap disalin ke WhatsApp tanpa status.
              </FrameDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={copyReport}
            >
              {copied ? <Check /> : <Copy />}
              Salin
            </Button>
          </FrameHeader>
          <FramePanel>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground select-text">
              {text}
            </pre>
          </FramePanel>
        </Frame>

        <Frame spacing="default" className="min-w-0">
          <FrameHeader>
            <FrameTitle>Ringkasan</FrameTitle>
            <FrameDescription>
              Cakupan tim dan bahan laporan.
            </FrameDescription>
          </FrameHeader>
          <FramePanel className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 flex-col">
              <DataRow
                label="Tim"
                value={
                  data.scopeAll ? "Seluruh perusahaan" : data.teamLabel
                }
              />
              <DataRow
                label="Pekerjaan selesai"
                value={data.totals.works}
              />
              <DataRow
                label="Checklist selesai"
                value={data.totals.checklists}
              />
              <DataRow
                label="Foto terpilih"
                value={`${selectedPhotos.length} dari ${data.totals.photos}`}
              />
              <DataRow
                label="Kolase"
                value={
                  collageCount === 0
                    ? "Belum ada"
                    : `${collageCount} gambar`
                }
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Urutan foto: satu foto dari setiap pekerjaan, lalu foto
              checklist, lalu foto tambahan pekerjaan secara bergiliran.
              Maksimal {DAILY_COLLAGE_PHOTO_LIMIT} foto per kolase.
            </p>
          </FramePanel>
        </Frame>
      </div>

      <Frame spacing="default" className="min-w-0">
        <FrameHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Foto dokumentasi</FrameTitle>
            <FrameDescription>
              {selectedPhotos.length} foto terpilih • {collageCount} kolase.
              Hapus atau ganti foto sebelum mengunduh.
            </FrameDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={openAddPhoto}
              disabled={availablePhotos.length === 0}
            >
              <Plus />
              Tambah foto
            </Button>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={reroll}
              disabled={isPending || data.totals.photos === 0}
              aria-busy={isPending}
            >
              {isPending ? <Spinner /> : <Shuffle />}
              Acak ulang
            </Button>
          </div>
        </FrameHeader>
        <FramePanel className="min-w-0">
          {selectedPhotos.length > 0 ? (
            <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {selectedPhotos.map((photo) => (
                <ReportPhotoCard
                  key={photo.id}
                  photo={photo}
                  date={data.date}
                  onRemove={() => removePhoto(photo.id)}
                  onReplace={() => openReplacePhoto(photo.id)}
                />
              ))}
            </div>
          ) : data.totals.photos === 0 ? (
            <EmptyState
              icon={Camera}
              title="Belum ada foto dokumentasi"
              description="Foto muncul dari pekerjaan dan checklist yang selesai pada tanggal ini. Pilih tanggal lain atau lengkapi dokumentasi pekerjaan."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/pekerjaan" />}
                >
                  <Hammer />
                  Buka pekerjaan
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Camera}
              title="Semua foto dikeluarkan"
              description="Tambahkan kembali foto yang ingin dilampirkan, atau kembalikan pilihan awal."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    size="sm"
                    type="button"
                    onClick={openAddPhoto}
                    disabled={availablePhotos.length === 0}
                  >
                    <Plus />
                    Tambah foto
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={resetSelection}
                  >
                    <RotateCcw />
                    Kembalikan semua
                  </Button>
                </div>
              }
            />
          )}
        </FramePanel>
      </Frame>

      <Dialog
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open) setReplacingId(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {replacingId ? "Ganti foto" : "Tambah foto"}
            </DialogTitle>
            <DialogDescription>
              Foto hanya berasal dari pekerjaan dan checklist yang selesai
              pada tanggal laporan.
            </DialogDescription>
          </DialogHeader>
          {availablePhotos.length > 0 ? (
            <div className="min-h-0 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {availablePhotos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => choosePhoto(photo.id)}
                    className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="relative block aspect-[4/3] w-full overflow-hidden bg-muted">
                      <ReportPhotoImage
                        photo={photo}
                        date={data.date}
                        className="absolute inset-0 size-full"
                        sizes="(min-width: 640px) 240px, 45vw"
                      />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5 p-2">
                      <span className="line-clamp-1 text-xs font-medium text-foreground">
                        {photo.groupLabel}
                      </span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {photo.itemLabel ||
                          photo.locationName ||
                          "Foto dokumentasi"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Camera}
              title="Tidak ada foto lain"
              description="Semua foto pada tanggal ini sudah masuk laporan."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setPickerOpen(false)}
                >
                  Tutup
                </Button>
              }
            />
          )}
          {availablePhotos.length > 0 && (
            <DialogFooter>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setPickerOpen(false)}
              >
                Batal
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={collageOpen} onOpenChange={setCollageOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 z-[1000000000] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-black p-0 text-white ring-0 outline-none sm:max-w-none"
        >
          <div className="flex shrink-0 items-start gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <DialogTitle className="truncate text-sm text-white">
                Kolase foto
              </DialogTitle>
              <DialogDescription
                className="truncate text-xs text-white/70"
                aria-live="polite"
              >
                {building
                  ? "Membuat kolase foto…"
                  : collageError
                    ? "Kolase gagal dibuat."
                    : activeCollage
                      ? `Kolase ${activeCollageIndex + 1} dari ${collages.length} • ${activeCollage.photoCount} foto`
                      : `${collageCount} kolase • maksimal ${DAILY_COLLAGE_PHOTO_LIMIT} foto per kolase`}
              </DialogDescription>
            </div>
            {activeCollage && !building && !collageError && (
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => downloadCollage(activeCollage)}
                aria-label={`Unduh kolase ${activeCollageIndex + 1}`}
              >
                <Download aria-hidden="true" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => setCollageOpen(false)}
              aria-label="Tutup kolase"
            >
              <X aria-hidden="true" />
            </Button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
            {building ? (
              <div
                className="flex flex-col items-center gap-2 text-white/70"
                role="status"
                aria-live="polite"
              >
                <Spinner aria-label="Membuat kolase" />
                <p className="text-xs">
                  Menyiapkan {collageCount} kolase…
                </p>
              </div>
            ) : collageError ? (
              <div className="w-full max-w-md px-2">
                <Alert variant="warning">
                  <AlertTriangle aria-hidden="true" />
                  <AlertTitle>Kolase gagal dibuat</AlertTitle>
                  <AlertDescription>{collageError}</AlertDescription>
                  <AlertAction>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => void generateCollages()}
                    >
                      <RotateCcw />
                      Coba lagi
                    </Button>
                  </AlertAction>
                </Alert>
              </div>
            ) : activeCollage ? (
              <>
                <div
                  className={cn(
                    "flex h-full w-full touch-pan-y items-center justify-center select-none",
                    canSwitchCollage &&
                      (swiping ? "cursor-grabbing" : "cursor-grab"),
                  )}
                  onPointerDown={handleSwipeStart}
                  onPointerMove={handleSwipeMove}
                  onPointerUp={handleSwipeEnd}
                  onPointerCancel={resetSwipe}
                  onLostPointerCapture={resetSwipe}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={swipeImageRef}
                    src={activeCollage.url}
                    alt={`Kolase ${activeCollageIndex + 1} dari ${collages.length}`}
                    draggable={false}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                {canSwitchCollage && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-lg"
                      className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60 hover:text-white"
                      onClick={() => stepCollage(-1)}
                      disabled={activeCollageIndex === 0}
                      aria-label="Kolase sebelumnya"
                    >
                      <ChevronLeft aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-lg"
                      className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60 hover:text-white"
                      onClick={() => stepCollage(1)}
                      disabled={activeCollageIndex === collages.length - 1}
                      aria-label="Kolase berikutnya"
                    >
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </>
                )}
              </>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-white/10 bg-black/80 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate text-xs text-white/70">
                  {activeCollage && !building && !collageError
                    ? activeCollage.fileName
                    : `Maksimal ${DAILY_COLLAGE_PHOTO_LIMIT} foto per kolase.`}
                </p>
                {downloadNotice ? (
                  <p className="text-xs text-white/60" role="status">
                    {downloadNotice}
                  </p>
                ) : canSwitchCollage && !building && !collageError ? (
                  <p className="text-xs text-white/50">
                    Geser ke kiri atau kanan untuk berpindah kolase.
                  </p>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="secondary"
                type="button"
                onClick={() => void downloadAll()}
                disabled={
                  building ||
                  Boolean(collageError) ||
                  collages.length === 0 ||
                  downloadingAll
                }
                aria-busy={downloadingAll}
              >
                {downloadingAll ? (
                  <Spinner aria-label="Mengunduh kolase" />
                ) : (
                  <Download />
                )}
                {downloadingAll ? "Menyiapkan…" : "Unduh semua"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
