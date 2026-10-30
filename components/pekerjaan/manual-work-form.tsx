"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ListChecks,
  MapPin,
  Save,
  Search,
  Send,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/date-picker";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import {
  Avatar,
  Badge,
  FieldError,
  InfoBanner,
  PageHeader,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
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
import {
  MANUAL_WORK_MAX_ASSIGNEES,
  type ManualWork,
  type ManualWorkFollowUpOption,
  type ManualWorkLocationOption,
  type ManualWorkPerson,
  type ManualWorkTeamMember,
} from "@/lib/manual-work-types";
import { cn } from "@/lib/utils";

type Errors = Partial<
  Record<
    | "title"
    | "description"
    | "startDate"
    | "targetDate"
    | "assignees"
    | "locationId",
    string
  >
>;

interface WorkerDivisionGroup {
  id: string;
  name: string;
  people: ManualWorkTeamMember[];
}

function groupWorkersByDivision(
  workers: ManualWorkTeamMember[],
): WorkerDivisionGroup[] {
  const groups = new Map<string, WorkerDivisionGroup>();
  for (const person of workers) {
    const id = person.divisionId ?? "tanpa";
    const existing = groups.get(id);
    if (existing) {
      existing.people.push(person);
    } else {
      groups.set(id, {
        id,
        name: person.divisionName ?? "Tanpa divisi",
        people: [person],
      });
    }
  }
  return [...groups.values()];
}

export function ManualWorkForm({
  mode,
  team,
  followUps,
  locations,
  defaultDate,
  initial,
  initialAssigneeIds = [],
  canAssign,
  self,
}: {
  mode: "create" | "edit";
  team: ManualWorkTeamMember[];
  followUps: ManualWorkFollowUpOption[];
  locations: ManualWorkLocationOption[];
  defaultDate: string;
  initial?: ManualWork;
  initialAssigneeIds?: string[];
  canAssign: boolean;
  self: ManualWorkPerson & { supervisorName: string | null };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [safetyName, setSafetyName] = useState(initial?.safetyName ?? "");
  const [locationId, setLocationId] = useState(initial?.locationId ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? defaultDate);
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");
  const [requiresDocumentation, setRequiresDocumentation] = useState(
    initial?.requiresDocumentation ?? true,
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    initialAssigneeIds.length > 0
      ? initialAssigneeIds
      : canAssign
        ? []
        : [self.id],
  );
  const [followUpId, setFollowUpId] = useState(
    canAssign ? (initial?.sourceFollowUpId ?? "") : "",
  );
  const [personSearch, setPersonSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("semua");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const reporterMode = !canAssign;
  const supervisorMissing =
    reporterMode && mode === "create" && !self.supervisorName;

  const availableLocations = useMemo(() => {
    const items = locations.filter(
      (location) =>
        location.active || location.id === (initial?.locationId ?? null),
    );
    if (
      initial?.locationId &&
      !items.some((location) => location.id === initial.locationId)
    ) {
      items.unshift({
        id: initial.locationId,
        name: initial.locationName || "Lokasi sebelumnya",
        parentId: null,
        active: false,
        path: initial.locationName || "Lokasi sebelumnya",
      });
    }
    return items;
  }, [initial?.locationId, initial?.locationName, locations]);

  const locationItems = availableLocations.map((location) => ({
    value: location.id,
    label: location.path,
  }));
  const noLocations = locationItems.length === 0;

  const divisionGroups = useMemo(
    () => groupWorkersByDivision(team),
    [team],
  );
  const divisionItems = useMemo(
    () => [
      { value: "semua", label: `Semua divisi (${team.length})` },
      ...divisionGroups.map((group) => ({
        value: group.id,
        label: `${group.name} (${group.people.length})`,
      })),
    ],
    [divisionGroups, team.length],
  );
  const normalizedQuery = personSearch.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    const scoped =
      divisionFilter === "semua"
        ? divisionGroups
        : divisionGroups.filter((group) => group.id === divisionFilter);
    if (!normalizedQuery) return scoped;
    return scoped
      .map((group) => ({
        ...group,
        people: group.people.filter((person) =>
          `${person.name} ${person.nik}`
            .toLowerCase()
            .includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.people.length > 0);
  }, [divisionFilter, divisionGroups, normalizedQuery]);
  const filteredTotal = useMemo(
    () =>
      filteredGroups.reduce(
        (total, group) => total + group.people.length,
        0,
      ),
    [filteredGroups],
  );
  const filteredIds = useMemo(
    () =>
      filteredGroups.flatMap((group) =>
        group.people.map((person) => person.id),
      ),
    [filteredGroups],
  );
  const atAssigneeCap = assigneeIds.length >= MANUAL_WORK_MAX_ASSIGNEES;
  const allFilteredSelected =
    filteredIds.length > 0 &&
    filteredIds.every((id) => assigneeIds.includes(id));
  const selectedByDivision = useMemo(() => {
    const selected = new Set(assigneeIds);
    return divisionGroups
      .map((group) => ({
        id: group.id,
        name: group.name,
        count: group.people.filter((person) => selected.has(person.id)).length,
      }))
      .filter((group) => group.count > 0);
  }, [assigneeIds, divisionGroups]);
  const selectedDivisionCount = selectedByDivision.length;
  const selectedOutsideTeam = useMemo(() => {
    const teamIds = new Set(team.map((person) => person.id));
    return assigneeIds.filter((id) => !teamIds.has(id)).length;
  }, [assigneeIds, team]);

  function addAssignees(ids: string[]) {
    if (ids.length === 0) return;
    const next = [...new Set([...assigneeIds, ...ids])];
    if (next.length > MANUAL_WORK_MAX_ASSIGNEES) {
      toast.error(
        `Maksimal ${MANUAL_WORK_MAX_ASSIGNEES} pekerja per pekerjaan. Kurangi pilihan lain lebih dulu.`,
      );
      setAssigneeIds(next.slice(0, MANUAL_WORK_MAX_ASSIGNEES));
    } else {
      setAssigneeIds(next);
    }
    setErrors((current) => ({ ...current, assignees: undefined }));
  }

  function removeAssignees(ids: string[]) {
    const drop = new Set(ids);
    setAssigneeIds((current) => current.filter((id) => !drop.has(id)));
    setErrors((current) => ({ ...current, assignees: undefined }));
  }

  function togglePerson(id: string) {
    if (assigneeIds.includes(id)) removeAssignees([id]);
    else addAssignees([id]);
  }

  function toggleDivision(group: WorkerDivisionGroup) {
    const ids = group.people.map((person) => person.id);
    if (ids.every((id) => assigneeIds.includes(id))) removeAssignees(ids);
    else addAssignees(ids);
  }

  function toggleFiltered() {
    if (allFilteredSelected) removeAssignees(filteredIds);
    else addAssignees(filteredIds);
  }

  function validate() {
    const next: Errors = {};
    if (title.trim().length < 4) {
      next.title = "Nama pekerjaan minimal 4 karakter.";
    }
    if (description.trim().length < 10) {
      next.description = "Deskripsi minimal 10 karakter.";
    }
    if (!locationId) next.locationId = "Pilih lokasi pekerjaan.";
    if (!startDate) next.startDate = "Pilih tanggal mulai.";
    if (targetDate && startDate && targetDate < startDate) {
      next.targetDate = "Target selesai tidak boleh sebelum tanggal mulai.";
    }
    if (assigneeIds.length === 0) {
      next.assignees = "Pilih minimal satu pekerja.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    if (supervisorMissing) {
      const message =
        "Penanggung jawab belum aktif atau belum ditetapkan. Hubungi admin sebelum mencatat pekerjaan.";
      setServerError(message);
      toast.error(message);
      return;
    }
    if (noLocations) {
      const message =
        "Belum ada lokasi checklist yang tersedia. Tambahkan lokasi sebelum mencatat pekerjaan.";
      setServerError(message);
      toast.error(message);
      return;
    }
    if (!validate()) {
      toast.error("Periksa kembali data pekerjaan.");
      return;
    }

    setSubmitting(true);
    try {
      const base = {
        title: title.trim(),
        description: description.trim(),
        safetyName: safetyName.trim(),
        locationId,
        startDate,
        targetDate: targetDate || null,
        requiresDocumentation,
      };
      const response = await fetch(
        mode === "create" ? "/api/pekerjaan" : `/api/pekerjaan/${initial?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...base,
            assigneeIds,
            ...(canAssign ? { followUpId: followUpId || null } : {}),
          }),
        },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        id?: string;
        message?: string;
      };
      if (!response.ok) {
        setServerError(data.message ?? "Gagal menyimpan pekerjaan.");
        toast.error(data.message ?? "Gagal menyimpan pekerjaan.");
        return;
      }

      toast.success(
        data.message ??
          (mode === "create"
            ? canAssign
              ? "Pekerjaan dibuat."
              : "Pekerjaan dicatat."
            : "Pekerjaan diperbarui."),
      );
      const id = data.id ?? initial?.id;
      router.push(id ? `/pekerjaan/${id}` : "/pekerjaan");
      router.refresh();
    } catch {
      setServerError("Gagal menyimpan pekerjaan. Periksa koneksi lalu coba lagi.");
      toast.error("Gagal menyimpan pekerjaan. Periksa koneksi lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  const backHref =
    mode === "edit" && initial ? `/pekerjaan/${initial.id}` : "/pekerjaan";
  const followUpItems = [
    { value: "", label: "Tidak ditautkan" },
    ...followUps.map((item) => ({
      value: item.id,
      label: item.title,
    })),
  ];

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5 pb-24 xl:pb-0"
      noValidate
    >
      <PageHeader
        eyebrow="Pekerjaan harian"
        title={
          mode === "create"
            ? canAssign
              ? "Buat pekerjaan harian"
              : "Catat pekerjaan harian"
            : canAssign
              ? "Ubah pekerjaan harian"
              : "Ubah catatan pekerjaan"
        }
        description={
          canAssign
            ? "Catat pekerjaan harian dengan dokumentasi foto dan video. Satu pekerjaan boleh berlangsung beberapa hari."
            : "Catat pekerjaan yang kamu dan tim kerjakan. Satu pekerjaan boleh berlangsung beberapa hari."
        }
        action={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={backHref} />}
          >
            <ArrowLeft aria-hidden="true" />
            Kembali
          </Button>
        }
      />

      {noLocations && !supervisorMissing && (
        <InfoBanner tone="warning" icon={MapPin}>
          Belum ada lokasi checklist yang tersedia.{" "}
          {canAssign ? (
            <>
              Tambahkan lokasi di{" "}
              <Link
                href="/checklist/template#lokasi-baru"
                className="font-medium text-primary transition-colors hover:underline"
              >
                template checklist
              </Link>{" "}
              sebelum mencatat pekerjaan.
            </>
          ) : (
            "Hubungi admin atau penanggung jawab untuk menambahkan lokasi."
          )}
        </InfoBanner>
      )}

      {supervisorMissing && (
        <InfoBanner tone="warning" icon={AlertTriangle}>
          Penanggung jawab belum aktif atau belum ditetapkan. Hubungi admin
          sebelum mencatat pekerjaan.
        </InfoBanner>
      )}

      {serverError && (
        <InfoBanner tone="danger" icon={AlertTriangle}>
          {serverError}
        </InfoBanner>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Frame>
            <FrameHeader>
              <FrameTitle>Rincian pekerjaan</FrameTitle>
              <FrameDescription>
                Jelaskan pekerjaan dengan jelas agar pekerja memahami hasil yang
                diharapkan.
              </FrameDescription>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manual-work-title">
                  Nama pekerjaan <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="manual-work-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={140}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.title)}
                  placeholder="Contoh: Buat jalur kabel lantai 3"
                />
                <div className="flex items-start justify-between gap-2">
                  <FieldError>{errors.title}</FieldError>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {title.length}/140
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manual-work-description">
                  Deskripsi <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="manual-work-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  maxLength={2000}
                  aria-invalid={Boolean(errors.description)}
                  placeholder="Tujuan pekerjaan, langkah penting, dan hasil yang diharapkan…"
                />
                <div className="flex items-start justify-between gap-2">
                  <FieldError>{errors.description}</FieldError>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {description.length}/2.000
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manual-work-location">
                  Lokasi <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={locationId}
                  onValueChange={(value) => {
                    setLocationId(value as string);
                    setErrors((current) => ({
                      ...current,
                      locationId: undefined,
                    }));
                  }}
                  items={locationItems}
                  disabled={noLocations}
                >
                  <SelectTrigger
                    id="manual-work-location"
                    className="w-full"
                    aria-invalid={Boolean(errors.locationId)}
                  >
                    <SelectValue
                      placeholder={
                        noLocations ? "Belum ada lokasi" : "Pilih lokasi"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {locationItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {canAssign
                    ? "Daftar lokasi berasal dari template checklist milikmu."
                    : "Daftar lokasi mengikuti checklist penanggung jawab."}
                </p>
                <FieldError>{errors.locationId}</FieldError>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manual-work-safety">
                  Nama petugas safety
                </Label>
                <Input
                  id="manual-work-safety"
                  value={safetyName}
                  onChange={(event) => setSafetyName(event.target.value)}
                  maxLength={120}
                  autoComplete="off"
                  placeholder="Contoh: Budi Santoso"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Diisi manual bila ada petugas safety yang mendampingi.
                </p>
              </div>
            </FramePanel>
          </Frame>

          <Frame>
            <FrameHeader>
              <FrameTitle>Jadwal</FrameTitle>
              <FrameDescription>
                Satu pekerjaan boleh berlangsung beberapa hari. Target selesai
                bersifat opsional.
              </FrameDescription>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manual-work-start">
                    Tanggal mulai <span className="text-destructive">*</span>
                  </Label>
                  <DatePicker
                    id="manual-work-start"
                    value={startDate}
                    onChange={(value) => {
                      setStartDate(value);
                      setErrors((current) => ({
                        ...current,
                        startDate: undefined,
                      }));
                    }}
                    invalid={Boolean(errors.startDate)}
                    ariaDescribedBy={
                      errors.startDate ? "manual-work-start-error" : undefined
                    }
                  />
                  <FieldError id="manual-work-start-error">
                    {errors.startDate}
                  </FieldError>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="manual-work-target">Target selesai</Label>
                  <DatePicker
                    id="manual-work-target"
                    value={targetDate}
                    min={startDate || undefined}
                    onChange={(value) => {
                      setTargetDate(value);
                      setErrors((current) => ({
                        ...current,
                        targetDate: undefined,
                      }));
                    }}
                    invalid={Boolean(errors.targetDate)}
                    ariaDescribedBy={
                      errors.targetDate ? "manual-work-target-error" : undefined
                    }
                  />
                  <FieldError id="manual-work-target-error">
                    {errors.targetDate}
                  </FieldError>
                  {targetDate && (
                    <button
                      type="button"
                      className="w-fit text-xs font-medium text-primary transition-colors hover:underline"
                      onClick={() => setTargetDate("")}
                    >
                      Hapus target
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Label htmlFor="manual-work-documentation">
                    Wajib dokumentasi foto
                  </Label>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Minimal satu foto sebelum pekerjaan dapat diselesaikan.
                  </p>
                </div>
                <Switch
                  id="manual-work-documentation"
                  checked={requiresDocumentation}
                  onCheckedChange={setRequiresDocumentation}
                />
              </div>
            </FramePanel>
          </Frame>
        </div>

        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-20 xl:self-start">
          <Frame spacing="sm">
            <FrameHeader>
              <FrameTitle>Siapa yang bekerja</FrameTitle>
              <FrameDescription>
                {canAssign
                  ? "Pilih satu atau beberapa pekerja per divisi. Mereka dapat memulai, mengunggah bukti, dan menyelesaikan pekerjaan."
                  : "Pilih siapa saja yang ikut mengerjakan, bisa lebih dari satu. Kamu tercatat sebagai pelapor."}
              </FrameDescription>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              {!canAssign && (
                <>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={self.name} seed={self.id} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {self.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground tabular-nums">
                        {self.nik}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      Pelapor
                    </span>
                  </div>
                  {mode === "create" && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Penanggung jawab
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {self.supervisorName ?? "Belum tersedia"}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-border/70" />
                </>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    {assigneeIds.length}/{MANUAL_WORK_MAX_ASSIGNEES} dipilih
                  </span>
                  {selectedDivisionCount > 1 && (
                    <Badge variant="info-light">Lintas divisi</Badge>
                  )}
                </span>
                {assigneeIds.length > 0 && (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => removeAssignees(assigneeIds)}
                  >
                    Hapus pilihan
                  </Button>
                )}
              </div>

              {team.length === 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    {canAssign
                      ? "Belum ada pekerja aktif di timmu."
                      : "Belum ada pekerja yang bisa dipilih. Hubungi admin."}
                  </p>
                  {canAssign && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href="/tim" />}
                    >
                      <UsersRound aria-hidden="true" />
                      Kelola tim
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor="manual-work-worker-search"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Cari pekerja
                      </Label>
                      <InputGroup className="w-full">
                        <InputGroupAddon>
                          <Search aria-hidden="true" />
                        </InputGroupAddon>
                        <InputGroupInput
                          id="manual-work-worker-search"
                          value={personSearch}
                          onChange={(event) =>
                            setPersonSearch(event.target.value)
                          }
                          placeholder="Nama atau NIK…"
                        />
                        {personSearch && (
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton
                              type="button"
                              size="icon-xs"
                              onClick={() => setPersonSearch("")}
                              aria-label="Hapus pencarian pekerja"
                            >
                              <X aria-hidden="true" />
                            </InputGroupButton>
                          </InputGroupAddon>
                        )}
                      </InputGroup>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label
                        htmlFor="manual-work-division"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Divisi
                      </Label>
                      <Select
                        value={divisionFilter}
                        onValueChange={(value) =>
                          setDivisionFilter(value as string)
                        }
                        items={divisionItems}
                      >
                        <SelectTrigger
                          id="manual-work-division"
                          className="w-full"
                          aria-label="Filter pekerja berdasarkan divisi"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {divisionItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {filteredTotal} dari {team.length} pekerja
                      {normalizedQuery
                        ? ` cocok dengan “${personSearch.trim()}”`
                        : ""}
                    </p>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={toggleFiltered}
                      disabled={
                        filteredTotal === 0 ||
                        (atAssigneeCap && !allFilteredSelected)
                      }
                      title={
                        atAssigneeCap && !allFilteredSelected
                          ? `Batas ${MANUAL_WORK_MAX_ASSIGNEES} pekerja sudah tercapai.`
                          : undefined
                      }
                    >
                      {allFilteredSelected
                        ? "Kosongkan hasil"
                        : atAssigneeCap
                          ? `Batas ${MANUAL_WORK_MAX_ASSIGNEES} tercapai`
                          : `Pilih semua hasil (${filteredTotal})`}
                    </Button>
                  </div>

                  {selectedByDivision.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {selectedByDivision.map((group) => (
                        <Badge key={group.id} variant="outline">
                          {group.name} · {group.count}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {filteredGroups.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-md border border-border/70 px-3 py-4 text-center">
                      <p className="text-xs text-muted-foreground">
                        {normalizedQuery
                          ? "Tidak ada pekerja yang cocok. Coba kata kunci lain."
                          : "Tidak ada pekerja aktif di divisi ini."}
                      </p>
                      {normalizedQuery ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => setPersonSearch("")}
                        >
                          Hapus pencarian
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => setDivisionFilter("semua")}
                        >
                          Tampilkan semua divisi
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "overflow-y-auto",
                        filteredTotal > 8 && "h-80",
                      )}
                    >
                      {filteredGroups.map((group, index) => {
                        const selectedInGroup = group.people.filter((person) =>
                          assigneeIds.includes(person.id),
                        ).length;
                        const groupAllSelected =
                          selectedInGroup === group.people.length;
                        return (
                          <div
                            key={group.id}
                            className={
                              index > 0
                                ? "border-t border-border/70"
                                : undefined
                            }
                          >
                            <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-1.5">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-xs font-medium text-foreground">
                                  {group.name}
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                  {selectedInGroup}/{group.people.length}
                                </span>
                              </span>
                              <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                onClick={() => toggleDivision(group)}
                                disabled={
                                  atAssigneeCap && !groupAllSelected
                                }
                                aria-label={`${
                                  groupAllSelected ? "Kosongkan" : "Pilih semua"
                                } ${group.name}`}
                                title={
                                  atAssigneeCap && !groupAllSelected
                                    ? `Batas ${MANUAL_WORK_MAX_ASSIGNEES} pekerja sudah tercapai.`
                                    : undefined
                                }
                              >
                                {groupAllSelected ? "Kosongkan" : "Pilih semua"}
                              </Button>
                            </div>
                            <div className="flex flex-col gap-0.5 p-1.5">
                              {group.people.map((person) => {
                                const checked = assigneeIds.includes(person.id);
                                return (
                                  <Label
                                    key={person.id}
                                    className={cn(
                                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal text-foreground transition-colors hover:bg-muted/60",
                                      checked && "bg-primary/5",
                                    )}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={() =>
                                        togglePerson(person.id)
                                      }
                                      disabled={!checked && atAssigneeCap}
                                      aria-label={`Pilih ${person.name}`}
                                    />
                                    <Avatar
                                      name={person.name}
                                      seed={person.id}
                                      size="xs"
                                    />
                                    <span className="min-w-0 flex-1 truncate">
                                      {person.name}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                      {person.nik}
                                    </span>
                                  </Label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Pilihan tetap tersimpan saat kamu mengganti divisi atau
                    pencarian. Maksimal {MANUAL_WORK_MAX_ASSIGNEES} pekerja per
                    pekerjaan.
                  </p>
                  {selectedOutsideTeam > 0 && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {selectedOutsideTeam} pekerja terpilih sudah tidak ada di
                      daftar tim aktif. Pilihan lama tetap disimpan.
                    </p>
                  )}
                </>
              )}
              <FieldError>{errors.assignees}</FieldError>
            </FramePanel>
            <FrameFooter className="hidden xl:flex">
              <Button
                type="submit"
                disabled={submitting || supervisorMissing || noLocations}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Spinner />
                    Menyimpan…
                  </>
                ) : mode === "create" ? (
                  <>
                    <Send aria-hidden="true" />
                    {canAssign ? "Buat pekerjaan" : "Catat pekerjaan"}
                  </>
                ) : (
                  <>
                    <Save aria-hidden="true" />
                    Simpan perubahan
                  </>
                )}
              </Button>
            </FrameFooter>
          </Frame>

          {canAssign && (
            <Frame spacing="sm">
              <FrameHeader>
                <FrameTitle>Tindak lanjut</FrameTitle>
                <FrameDescription>
                  Opsional. Tautkan bila pekerjaan ini menindaklanjuti temuan
                  checklist.
                </FrameDescription>
              </FrameHeader>
              <FramePanel className="flex flex-col gap-2">
                <Select
                  value={followUpId}
                  onValueChange={(value) => setFollowUpId(value as string)}
                  items={followUpItems}
                >
                  <SelectTrigger
                    id="manual-work-follow-up"
                    className="w-full"
                    aria-label="Tautkan tindak lanjut"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {followUpItems.map((item) => (
                      <SelectItem key={item.value || "none"} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {followUps.length === 0 ? (
                  <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <ListChecks
                      className="mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    Tidak ada tindak lanjut terbuka yang belum ditautkan.
                  </p>
                ) : (
                  <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <CheckCircle2
                      className="mt-0.5 size-3.5 shrink-0 text-success"
                      aria-hidden="true"
                    />
                    Tautan hanya menghubungkan konteks; status tindak lanjut tidak
                    berubah otomatis.
                  </p>
                )}
              </FramePanel>
            </Frame>
          )}

          <Frame spacing="sm">
            <FramePanel className="flex flex-col gap-1.5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Camera className="size-3.5 text-primary" aria-hidden="true" />
                Dokumentasi privat
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Foto disimpan privat dan hanya dapat diakses pemilik pekerjaan,
                pelapor, serta pekerja yang ditugaskan.
              </p>
            </FramePanel>
          </Frame>
        </aside>
      </div>

      <div className="mobile-action-bar fixed inset-x-0 z-30 border-t border-border bg-background px-4 pt-2.5 xl:hidden">
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={backHref} />}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={submitting || supervisorMissing || noLocations}
            className="flex-[1.4]"
          >
            {submitting ? (
              <>
                <Spinner />
                Menyimpan…
              </>
            ) : mode === "create" ? (
              <>
                <Send aria-hidden="true" />
                {canAssign ? "Buat" : "Catat"}
              </>
            ) : (
              <>
                <Save aria-hidden="true" />
                Simpan
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
