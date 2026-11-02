"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  Clock3,
  MapPin,
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
import { MobileFab } from "@/components/mobile-fab";
import {
  Avatar,
  BackLink,
  Badge,
  EmptyState,
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
import { DatePicker } from "@/components/date-picker";
import { Modal } from "@/components/modal";
import { TimeField } from "@/components/time-field";
import {
  CHECKLIST_INTERVAL_UNIT_LABEL,
  CHECKLIST_MAX_ASSIGNEES,
  CHECKLIST_WEEKDAY_LABEL,
  defaultChecklistScheduleDays,
  type ChecklistDistributionMode,
  type ChecklistIntervalUnit,
  type ChecklistLocation,
  type ChecklistScheduleDay,
  type ChecklistSetup,
  type ChecklistSetupEmployee,
  type ChecklistSetupSchedule,
  type ChecklistSetupTemplate,
  type ChecklistTemplateItem,
} from "@/lib/checklist-types";
import {
  checklistDueFor,
  checklistIntervalLabel,
  checklistOpensAt,
  checklistScheduleDaysSummary,
  resolvedScheduleDays,
  scheduleDayFor,
  scheduleOccurrences,
  shiftDate,
  weekdayOf,
} from "@/lib/checklist-schedule";
import { avatarUrl } from "@/lib/avatar-url";
import { formatDateHuman, todayLocal } from "@/lib/time";
import { cn } from "@/lib/utils";

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

interface TemplateLeafLocation {
  /** Lokasi efektif item: lokasi item, lalu lokasi grup induk. */
  locationId: string | null;
}

function templateLeafLocations(
  items: ChecklistTemplateItem[],
): TemplateLeafLocation[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return items
    .filter((item) => item.itemType === "item")
    .map((item) => {
      const parent = item.parentItemId
        ? byId.get(item.parentItemId)
        : null;
      return {
        locationId: item.locationId ?? parent?.locationId ?? null,
      };
    });
}

function templateHasItemLocations(template: ChecklistSetupTemplate | null) {
  const latest = template?.versions[0];
  if (!latest) return false;
  return templateLeafLocations(latest.items).some((leaf) =>
    Boolean(leaf.locationId),
  );
}

function defaultDistributionModeForTemplate(
  template: ChecklistSetupTemplate | null,
): ChecklistDistributionMode {
  return templateHasItemLocations(template) ? "per_lokasi" : "tunggal";
}

function commonAncestorLocationId(
  locationIds: string[],
  locations: ChecklistLocation[],
) {
  if (locationIds.length === 0) return null;
  const byId = new Map(locations.map((location) => [location.id, location]));
  const chains = locationIds.map((id) => {
    const chain: string[] = [];
    const seen = new Set<string>();
    let current = byId.get(id);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      chain.unshift(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return chain;
  });
  const [first, ...rest] = chains;
  if (!first || first.length === 0) return null;
  let ancestor: string | null = null;
  for (let index = 0; index < first.length; index += 1) {
    if (!rest.every((chain) => chain[index] === first[index])) break;
    ancestor = first[index];
  }
  return ancestor;
}

function fallbackLocationForTemplate(
  locationIds: string[],
  locations: ChecklistLocation[],
  preferredId: string,
) {
  const activeIds = new Set(
    locations
      .filter((location) => location.active)
      .map((location) => location.id),
  );
  const ancestor = commonAncestorLocationId(locationIds, locations);
  if (ancestor && activeIds.has(ancestor)) return ancestor;
  const firstLocated = locationIds.find((id) => activeIds.has(id));
  if (firstLocated) return firstLocated;
  if (preferredId && activeIds.has(preferredId)) return preferredId;
  return locations.find((location) => location.active)?.id ?? "";
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
      <BackLink href="/checklist">Kembali ke Checklist</BackLink>

      <PageHeader
        mobileCompact
        eyebrow="Pengaturan checklist"
        title="Jadwal"
        description="Checklist otomatis sesuai kalender dan penugasan tim."
        descriptionClassName="hidden md:block"
        action={
          <div className="max-md:hidden">
            <Button type="button" size="sm" onClick={() => openSchedule(null)}>
              <Plus aria-hidden="true" />
              Jadwal baru
            </Button>
          </div>
        }
      />

      <Frame spacing="default" className="min-w-0">
        <div className="hidden md:block">
          <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Jadwal checklist</FrameTitle>
              <FrameDescription className="text-xs">
                Template, lokasi, dan anggota yang ditugaskan.
              </FrameDescription>
            </div>
            <Badge variant="outline" className="tabular-nums">
              {setup.schedules.length}
            </Badge>
          </FrameHeader>
        </div>

        <FramePanel className="p-0">
          {setup.schedules.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Belum ada jadwal"
              description="Buat jadwal dari template dan lokasi yang tersedia. Checklist akan muncul otomatis sesuai kalender."
              action={
                setup.templates.length > 0 && setup.locations.length > 0 ? (
                  <div className="max-md:hidden">
                    <Button type="button" size="sm" onClick={() => openSchedule(null)}>
                      <Plus aria-hidden="true" />
                      Buat jadwal
                    </Button>
                  </div>
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
                        {schedule.distributionMode === "per_lokasi" && (
                          <Badge variant="info-light" className="text-xs">
                            Per lokasi item · {schedule.distribution.length} lokasi
                          </Badge>
                        )}
                        {!schedule.active && (
                          <Badge variant="warning-light">
                            Nonaktif
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {schedule.distributionMode === "per_lokasi"
                          ? "Satu paket pemeriksaan per periode"
                          : schedule.locationPath}
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
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <CalendarClock
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {checklistScheduleDaysSummary(schedule.days)}
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
                            src={avatarUrl(person.id, person.avatarKey)}
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

      <MobileFab onClick={() => openSchedule(null)}>
        <Plus aria-hidden="true" />
        Jadwal baru
      </MobileFab>

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
  const [distributionMode, setDistributionMode] =
    useState<ChecklistDistributionMode>("tunggal");
  const [intervalUnit, setIntervalUnit] =
    useState<ChecklistIntervalUnit>("minggu");
  const [intervalCount, setIntervalCount] = useState(1);
  const [anchorDate, setAnchorDate] = useState(todayLocal());
  const [dueDays, setDueDays] = useState(1);
  const [days, setDays] = useState<ChecklistScheduleDay[]>(
    defaultChecklistScheduleDays,
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [divisionFilter, setDivisionFilter] = useState("semua");
  const [memberQuery, setMemberQuery] = useState("");
  const [groupLimits, setGroupLimits] = useState<Record<string, number>>({});
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initialTemplateId =
      schedule?.templateId ?? setup.templates[0]?.id ?? "";
    const initialTemplate =
      setup.templates.find((template) => template.id === initialTemplateId) ??
      null;
    setTemplateId(initialTemplateId);
    setLocationId(schedule?.locationId ?? setup.locations[0]?.id ?? "");
    setDistributionMode(
      schedule?.distributionMode ??
        defaultDistributionModeForTemplate(initialTemplate),
    );
    setIntervalUnit(schedule?.intervalUnit ?? "minggu");
    setIntervalCount(schedule?.intervalCount ?? 1);
    setAnchorDate(schedule?.anchorDate ?? todayLocal());
    setDueDays(schedule?.dueDays ?? 1);
    setDays(
      schedule?.days?.length
        ? resolvedScheduleDays(schedule.days)
        : defaultChecklistScheduleDays(),
    );
    setAssigneeIds(schedule?.assignees.map((person) => person.id) ?? []);
    setDivisionFilter(
      initialDivisionFilter(schedule, groupEmployeesByDivision(setup.employees)),
    );
    setMemberQuery("");
    setGroupLimits({});
    setActive(schedule?.active ?? true);
  }, [open, schedule, setup]);

  const selectedTemplate = useMemo(
    () => setup.templates.find((template) => template.id === templateId) ?? null,
    [setup.templates, templateId],
  );
  const leafLocations = useMemo(() => {
    const latest = selectedTemplate?.versions[0];
    return latest ? templateLeafLocations(latest.items) : [];
  }, [selectedTemplate]);
  const unlocatedItemCount = leafLocations.filter(
    (leaf) => !leaf.locationId,
  ).length;
  const locatedItemCount = leafLocations.length - unlocatedItemCount;
  const locatedLocationIds = useMemo(
    () =>
      leafLocations.flatMap((leaf) =>
        leaf.locationId ? [leaf.locationId] : [],
      ),
    [leafLocations],
  );
  const distinctLocatedLocationIds = useMemo(
    () => [...new Set(locatedLocationIds)],
    [locatedLocationIds],
  );
  const singleLocatedLocationId =
    distinctLocatedLocationIds.length === 1
      ? distinctLocatedLocationIds[0]
      : null;
  const singleLocatedLocationActive = Boolean(
    singleLocatedLocationId &&
      setup.locations.find(
        (location) => location.id === singleLocatedLocationId,
      )?.active,
  );
  const fallbackLocationId = useMemo(
    () =>
      fallbackLocationForTemplate(
        locatedLocationIds,
        setup.locations,
        locationId,
      ),
    [locatedLocationIds, locationId, setup.locations],
  );
  const hideBaseLocation =
    leafLocations.length > 0 &&
    unlocatedItemCount === 0 &&
    (distributionMode === "per_lokasi" ||
      (!schedule && singleLocatedLocationActive));
  const effectiveLocationId = hideBaseLocation
    ? fallbackLocationId
    : locationId;
  const fallbackLocationPath = useMemo(() => {
    const location = setup.locations.find(
      (item) => item.id === fallbackLocationId,
    );
    return location?.path ?? location?.name ?? null;
  }, [fallbackLocationId, setup.locations]);

  useEffect(() => {
    if (!open || !hideBaseLocation || !fallbackLocationId) return;
    setLocationId((current) =>
      current === fallbackLocationId ? current : fallbackLocationId,
    );
  }, [fallbackLocationId, hideBaseLocation, open]);

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
  const distributionItems: Array<{
    value: ChecklistDistributionMode;
    label: string;
  }> = [
    { value: "tunggal", label: "Satu pemeriksaan" },
    { value: "per_lokasi", label: "Pisah per lokasi item" },
  ];

  const distributionPreview = useMemo(() => {
    const counts = new Map<string, number>();
    for (const leaf of leafLocations) {
      const targetId = leaf.locationId ?? effectiveLocationId;
      if (!targetId) continue;
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
    }
    const paths = new Map(
      setup.locations.map((location) => [
        location.id,
        location.path ?? location.name,
      ]),
    );
    return [...counts.entries()]
      .map(([id, itemCount]) => ({
        id,
        path: paths.get(id) ?? "Lokasi jadwal",
        itemCount,
      }))
      .sort((left, right) => left.path.localeCompare(right.path, "id"));
  }, [effectiveLocationId, leafLocations, setup.locations]);

  const scheduleWindowPreview = useMemo(() => {
    const resolved = resolvedScheduleDays(days);
    const from = todayLocal();
    const [nextDate] = scheduleOccurrences(
      {
        anchorDate,
        intervalUnit,
        intervalCount,
        active: true,
        days: resolved,
      },
      from,
      shiftDate(from, 366),
    );
    if (!nextDate) return null;
    const day = scheduleDayFor(resolved, nextDate);
    if (!day?.enabled) return null;
    return {
      opensAt: checklistOpensAt(nextDate, day.startTime),
      dueAt: checklistDueFor(nextDate, dueDays, resolved).dueAt,
    };
  }, [anchorDate, days, dueDays, intervalCount, intervalUnit]);

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

  function updateDay(
    weekday: ChecklistScheduleDay["weekday"],
    patch: Partial<Omit<ChecklistScheduleDay, "weekday">>,
  ) {
    setDays((current) =>
      current.map((day) =>
        day.weekday === weekday ? { ...day, ...patch } : day,
      ),
    );
  }

  function applyDayPreset(preset: "mon-sat" | "all") {
    setDays((current) =>
      current.map((day) => ({
        ...day,
        enabled: preset === "all" || day.weekday !== 7,
      })),
    );
  }

  async function submit() {
    if (!templateId) {
      toast.error("Pilih template.");
      return;
    }
    const locationIdToSave = hideBaseLocation
      ? fallbackLocationId
      : locationId;
    if (!locationIdToSave) {
      toast.error(
        hideBaseLocation
          ? "Belum ada lokasi aktif untuk dijadikan cadangan. Aktifkan lokasi terlebih dahulu."
          : "Pilih lokasi.",
      );
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
    const activeDays = days.filter((day) => day.enabled);
    if (activeDays.length === 0) {
      toast.error("Aktifkan minimal satu hari pengisian.");
      return;
    }
    const invalidDay = activeDays.find(
      (day) => day.endTime <= day.startTime,
    );
    if (invalidDay) {
      toast.error(
        `Jam selesai ${CHECKLIST_WEEKDAY_LABEL[invalidDay.weekday]} harus lebih lambat dari jam mulai.`,
      );
      return;
    }
    if (
      intervalUnit === "minggu" &&
      !days.find((day) => day.weekday === weekdayOf(anchorDate))?.enabled
    ) {
      toast.error(
        "Tanggal mulai mingguan jatuh pada hari yang tidak aktif. Pilih tanggal lain atau aktifkan hari itu.",
      );
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
            locationId: locationIdToSave,
            distributionMode,
            intervalUnit,
            intervalCount,
            anchorDate,
            dueDays,
            days,
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
        <div
          className={
            hideBaseLocation
              ? "grid grid-cols-1 gap-3"
              : "grid grid-cols-1 gap-3 sm:grid-cols-2"
          }
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-template">Template</Label>
            <Select
              value={templateId}
              onValueChange={(value) => {
                const nextTemplateId = value as string;
                setTemplateId(nextTemplateId);
                if (!schedule) {
                  const nextTemplate =
                    setup.templates.find(
                      (template) => template.id === nextTemplateId,
                    ) ?? null;
                  setDistributionMode(
                    defaultDistributionModeForTemplate(nextTemplate),
                  );
                }
              }}
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
          {!hideBaseLocation && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="schedule-location">
                {distributionMode === "per_lokasi"
                  ? "Lokasi untuk item tanpa lokasi"
                  : "Lokasi checklist"}
              </Label>
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
              {leafLocations.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Template belum punya item.
                </p>
              ) : distributionMode === "per_lokasi" ? (
                <p className="text-xs text-muted-foreground">
                  Wajib diisi: {unlocatedItemCount} item belum punya lokasi
                  sendiri.
                </p>
              ) : locatedItemCount > 0 ? (
                <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  {locatedItemCount} dari {leafLocations.length} item punya
                  lokasi sendiri; semuanya akan dicatat di lokasi ini. Pilih
                  “Pisah per lokasi item” agar checklist mengikuti area item.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Semua item digabung ke satu pemeriksaan di lokasi ini.
                </p>
              )}
            </div>
          )}
        </div>

        {hideBaseLocation && (
          <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {distributionMode === "per_lokasi" ? (
              <>
                Semua item sudah punya lokasi sendiri, jadi pemeriksaan dibuat
                per lokasi item.{" "}
                {fallbackLocationPath
                  ? `Lokasi cadangan otomatis: ${fallbackLocationPath} (dipakai bila ada item tanpa lokasi).`
                  : "Belum ada lokasi aktif untuk cadangan; aktifkan lokasi terlebih dahulu."}
              </>
            ) : fallbackLocationPath ? (
              <>
                Semua item berada di lokasi yang sama, jadi lokasi checklist
                diambil otomatis: {fallbackLocationPath}.
              </>
            ) : (
              "Lokasi checklist akan diambil otomatis dari lokasi item."
            )}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="schedule-distribution">Distribusi pemeriksaan</Label>
          <Select
            value={distributionMode}
            onValueChange={(value) =>
              setDistributionMode(value as ChecklistDistributionMode)
            }
            items={distributionItems}
          >
            <SelectTrigger id="schedule-distribution" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {distributionItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {distributionMode === "tunggal"
              ? "Satu pemeriksaan memuat semua item; lokasi item tidak dipakai untuk memisahkan checklist."
              : "Item dikelompokkan menurut lokasi item atau grup. Setiap lokasi menjadi pemeriksaan terpisah dalam satu paket periode."}
            {schedule
              ? " Perubahan distribusi hanya berlaku untuk pemeriksaan baru; pemeriksaan yang sudah dibuat tidak diubah."
              : ""}
          </p>
          {distributionMode === "per_lokasi" && (
            <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
              {distributionPreview.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Template belum memiliki item yang dapat didistribusikan.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">
                      Pratinjau per periode
                    </p>
                    <Badge variant="outline" className="tabular-nums">
                      {distributionPreview.length} lokasi
                    </Badge>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {distributionPreview.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-foreground">
                          <MapPin
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="truncate">{row.path}</span>
                        </span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {row.itemCount} item
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
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
          {checklistIntervalLabel(intervalUnit, intervalCount)}; deadline +{dueDays} hari
          (hari libur dilewati). Jadwal berikutnya tetap meski terlambat. Tanggal
          29–31 mengikuti akhir bulan.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="schedule-anchor">
            Tanggal mulai <span className="text-destructive">*</span>
          </Label>
          <DatePicker
            id="schedule-anchor"
            value={anchorDate}
            onChange={setAnchorDate}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Hari & jam pengisian</Label>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => applyDayPreset("mon-sat")}
              >
                Senin–Sabtu
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => applyDayPreset("all")}
              >
                Setiap hari
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Checklist hanya dibuat pada hari aktif. Jam selesai menjadi batas
            pengisian pada tanggal tenggat.
          </p>
          <Frame dense>
            <FramePanel className="divide-y divide-border/70 p-0">
              {days.map((day) => {
                const label = CHECKLIST_WEEKDAY_LABEL[day.weekday];
                return (
                  <div
                    key={day.weekday}
                    className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Switch
                        checked={day.enabled}
                        onCheckedChange={(checked) =>
                          updateDay(day.weekday, { enabled: checked === true })
                        }
                        aria-label={`Aktifkan ${label}`}
                      />
                      <span
                        className={cn(
                          "text-sm",
                          day.enabled
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {label}
                      </span>
                      {!day.enabled && (
                        <Badge variant="outline" className="text-xs">
                          Libur
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <TimeField
                        value={day.startTime}
                        onValueChange={(value) =>
                          updateDay(day.weekday, {
                            startTime: value ?? day.startTime,
                          })
                        }
                        disabled={!day.enabled}
                        aria-label={`Jam mulai ${label}`}
                        className="w-28"
                      />
                      <span className="text-xs text-muted-foreground">
                        s.d.
                      </span>
                      <TimeField
                        value={day.endTime}
                        onValueChange={(value) =>
                          updateDay(day.weekday, {
                            endTime: value ?? day.endTime,
                          })
                        }
                        disabled={!day.enabled}
                        aria-label={`Jam selesai ${label}`}
                        className="w-28"
                      />
                    </div>
                  </div>
                );
              })}
            </FramePanel>
          </Frame>
          <p className="text-xs text-muted-foreground">
            {checklistScheduleDaysSummary(days)}
          </p>
          {scheduleWindowPreview && (
            <div className="flex flex-col gap-1 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                Jendela berikutnya
              </span>
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
                Buka
                <span className="font-medium text-foreground">
                  {formatDateHuman(
                    scheduleWindowPreview.opensAt,
                    "EEEE, d MMM yyyy, HH:mm",
                  )}
                </span>
              </span>
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <CalendarClock
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
                Deadline
                <span className="font-medium text-foreground">
                  {formatDateHuman(
                    scheduleWindowPreview.dueAt,
                    "EEEE, d MMM yyyy, HH:mm",
                  )}
                </span>
              </span>
            </div>
          )}
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
                                  src={avatarUrl(person.id, person.avatarKey)}
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
