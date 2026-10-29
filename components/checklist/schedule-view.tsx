"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Clock3,
  Pencil,
  Plus,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui";
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
import { Modal } from "@/components/modal";
import {
  CHECKLIST_INTERVAL_UNIT_LABEL,
  CHECKLIST_MAX_ASSIGNEES,
  type ChecklistIntervalUnit,
  type ChecklistSetup,
  type ChecklistSetupEmployee,
  type ChecklistSetupSchedule,
} from "@/lib/checklist-types";
import { checklistIntervalLabel } from "@/lib/checklist-schedule";
import { formatDateHuman, todayLocal } from "@/lib/time";

function dateIso(date: string) {
  return `${date}T00:00:00+07:00`;
}

interface DivisionGroup {
  id: string;
  name: string;
  people: ChecklistSetupEmployee[];
}

const MEMBER_PREVIEW = 20;

function groupEmployeesByDivision(
  employees: ChecklistSetupEmployee[],
): DivisionGroup[] {
  const groups = new Map<string, DivisionGroup>();
  for (const person of employees) {
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

function scheduleAssigneesLabel(assignees: ChecklistSetupEmployee[]) {
  if (assignees.length === 0) return "Belum ada anggota";
  const divisions = [
    ...new Set(assignees.map((person) => person.divisionName ?? "Tanpa divisi")),
  ];
  return `${assignees.length} anggota · ${
    divisions.length > 1 ? "lintas divisi" : divisions[0]
  }`;
}

function initialDivisionFilter(
  schedule: ChecklistSetupSchedule | null,
  groups: DivisionGroup[],
) {
  const assigneeDivisions = schedule
    ? [
        ...new Set(
          schedule.assignees.map((person) => person.divisionId ?? "tanpa"),
        ),
      ]
    : [];
  if (
    assigneeDivisions.length === 1 &&
    groups.some((group) => group.id === assigneeDivisions[0])
  ) {
    return assigneeDivisions[0];
  }
  if (assigneeDivisions.length > 1) return "semua";
  return groups[0]?.id ?? "semua";
}

export function ChecklistScheduleView({ setup }: { setup: ChecklistSetup }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistSetupSchedule | null>(null);

  function openSchedule(schedule: ChecklistSetupSchedule | null) {
    setEditing(schedule);
    setDialogOpen(true);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 lg:gap-8">
      <div className="hidden md:block">
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={<Link href="/checklist" />}
        >
          <ArrowLeft aria-hidden="true" />
          Checklist
        </Button>
      </div>

      <PageHeader
        eyebrow="Pengaturan checklist"
        title="Jadwal"
        description="Checklist otomatis sesuai kalender dan penugasan tim."
        descriptionClassName="hidden md:block"
        action={
          <Button type="button" size="sm" onClick={() => openSchedule(null)}>
            <Plus aria-hidden="true" />
            Jadwal baru
          </Button>
        }
      />

      <Frame spacing="default" className="min-w-0">
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Jadwal checklist</FrameTitle>
            <FrameDescription className="hidden text-xs md:block">
              Template, lokasi, dan anggota yang ditugaskan.
            </FrameDescription>
          </div>
          <Badge variant="outline" className="tabular-nums">
            {setup.schedules.length}
          </Badge>
        </FrameHeader>

        <FramePanel className="p-0">
          {setup.schedules.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Belum ada jadwal"
              description="Buat jadwal dari template dan lokasi yang tersedia. Checklist akan muncul otomatis sesuai kalender."
              action={
                setup.templates.length > 0 && setup.locations.length > 0 ? (
                  <Button type="button" size="sm" onClick={() => openSchedule(null)}>
                    <Plus aria-hidden="true" />
                    Buat jadwal
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/checklist/template" />}
                  >
                    <CalendarClock aria-hidden="true" />
                    Siapkan template & lokasi
                  </Button>
                )
              }
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {setup.schedules.map((schedule) => (
                <li
                  key={schedule.id}
                  className="flex flex-col gap-2.5 px-4 py-4 sm:px-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground">
                          {schedule.templateName}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {checklistIntervalLabel(
                            schedule.intervalUnit,
                            schedule.intervalCount,
                          )}
                        </Badge>
                        {!schedule.active && (
                          <Badge variant="warning-light">
                            Nonaktif
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {schedule.locationPath}
                        <span className="hidden md:inline">
                          {" · mulai "}
                          {formatDateHuman(dateIso(schedule.anchorDate), "d MMM yyyy")}
                        </span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => openSchedule(schedule)}
                    >
                      <Pencil aria-hidden="true" />
                      Ubah
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                      Berikutnya{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {schedule.nextOccurrence
                          ? formatDateHuman(
                              dateIso(schedule.nextOccurrence),
                              "d MMM yyyy",
                            )
                          : "—"}
                      </span>
                    </span>
                    <span
                      className="inline-flex min-w-0 items-center gap-1.5"
                      title={schedule.assignees
                        .map(
                          (person) =>
                            `${person.name} — ${person.divisionName ?? "Tanpa divisi"}`,
                        )
                        .join(", ")}
                    >
                      <UsersRound
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {scheduleAssigneesLabel(schedule.assignees)}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      Deadline +{schedule.dueDays} hari
                    </span>
                  </div>

                  {schedule.assignees.length > 0 && (
                    <div className="hidden items-center md:flex">
                      {schedule.assignees.slice(0, 6).map((person, index) => (
                        <span
                          key={person.id}
                          className={index > 0 ? "-ml-2" : undefined}
                        >
                          <Avatar
                            name={person.name}
                            seed={person.id}
                            size="xs"
                            className="ring-2 ring-card"
                          />
                        </span>
                      ))}
                      {schedule.assignees.length > 6 && (
                        <span className="-ml-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-card">
                          +{schedule.assignees.length - 6}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <ScheduleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        schedule={editing}
        setup={setup}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function ScheduleDialog({
  open,
  onClose,
  schedule,
  setup,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  schedule: ChecklistSetupSchedule | null;
  setup: ChecklistSetup;
  onSaved: () => void;
}) {
  const [templateId, setTemplateId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [intervalUnit, setIntervalUnit] =
    useState<ChecklistIntervalUnit>("minggu");
  const [intervalCount, setIntervalCount] = useState(1);
  const [anchorDate, setAnchorDate] = useState(todayLocal());
  const [dueDays, setDueDays] = useState(1);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [divisionFilter, setDivisionFilter] = useState("semua");
  const [memberQuery, setMemberQuery] = useState("");
  const [groupLimits, setGroupLimits] = useState<Record<string, number>>({});
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTemplateId(schedule?.templateId ?? setup.templates[0]?.id ?? "");
    setLocationId(schedule?.locationId ?? setup.locations[0]?.id ?? "");
    setIntervalUnit(schedule?.intervalUnit ?? "minggu");
    setIntervalCount(schedule?.intervalCount ?? 1);
    setAnchorDate(schedule?.anchorDate ?? todayLocal());
    setDueDays(schedule?.dueDays ?? 1);
    setAssigneeIds(schedule?.assignees.map((person) => person.id) ?? []);
    setDivisionFilter(
      initialDivisionFilter(schedule, groupEmployeesByDivision(setup.employees)),
    );
    setMemberQuery("");
    setGroupLimits({});
    setActive(schedule?.active ?? true);
  }, [open, schedule, setup]);

  const templateItems = setup.templates
    .filter((template) => template.active)
    .map((template) => ({
      value: template.id,
      label: `${template.name} (versi ${template.currentVersion})`,
    }));
  const locationItems = setup.locations
    .filter((location) => location.active)
    .map((location) => ({
      value: location.id,
      label: location.path ?? location.name,
    }));
  const unitItems = (
    ["hari", "minggu", "bulan"] as ChecklistIntervalUnit[]
  ).map((unit) => ({
    value: unit,
    label: CHECKLIST_INTERVAL_UNIT_LABEL[unit],
  }));

  const divisionGroups = useMemo(
    () => groupEmployeesByDivision(setup.employees),
    [setup.employees],
  );
  const divisionItems = useMemo(
    () => [
      { value: "semua", label: `Semua divisi (${setup.employees.length})` },
      ...divisionGroups.map((group) => ({
        value: group.id,
        label: `${group.name} (${group.people.length})`,
      })),
    ],
    [divisionGroups, setup.employees.length],
  );
  const normalizedQuery = memberQuery.trim().toLowerCase();
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
          `${person.name} ${person.nik ?? ""}`
            .toLowerCase()
            .includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.people.length > 0);
  }, [divisionFilter, divisionGroups, normalizedQuery]);
  const filteredTotal = useMemo(
    () =>
      filteredGroups.reduce((total, group) => total + group.people.length, 0),
    [filteredGroups],
  );
  const filteredIds = useMemo(
    () =>
      filteredGroups.flatMap((group) =>
        group.people.map((person) => person.id),
      ),
    [filteredGroups],
  );
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
  const atAssigneeCap = assigneeIds.length >= CHECKLIST_MAX_ASSIGNEES;

  function addAssignees(ids: string[]) {
    if (ids.length === 0) return;
    const next = [...new Set([...assigneeIds, ...ids])];
    if (next.length > CHECKLIST_MAX_ASSIGNEES) {
      toast.error(
        `Maksimal ${CHECKLIST_MAX_ASSIGNEES} anggota per jadwal. Kurangi pilihan atau bagi ke beberapa jadwal.`,
      );
      setAssigneeIds(next.slice(0, CHECKLIST_MAX_ASSIGNEES));
      return;
    }
    setAssigneeIds(next);
  }

  function removeAssignees(ids: string[]) {
    const drop = new Set(ids);
    setAssigneeIds((current) => current.filter((id) => !drop.has(id)));
  }

  function toggleAssignee(id: string) {
    if (assigneeIds.includes(id)) removeAssignees([id]);
    else addAssignees([id]);
  }

  function toggleDivision(group: DivisionGroup) {
    const ids = group.people.map((person) => person.id);
    if (ids.every((id) => assigneeIds.includes(id))) removeAssignees(ids);
    else addAssignees(ids);
  }

  function toggleFiltered() {
    if (allFilteredSelected) removeAssignees(filteredIds);
    else addAssignees(filteredIds);
  }

  async function submit() {
    if (!templateId) {
      toast.error("Pilih template.");
      return;
    }
    if (!locationId) {
      toast.error("Pilih lokasi.");
      return;
    }
    if (assigneeIds.length === 0) {
      toast.error("Pilih minimal satu anggota tim.");
      return;
    }
    if (assigneeIds.length > CHECKLIST_MAX_ASSIGNEES) {
      toast.error(
        `Maksimal ${CHECKLIST_MAX_ASSIGNEES} anggota per jadwal. Kurangi pilihan lalu simpan.`,
      );
      return;
    }
    if (!Number.isInteger(intervalCount) || intervalCount < 1) {
      toast.error("Interval minimal 1.");
      return;
    }
    if (!Number.isInteger(dueDays) || dueDays < 0) {
      toast.error("Deadline minimal 0 hari.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        schedule
          ? `/api/checklist/schedules/${schedule.id}`
          : "/api/checklist/schedules",
        {
          method: schedule ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId,
            locationId,
            intervalUnit,
            intervalCount,
            anchorDate,
            dueDays,
            assigneeIds,
            active,
          }),
        },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        generated?: number;
      };
      if (!response.ok) {
        toast.error(data.message ?? "Gagal menyimpan jadwal.");
        return;
      }
      toast.success(
        data.generated
          ? `${data.message ?? "Jadwal disimpan."} ${data.generated} checklist dibuat.`
          : (data.message ?? "Jadwal disimpan."),
      );
      onClose();
      onSaved();
    } catch {
      toast.error("Gagal menyimpan jadwal. Periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={schedule ? "Ubah jadwal" : "Jadwal baru"}
      description="Perubahan anggota berlaku untuk checklist terbuka, bukan riwayat selesai."
      size="xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            Batal
          </Button>
          <Button type="button" size="sm" onClick={submit} disabled={saving}>
            {saving ? <Spinner /> : <CalendarClock aria-hidden="true" />}
            {saving ? "Menyimpan…" : "Simpan jadwal"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-template">Template</Label>
            <Select
              value={templateId}
              onValueChange={(value) => setTemplateId(value as string)}
              items={templateItems}
            >
              <SelectTrigger id="schedule-template" className="w-full">
                <SelectValue placeholder="Pilih template" />
              </SelectTrigger>
              <SelectContent>
                {templateItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-location">Lokasi</Label>
            <Select
              value={locationId}
              onValueChange={(value) => setLocationId(value as string)}
              items={locationItems}
            >
              <SelectTrigger id="schedule-location" className="w-full">
                <SelectValue placeholder="Pilih lokasi" />
              </SelectTrigger>
              <SelectContent>
                {locationItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-interval-count">Setiap</Label>
            <Input
              id="schedule-interval-count"
              type="number"
              min={1}
              max={365}
              step={1}
              value={intervalCount}
              onChange={(event) =>
                setIntervalCount(Number(event.target.value) || 1)
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-interval-unit">Satuan</Label>
            <Select
              value={intervalUnit}
              onValueChange={(value) =>
                setIntervalUnit(value as ChecklistIntervalUnit)
              }
              items={unitItems}
            >
              <SelectTrigger id="schedule-interval-unit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unitItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-due-days">Deadline (hari)</Label>
            <Input
              id="schedule-due-days"
              type="number"
              min={0}
              max={90}
              step={1}
              value={dueDays}
              onChange={(event) =>
                setDueDays(Number(event.target.value) || 0)
              }
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {checklistIntervalLabel(intervalUnit, intervalCount)}; deadline +{dueDays} hari.
          Jadwal berikutnya tetap meski terlambat. Tanggal 29–31 mengikuti akhir bulan.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="schedule-anchor">Tanggal mulai</Label>
          <Input
            id="schedule-anchor"
            type="date"
            value={anchorDate}
            onChange={(event) => setAnchorDate(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label>Anggota tim</Label>
              {selectedDivisionCount > 1 && (
                <Badge variant="info-light">Lintas divisi</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {assigneeIds.length}/{CHECKLIST_MAX_ASSIGNEES} dipilih
              {selectedDivisionCount > 1
                ? ` · ${selectedDivisionCount} divisi`
                : ""}
            </span>
          </div>
          {setup.employees.length === 0 ? (
            <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Belum ada anggota tim aktif. Tambahkan anggota lebih dulu di menu
              Tim.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <InputGroup className="w-full sm:max-w-72">
                  <InputGroupAddon>
                    <Search aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={memberQuery}
                    onChange={(event) => setMemberQuery(event.target.value)}
                    placeholder="Cari nama atau NIK…"
                    aria-label="Cari anggota tim"
                  />
                  {memberQuery && (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="icon-xs"
                        onClick={() => setMemberQuery("")}
                        aria-label="Hapus pencarian anggota"
                      >
                        <X aria-hidden="true" />
                      </InputGroupButton>
                    </InputGroupAddon>
                  )}
                </InputGroup>
                <Select
                  value={divisionFilter}
                  onValueChange={(value) =>
                    setDivisionFilter(value as string)
                  }
                  items={divisionItems}
                >
                  <SelectTrigger
                    id="schedule-division"
                    aria-label="Filter anggota berdasarkan divisi"
                    className="w-full sm:w-56"
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

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {filteredTotal} dari {setup.employees.length} anggota
                  {normalizedQuery ? ` cocok dengan “${memberQuery.trim()}”` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  {assigneeIds.length > 0 && (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => setAssigneeIds([])}
                    >
                      Hapus pilihan
                    </Button>
                  )}
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
                        ? `Batas ${CHECKLIST_MAX_ASSIGNEES} anggota per jadwal sudah tercapai.`
                        : undefined
                    }
                  >
                    {allFilteredSelected
                      ? "Kosongkan hasil"
                      : atAssigneeCap
                        ? `Batas ${CHECKLIST_MAX_ASSIGNEES} tercapai`
                        : `Pilih semua hasil (${filteredTotal})`}
                  </Button>
                </div>
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

              <div className="max-h-64 overflow-y-auto rounded-lg border border-border/70">
                {filteredGroups.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-3 py-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      {normalizedQuery
                        ? "Tidak ada anggota yang cocok. Coba kata kunci lain."
                        : "Tidak ada anggota aktif di divisi ini."}
                    </p>
                    {normalizedQuery ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => setMemberQuery("")}
                      >
                        Hapus pencarian
                      </Button>
                    ) : divisionFilter !== "semua" ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => setDivisionFilter("semua")}
                      >
                        Tampilkan semua divisi
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  filteredGroups.map((group, index) => {
                    const selectedInGroup = group.people.filter((person) =>
                      assigneeIds.includes(person.id),
                    ).length;
                    const allSelected =
                      selectedInGroup === group.people.length;
                    const limit = normalizedQuery
                      ? group.people.length
                      : (groupLimits[group.id] ?? MEMBER_PREVIEW);
                    const shown = group.people.slice(0, limit);
                    const remaining = group.people.length - shown.length;
                    return (
                      <div
                        key={group.id}
                        className={
                          index > 0 ? "border-t border-border/70" : undefined
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
                            disabled={atAssigneeCap && !allSelected}
                            title={
                              atAssigneeCap && !allSelected
                                ? `Batas ${CHECKLIST_MAX_ASSIGNEES} anggota per jadwal sudah tercapai.`
                                : undefined
                            }
                          >
                            {allSelected ? "Kosongkan" : "Pilih semua"}
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
                          {shown.map((person) => {
                            const checked = assigneeIds.includes(person.id);
                            return (
                              <Label
                                key={person.id}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal text-foreground transition-colors hover:bg-muted/60"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() =>
                                    toggleAssignee(person.id)
                                  }
                                />
                                <Avatar
                                  name={person.name}
                                  seed={person.id}
                                  size="xs"
                                />
                                <span className="min-w-0 flex-1 truncate">
                                  {person.name}
                                </span>
                                {person.nik && (
                                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                    {person.nik}
                                  </span>
                                )}
                              </Label>
                            );
                          })}
                        </div>
                        {remaining > 0 && (
                          <div className="sticky bottom-0 border-t border-border/70 bg-background px-2 py-1.5">
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              className="w-full"
                              onClick={() =>
                                setGroupLimits((current) => ({
                                  ...current,
                                  [group.id]: limit + MEMBER_PREVIEW,
                                }))
                              }
                            >
                              Tampilkan{" "}
                              {Math.min(MEMBER_PREVIEW, remaining)} lagi (
                              {remaining} tersisa)
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Pilihan lintas divisi tetap tersimpan. Maksimal{" "}
                {CHECKLIST_MAX_ASSIGNEES} anggota per jadwal.
              </p>
            </div>
          )}
        </div>

        {schedule && (
          <Label className="flex items-center gap-2 text-sm font-normal text-foreground">
            <Checkbox
              checked={active}
              onCheckedChange={(checked) => setActive(checked === true)}
            />
            Jadwal aktif
          </Label>
        )}
      </div>
    </Modal>
  );
}
