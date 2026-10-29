"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Info,
  MapPin,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/date-picker";
import {
  LocationPicker,
  type LocationValue,
} from "@/components/maps/location-picker";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import {
  Avatar,
  AvatarStack,
  Badge as StateBadge,
  FieldError,
  PageHeader,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TimeField } from "@/components/time-field";
import type { ScheduledItem, ScheduleWarning } from "@/lib/schedule";
import { scheduleWarnings } from "@/lib/schedule";
import {
  durationLabel,
  formatDateHuman,
  zonedToIso,
} from "@/lib/time";
import type { Division, Employee, GeoPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface SpklFormInitial {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: GeoPoint;
  radiusMeters: number;
  divisionId: string;
  requiresDocumentation: boolean;
  workerIds: string[];
}

interface SpklFormProps {
  mode: "create" | "edit";
  team: Employee[];
  divisions: Division[];
  policy: {
    defaultLocation: GeoPoint;
    defaultRadiusMeters: number;
    dailyLimitMinutes: number;
    weeklyLimitMinutes: number;
    requireDocumentation: boolean;
    maxGpsAccuracyMeters: number;
  };
  initial?: SpklFormInitial;
  defaultDate: string;
  schedules: ScheduledItem[];
}

type Errors = Record<string, string | undefined>;

function durationMinutes(start: string, end: string) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const value =
    endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return Math.max(0, value);
}

export function SpklForm({
  mode,
  team,
  divisions,
  policy,
  initial,
  defaultDate,
  schedules,
}: SpklFormProps) {
  const router = useRouter();
  const activeDivisions = useMemo(
    () => divisions.filter((division) => division.active),
    [divisions],
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(initial?.startTime ?? "19:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "22:00");
  const [divisionId, setDivisionId] = useState(
    initial?.divisionId || activeDivisions[0]?.id || "",
  );
  const [location, setLocation] = useState<LocationValue>({
    latitude: initial?.location.latitude ?? policy.defaultLocation.latitude,
    longitude: initial?.location.longitude ?? policy.defaultLocation.longitude,
    address: initial?.location.address ?? policy.defaultLocation.address ?? "",
    radiusMeters:
      initial?.radiusMeters ?? policy.defaultRadiusMeters ?? 120,
  });
  const [workerIds, setWorkerIds] = useState<string[]>(() => {
    const initialDivision = initial?.divisionId || activeDivisions[0]?.id || "";
    return (initial?.workerIds ?? []).filter(
      (id) => team.find((employee) => employee.id === id)?.divisionId === initialDivision,
    );
  });
  const [requiresDocumentation, setRequiresDocumentation] = useState(
    initial?.requiresDocumentation ?? policy.requireDocumentation,
  );
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ScheduleWarning[]>([]);
  const divisionWorkers = useMemo(
    () => team.filter((employee) => employee.divisionId === divisionId),
    [team, divisionId],
  );
  const divisionItems = useMemo(
    () =>
      Object.fromEntries(
        divisions.map((division) => [
          division.id,
          division.active ? division.name : `${division.name} (nonaktif)`,
        ]),
      ),
    [divisions],
  );
  const [selectAll, setSelectAll] = useState(
    divisionWorkers.length > 0 &&
      (initial?.workerIds.length ?? 0) === divisionWorkers.length,
  );

  const localWarnings = useMemo(() => {
    if (!date || !startTime || !endTime || workerIds.length === 0) return [];
    try {
      const startAt = zonedToIso(date, startTime);
      const endAt = zonedToIso(date, endTime);
      if (new Date(endAt) <= new Date(startAt)) return [];
      return scheduleWarnings({
        employeeIds: workerIds,
        startAt,
        endAt,
        dailyLimitMinutes: policy.dailyLimitMinutes,
        weeklyLimitMinutes: policy.weeklyLimitMinutes,
        schedules,
        excludeSpklId: initial?.id,
      });
    } catch {
      return [];
    }
  }, [
    date,
    startTime,
    endTime,
    workerIds,
    policy.dailyLimitMinutes,
    policy.weeklyLimitMinutes,
    schedules,
    initial?.id,
  ]);

  const warningByEmployee = useMemo(() => {
    const map = new Map<string, ScheduleWarning[]>();
    for (const warning of [...localWarnings, ...warnings]) {
      const existing = map.get(warning.employeeId) ?? [];
      existing.push(warning);
      map.set(warning.employeeId, existing);
    }
    return map;
  }, [localWarnings, warnings]);

  const duration = durationMinutes(startTime, endTime);
  const selectedWorkers = divisionWorkers.filter((employee) =>
    workerIds.includes(employee.id),
  );

  function changeDivision(nextDivisionId: string) {
    if (nextDivisionId === divisionId) return;
    setDivisionId(nextDivisionId);
    setWorkerIds([]);
    setSelectAll(false);
    setErrors((current) => ({ ...current, divisionId: undefined, workers: undefined }));
  }

  function toggleWorker(employeeId: string) {
    setWorkerIds((current) => {
      const next = current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId];
      setSelectAll(
        divisionWorkers.length > 0 && next.length === divisionWorkers.length,
      );
      return next;
    });
  }

  function toggleAll() {
    if (selectAll) {
      setWorkerIds([]);
      setSelectAll(false);
      return;
    }
    setWorkerIds(divisionWorkers.map((employee) => employee.id));
    setSelectAll(true);
  }

  function validate() {
    const next: Errors = {};
    if (title.trim().length < 4) {
      next.title = "Nama pekerjaan minimal 4 karakter.";
    }
    if (description.trim().length < 10) {
      next.description = "Deskripsi pekerjaan minimal 10 karakter.";
    }
    if (!date) next.date = "Pilih tanggal lembur.";
    if (!startTime) next.startTime = "Isi jam mulai.";
    if (!endTime) next.endTime = "Isi jam selesai.";
    const hasValidRange =
      Boolean(date && startTime && endTime) &&
      new Date(zonedToIso(date, endTime)) >
        new Date(zonedToIso(date, startTime));
    if (startTime && endTime && date && !hasValidRange) {
      next.endTime = "Jam selesai harus setelah jam mulai.";
    }
    if (
      hasValidRange &&
      mode === "create" &&
      new Date(zonedToIso(date, endTime)) <= new Date()
    ) {
      next.endTime =
        "Jam selesai SPKL sudah lewat. Pilih jam selesai setelah sekarang.";
    }
    if (duration > 12 * 60) {
      next.endTime = "Durasi satu SPKL maksimal 12 jam.";
    }
    if (!location.address.trim()) {
      next.address = "Isi alamat atau patokan lokasi absen.";
    }
    if (
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude)
    ) {
      next.address = "Tentukan titik absen pada peta.";
    }
    if (location.radiusMeters < 25) {
      next.radiusMeters = "Radius absen minimal 25 meter.";
    }
    if (!divisionId) {
      next.divisionId = "Pilih divisi penugasan.";
    } else if (divisionWorkers.length === 0) {
      next.workers = "Divisi ini belum memiliki pekerja aktif.";
    }
    if (workerIds.length === 0) {
      next.workers = "Pilih minimal satu pekerja.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setWarnings([]);
    if (!validate()) {
      toast.error("Periksa kembali data SPKL.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        divisionId,
        date,
        startTime,
        endTime,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address.trim(),
        radiusMeters: location.radiusMeters,
        requiresDocumentation,
        workerIds,
      };
      const response = await fetch(
        mode === "create" ? "/api/spkl" : `/api/spkl/${initial?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
        warnings?: ScheduleWarning[];
        id?: string;
      };
      if (!response.ok || !data.ok) {
        setServerError(data.message ?? "Gagal menyimpan SPKL.");
        return;
      }

      if (data.warnings?.length) setWarnings(data.warnings);
      toast.success(
        data.message ??
          (mode === "create" ? "SPKL berhasil dibuat." : "Perubahan tersimpan."),
      );
      const id = data.id ?? initial?.id;
      if (id) {
        router.push(`/spkl/${id}`);
        router.refresh();
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setServerError("Tidak dapat menghubungi server. Periksa koneksimu.");
    } finally {
      setSubmitting(false);
    }
  }

  if (activeDivisions.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title={mode === "create" ? "Buat SPKL baru." : "Ubah SPKL."}
          description="Buat divisi aktif terlebih dahulu agar pekerja bisa dikelompokkan."
        />
        <Frame>
          <FramePanel>
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <IconTile variant="soft" size="lg" className="text-warning">
                <Building2 />
              </IconTile>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">
                  Belum ada divisi aktif
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  SPKL dibuat untuk satu divisi. Tambahkan divisi dan tempatkan
                  pekerja di dalamnya sebelum membuat SPKL.
                </p>
              </div>
              <Button nativeButton={false} render={<Link href="/tim" />}>
                <Building2 />
                Kelola divisi
              </Button>
            </div>
          </FramePanel>
        </Frame>
      </div>
    );
  }

  if (team.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title={
            mode === "create" ? "Buat SPKL baru." : "Ubah SPKL."
          }
          description="Tambahkan pekerja aktif ke timmu sebelum membuat SPKL."
        />
        <Frame>
          <FramePanel>
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <IconTile variant="soft" size="lg" className="text-warning">
                <UsersRound />
              </IconTile>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">
                  Belum ada pekerja aktif di timmu
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Tambahkan anggota tim terlebih dahulu sebelum membuat SPKL
                  dan mengatur jadwal lembur.
                </p>
              </div>
              <Button
                nativeButton={false}
                render={<Link href="/tim" />}
              >
                <UsersRound />
                Kelola tim
              </Button>
            </div>
          </FramePanel>
        </Frame>
      </div>
    );
  }

  const hasWarnings = localWarnings.length > 0;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pb-24 xl:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={initial ? `/spkl/${initial.id}` : "/"}
          className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
        >
          <ArrowLeft className="size-3.5" />
          {initial ? "Kembali ke detail SPKL" : "Kembali ke beranda"}
        </Link>
        <StateBadge variant="primary-light" dot className="ml-auto">
          {mode === "create" ? "SPKL baru" : "Ubah SPKL"}
        </StateBadge>
      </div>

      <PageHeader
        title={mode === "create" ? "Buat SPKL" : "Ubah SPKL"}
        description="Tentukan pekerjaan, jadwal, lokasi, dan pekerja."
        descriptionClassName="hidden md:block"
      />

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <Frame>
            <FrameHeader className="flex-row items-center gap-3">
              <IconTile
                variant="soft"
                size="sm"
                className="text-primary"
                aria-hidden="true"
              >
                <ClipboardList />
              </IconTile>
              <div className="flex min-w-0 flex-col">
                <FrameTitle>Detail pekerjaan</FrameTitle>
                <FrameDescription className="hidden text-xs md:block">
                  Terlihat oleh pekerja yang ditugaskan.
                </FrameDescription>
              </div>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="spkl-title">
                  Nama pekerjaan{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="spkl-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  aria-invalid={Boolean(errors.title)}
                  placeholder="Contoh: Stock opname gudang utama"
                  autoComplete="off"
                />
                <div className="flex items-start justify-between gap-2">
                  <FieldError>{errors.title}</FieldError>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {title.length}/120
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="spkl-description">
                  Deskripsi & target pekerjaan{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="spkl-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={1200}
                  aria-invalid={Boolean(errors.description)}
                  rows={4}
                  placeholder="Jelaskan lingkup kerja, target, dan hal penting yang perlu dibawa atau diperhatikan."
                />
                <div className="flex items-start justify-between gap-2">
                  <FieldError>{errors.description}</FieldError>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {description.length}/1200
                  </span>
                </div>
              </div>
            </FramePanel>
          </Frame>

          <Frame>
            <FrameHeader className="flex-row items-center gap-3">
              <IconTile
                variant="soft"
                size="sm"
                className="text-info"
                aria-hidden="true"
              >
                <CalendarDays />
              </IconTile>
              <div className="flex min-w-0 flex-col">
                <FrameTitle>Jadwal lembur</FrameTitle>
                <FrameDescription className="text-xs">
                  Waktu dalam WIB. Absen masuk dibuka sejak 00:00 WIB pada
                  tanggal SPKL; durasi lembur dihitung sejak jam mulai.
                </FrameDescription>
              </div>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-[1.2fr_0.9fr_0.9fr]">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="spkl-date">
                    Tanggal <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker
                    id="spkl-date"
                    value={date}
                    min={mode === "create" ? defaultDate : undefined}
                    onChange={setDate}
                    invalid={Boolean(errors.date)}
                    ariaDescribedBy={
                      errors.date ? "spkl-date-error" : undefined
                    }
                  />
                  <FieldError id="spkl-date-error">{errors.date}</FieldError>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="spkl-start">
                    Jam mulai <span className="text-destructive">*</span>
                  </Label>
                  <TimeField
                    id="spkl-start"
                    value={startTime}
                    onValueChange={(value) => setStartTime(value ?? "")}
                    invalid={Boolean(errors.startTime)}
                    aria-describedby={
                      errors.startTime ? "spkl-start-error" : undefined
                    }
                  />
                  <FieldError id="spkl-start-error">
                    {errors.startTime}
                  </FieldError>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="spkl-end">
                    Jam selesai <span className="text-destructive">*</span>
                  </Label>
                  <TimeField
                    id="spkl-end"
                    value={endTime}
                    onValueChange={(value) => setEndTime(value ?? "")}
                    invalid={Boolean(errors.endTime)}
                    aria-describedby={
                      errors.endTime ? "spkl-end-error" : undefined
                    }
                  />
                  <FieldError id="spkl-end-error">
                    {errors.endTime}
                  </FieldError>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2.5">
                <Clock3 className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {date
                    ? formatDateHuman(
                        `${date}T12:00:00`,
                        "EEEE, d MMMM yyyy",
                      )
                    : "Pilih tanggal"}
                </span>
                <span aria-hidden className="size-1 rounded-full bg-border" />
                <span className="text-xs font-semibold text-foreground">
                  {startTime || "—"}–{endTime || "—"} WIB
                </span>
                {duration > 0 && (
                  <StateBadge variant="outline" className="ml-auto">
                    {durationLabel(duration)}
                  </StateBadge>
                )}
              </div>
            </FramePanel>
          </Frame>

          <Frame>
            <FrameHeader className="flex-row items-center gap-3">
              <IconTile
                variant="soft"
                size="sm"
                className="text-primary"
                aria-hidden="true"
              >
                <MapPin />
              </IconTile>
              <div className="flex min-w-0 flex-col">
                <FrameTitle>Lokasi & radius absen</FrameTitle>
                <FrameDescription className="text-xs">
                  Tentukan titik pusat dan toleransi jarak absensi.
                </FrameDescription>
              </div>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-2">
              <LocationPicker
                value={location}
                onChange={(value) => setLocation(value)}
                error={errors.address ?? errors.radiusMeters}
              />
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3 shrink-0" />
                Pilih radius yang realistis. Semakin kecil radius, semakin ketat
                verifikasi lokasi pekerja.
              </p>
            </FramePanel>
          </Frame>

          <Frame>
            <FrameHeader className="flex-row items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <IconTile
                  variant="soft"
                  size="sm"
                  className="text-info"
                  aria-hidden="true"
                >
                  <UsersRound />
                </IconTile>
                <div className="flex min-w-0 flex-col">
                  <FrameTitle>Pekerja yang ditugaskan</FrameTitle>
                  <FrameDescription className="text-xs">
                    {workerIds.length} dari {divisionWorkers.length} pekerja
                    divisi ini dipilih.
                  </FrameDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                disabled={divisionWorkers.length === 0}
              >
                {selectAll ? "Kosongkan" : "Pilih semua"}
              </Button>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5 pb-1">
                <Label htmlFor="spkl-division">
                  Divisi penugasan{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  items={divisionItems}
                  value={divisionId}
                  onValueChange={(value) => {
                    if (value !== null) changeDivision(value);
                  }}
                >
                  <SelectTrigger
                    id="spkl-division"
                    className="w-full"
                    aria-invalid={Boolean(errors.divisionId)}
                  >
                    <SelectValue placeholder="Pilih divisi" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions
                      .filter(
                        (division) =>
                          division.active || division.id === divisionId,
                      )
                      .map((division) => (
                        <SelectItem key={division.id} value={division.id}>
                          {division.name}
                          {!division.active ? " (nonaktif)" : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FieldError>{errors.divisionId}</FieldError>
                <p className="text-xs text-muted-foreground">
                  Satu SPKL hanya untuk pekerja dari satu divisi. Mengganti
                  divisi mengosongkan pilihan pekerja.
                </p>
              </div>

              {divisionWorkers.length === 0 ? (
                <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border p-4">
                  <p className="text-sm font-medium text-foreground">
                    Belum ada pekerja aktif di divisi ini.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pindahkan pekerja ke divisi ini melalui halaman Tim.
                  </p>
                  <Button
                    nativeButton={false}
                    variant="outline"
                    size="sm"
                    render={<Link href="/tim" />}
                  >
                    <UsersRound />
                    Kelola tim
                  </Button>
                </div>
              ) : (
                divisionWorkers.map((employee) => {
                  const checked = workerIds.includes(employee.id);
                  const employeeWarnings =
                    warningByEmployee.get(employee.id) ?? [];
                  return (
                    <label
                      key={employee.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors",
                        checked
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-card hover:bg-muted/50",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleWorker(employee.id)}
                      />
                      <Avatar
                        name={employee.name}
                        seed={employee.id}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {employee.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {employee.nik} · {employee.phone}
                        </span>
                      </span>
                      {employeeWarnings.length > 0 && (
                        <StateBadge
                          variant="warning-light"
                          className="shrink-0"
                        >
                          <AlertTriangle className="size-3" />
                          {employeeWarnings.length} catatan
                        </StateBadge>
                      )}
                    </label>
                  );
                })
              )}
              <FieldError>{errors.workers}</FieldError>

              {selectedWorkers.length > 0 && (
                <div className="flex items-center gap-2.5 rounded-md bg-muted/50 px-3 py-2.5">
                  <AvatarStack employees={selectedWorkers} max={4} size="xs" />
                  <p className="text-xs font-medium text-muted-foreground">
                    {selectedWorkers
                      .slice(0, 3)
                      .map((employee) => employee.name.split(" ")[0])
                      .join(", ")}
                    {selectedWorkers.length > 3
                      ? ` +${selectedWorkers.length - 3} pekerja lain`
                      : ""}{" "}
                    akan menerima notifikasi WhatsApp.
                  </p>
                </div>
              )}
            </FramePanel>
          </Frame>

          <Frame>
            <FramePanel>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <IconTile
                    variant="soft"
                    size="sm"
                    className="text-warning"
                    aria-hidden="true"
                  >
                    <ShieldCheck />
                  </IconTile>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-foreground">
                      Wajib dokumentasi sebelum pulang
                    </p>
                    <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
                      Pekerja harus mengunggah minimal satu foto bukti
                      pekerjaan sebelum dapat melakukan absen pulang.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={requiresDocumentation}
                  onCheckedChange={setRequiresDocumentation}
                  aria-label="Wajib dokumentasi sebelum pulang"
                />
              </div>
            </FramePanel>
          </Frame>

          {hasWarnings && (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertTitle>
                {localWarnings.length} peringatan jadwal
              </AlertTitle>
              <AlertDescription>
                <ul className="flex flex-col gap-1">
                  {localWarnings.map((warning, index) => (
                    <li key={`${warning.employeeId}-${warning.type}-${index}`}>
                      {team.find(
                        (employee) => employee.id === warning.employeeId,
                      )?.name ?? "Pekerja"}
                      : {warning.message}
                    </li>
                  ))}
                </ul>
                <p className="mt-2">
                  Peringatan tidak menghalangi pembuatan SPKL, tetapi sebaiknya
                  jadwal ditinjau kembali.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {serverError && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>SPKL gagal disimpan</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <Frame>
            <FrameHeader className="gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Ringkasan SPKL
              </p>
              <FrameTitle>
                {title.trim() || "Nama pekerjaan belum diisi"}
              </FrameTitle>
              <FrameDescription className="flex flex-col gap-1.5 text-xs">
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-3 shrink-0" />
                  {divisions.find((division) => division.id === divisionId)
                    ?.name ?? "Divisi belum dipilih"}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3 shrink-0" />
                  {date
                    ? formatDateHuman(`${date}T12:00:00`, "d MMMM yyyy")
                    : "Tanggal belum dipilih"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock3 className="size-3 shrink-0" />
                  {startTime || "—"}–{endTime || "—"} WIB
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">
                    {location.address || "Lokasi belum ditentukan"}
                  </span>
                </span>
              </FrameDescription>
            </FrameHeader>
            <FramePanel className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-0.5">
                <p className="text-xs text-muted-foreground">Pekerja</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {workerIds.length}
                </p>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs text-muted-foreground">Durasi</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {duration > 0 ? durationLabel(duration) : "—"}
                </p>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs text-muted-foreground">Radius</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {location.radiusMeters} m
                </p>
              </div>
            </FramePanel>
            <FrameFooter className="hidden xl:flex">
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <>
                    <Spinner />
                    Menyimpan…
                  </>
                ) : mode === "create" ? (
                  <>
                    <Send />
                    Buat & kirim notifikasi
                  </>
                ) : (
                  <>
                    <Save />
                    Simpan perubahan
                  </>
                )}
              </Button>
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                {mode === "create"
                  ? "SPKL langsung berlaku sesuai jadwal. Pekerja menerima notifikasi WhatsApp."
                  : "Perubahan jadwal dan lokasi langsung berlaku untuk semua pekerja."}
              </p>
            </FrameFooter>
          </Frame>

          <Frame spacing="sm">
            <FrameHeader className="flex-row items-center gap-2">
              <Sparkles className="size-3.5 text-warning" />
              <FrameTitle>Sebelum menekan simpan</FrameTitle>
            </FrameHeader>
            <FramePanel>
              <ul className="flex flex-col gap-2">
                {[
                  "Jam selesai masih di masa depan (SPKL boleh mulai hari ini).",
                  "Titik absen berada di lokasi pekerjaan sebenarnya.",
                  "Pekerja sudah dikonfirmasi ketersediaannya.",
                  "Target dokumentasi pekerjaan jelas.",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"
                  >
                    <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </FramePanel>
          </Frame>

          <Frame spacing="sm">
            <FramePanel className="flex flex-col gap-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                Batas waktu per hari & minggu
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Kebijakan saat ini: maks.{" "}
                {durationLabel(policy.dailyLimitMinutes)} per hari dan{" "}
                {durationLabel(policy.weeklyLimitMinutes)} per minggu per
                pekerja. Peringatan muncul otomatis saat jadwal melewati batas.
              </p>
            </FramePanel>
          </Frame>
        </aside>
      </div>

      <div className="above-mobile-nav fixed inset-x-0 z-30 border-t border-border bg-background/95 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-xl xl:hidden">
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={initial ? `/spkl/${initial.id}` : "/"} />}
            className="flex-1"
          >
            Batal
          </Button>
          <Button type="submit" disabled={submitting} className="flex-[1.4]">
            {submitting ? (
              <>
                <Spinner />
                Menyimpan…
              </>
            ) : mode === "create" ? (
              <>
                <Send />
                Buat SPKL
              </>
            ) : (
              <>
                <Save />
                Simpan
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
