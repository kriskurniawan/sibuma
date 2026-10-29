"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import type { PageRequest } from "@/lib/pagination";
import type { getTeamTotals } from "@/lib/team-queries";
import { ReportPrintButton } from "@/components/reports/report-print-button";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  Camera,
  Clock3,
  FolderPlus,
  LockKeyhole,
  Power,
  Save,
  Search,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Alert, AlertDescription } from "@/components/reui/alert";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { TeamDivisionsGrid } from "@/components/team/team-divisions-grid";
import type {
  TeamDivisionRow,
  TeamWorkerRow,
} from "@/components/team/team-grid-shared";
import { TeamWorkersGrid } from "@/components/team/team-workers-grid";
import {
  EmptyState,
  FieldError,
  PageHeader,
  StatCard,
} from "@/components/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Division, Employee } from "@/lib/types";

type TeamTab = "pekerja" | "divisi";
type StatusFilter = "semua" | "aktif" | "nonaktif";

interface TeamViewProps {
  team: TeamWorkerRow[];
  total: number;
  pagination: PageRequest;
  totals: Awaited<ReturnType<typeof getTeamTotals>>;
  filters: { search: string; division: string; status: StatusFilter };
  printRows?: TeamWorkerRow[];
  divisions: Division[];
  readOnly?: boolean;
}

interface EmployeeForm {
  name: string;
  nik: string;
  phone: string;
  email: string;
  divisionId: string;
  active: boolean;
}

interface DivisionForm {
  name: string;
  description: string;
}

const EMPTY_FORM: EmployeeForm = {
  name: "",
  nik: "",
  phone: "",
  email: "",
  divisionId: "",
  active: true,
};

const EMPTY_DIVISION_FORM: DivisionForm = {
  name: "",
  description: "",
};

const STATUS_FILTER_ITEMS: Record<string, string> = {
  semua: "Semua status",
  aktif: "Aktif",
  nonaktif: "Nonaktif",
};

export function TeamView({ team, total, pagination, totals, filters, printRows, divisions, readOnly = false }: TeamViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TeamTab>("pekerja");
  const [workerSearch, setWorkerSearch] = useState(filters.search);
  const [workerDivisionFilter, setWorkerDivisionFilter] = useState(filters.division);
  const [workerStatusFilter, setWorkerStatusFilter] =
    useState<StatusFilter>(filters.status);
  const [divisionSearch, setDivisionSearch] = useState("");
  const [divisionStatusFilter, setDivisionStatusFilter] =
    useState<StatusFilter>("semua");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(
    null,
  );
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [divisionModal, setDivisionModal] = useState<
    { mode: "create" } | { mode: "edit"; division: Division } | null
  >(null);
  const [divisionForm, setDivisionForm] =
    useState<DivisionForm>(EMPTY_DIVISION_FORM);
  const [divisionErrors, setDivisionErrors] = useState<
    Record<string, string | undefined>
  >({});
  const [divisionServerError, setDivisionServerError] = useState<string | null>(
    null,
  );
  const [divisionSaving, setDivisionSaving] = useState(false);
  const [deactivateDivisionTarget, setDeactivateDivisionTarget] =
    useState<Division | null>(null);
  const [divisionBusyId, setDivisionBusyId] = useState<string | null>(null);

  const activeDivisions = useMemo(
    () => divisions.filter((division) => division.active),
    [divisions],
  );
  const firstActiveDivisionId = activeDivisions[0]?.id ?? "";
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
  const divisionById = useMemo(
    () => new Map(divisions.map((division) => [division.id, division])),
    [divisions],
  );
  const hasUnassigned = totals.unassigned > 0;
  const workerDivisionItems = useMemo(() => {
    const items: Record<string, string> = { semua: "Semua divisi" };
    if (hasUnassigned) items.tanpa = "Tanpa divisi";
    for (const division of divisions) {
      items[division.id] = division.active
        ? division.name
        : `${division.name} (nonaktif)`;
    }
    return items;
  }, [divisions, hasUnassigned]);
  const divisionWorkerCounts = useMemo(() => new Map(totals.divisions.map((row) => [row.id, row])), [totals.divisions]);
  const filteredWorkers = team;
  const [filterPending, startFilterTransition] = useTransition();
  useEffect(() => {
    setWorkerSearch(filters.search);
    setWorkerDivisionFilter(filters.division);
    setWorkerStatusFilter(filters.status);
  }, [filters.search, filters.division, filters.status]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (workerSearch === filters.search && workerDivisionFilter === filters.division && workerStatusFilter === filters.status) return;
      const params = new URLSearchParams({ search: workerSearch, division: workerDivisionFilter, status: workerStatusFilter, size: String(pagination.pageSize) });
      startFilterTransition(() => router.replace('/tim?' + params.toString(), { scroll: false }));
    }, 300);
    return () => clearTimeout(timer);
  }, [workerSearch, workerDivisionFilter, workerStatusFilter, filters, pagination.pageSize, router]);
  const filteredDivisions = useMemo(() => {
    const query = divisionSearch.trim().toLowerCase();
    if (!query && divisionStatusFilter === "semua") return divisions;
    return divisions.filter((division) => {
      if (divisionStatusFilter === "aktif" && !division.active) return false;
      if (divisionStatusFilter === "nonaktif" && division.active) return false;
      if (!query) return true;
      return `${division.name} ${division.description}`
        .toLowerCase()
        .includes(query);
    });
  }, [divisionSearch, divisionStatusFilter, divisions]);
  const divisionRows = useMemo<TeamDivisionRow[]>(
    () =>
      filteredDivisions.map((division) => {
        const counts = divisionWorkerCounts.get(division.id);
        return {
          division,
          workerCount: counts?.total ?? 0,
          activeWorkerCount: counts?.active ?? 0,
        };
      }),
    [divisionWorkerCounts, filteredDivisions],
  );
  const workerFiltersActive =
    workerSearch.trim().length > 0 ||
    workerDivisionFilter !== "semua" ||
    workerStatusFilter !== "semua";
  const divisionFiltersActive =
    divisionSearch.trim().length > 0 || divisionStatusFilter !== "semua";

  const totalMinutes = totals.minutes;
  const totalSessions = totals.sessions;
  const totalDocuments = totals.documents;

  function openAdd(divisionId?: string) {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      divisionId: divisionId ?? firstActiveDivisionId,
    });
    setErrors({});
    setServerError(null);
    setAddOpen(true);
  }

  function openAddFromHeader() {
    const selected = divisions.find(
      (division) => division.id === workerDivisionFilter,
    );
    openAdd(selected?.active ? selected.id : undefined);
  }

  function clearWorkerFilters() {
    setWorkerSearch("");
    setWorkerDivisionFilter("semua");
    setWorkerStatusFilter("semua");
  }

  function clearDivisionFilters() {
    setDivisionSearch("");
    setDivisionStatusFilter("semua");
  }

  function openEdit(employee: Employee) {
    setAddOpen(false);
    setEditing(employee);
    setForm({
      name: employee.name,
      nik: employee.nik,
      phone: employee.phone,
      email: employee.email ?? "",
      divisionId: employee.divisionId ?? firstActiveDivisionId,
      active: employee.active,
    });
    setErrors({});
    setServerError(null);
  }

  function closeModal() {
    if (saving) return;
    setAddOpen(false);
    setEditing(null);
    setErrors({});
    setServerError(null);
  }

  async function submitEmployee(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string | undefined> = {};
    if (form.name.trim().length < 3) {
      nextErrors.name = "Nama minimal 3 karakter.";
    }
    if (form.nik.trim().length < 3) {
      nextErrors.nik = "NIK minimal 3 karakter.";
    }
    if (form.phone.trim().length < 8) {
      nextErrors.phone = "Nomor HP minimal 8 digit.";
    }
    if ((!editing || editing.email || form.email.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Masukkan email yang valid untuk OTP cadangan.";
    }
    if (!form.divisionId) {
      nextErrors.divisionId = "Pilih divisi.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setServerError(null);
    try {
      const endpoint = editing
        ? `/api/employees/${editing.id}`
        : "/api/employees";
      const response = await fetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          nik: form.nik.trim(),
          phone: form.phone.trim(),
          ...(form.email.trim() ? { email: form.email.trim().toLowerCase() } : {}),
          divisionId: form.divisionId,
          ...(editing ? { active: form.active } : {}),
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setServerError(data.message ?? "Gagal menyimpan data pekerja.");
        return;
      }
      toast.success(
        data.message ??
          (editing ? "Data pekerja tersimpan." : "Pekerja ditambahkan."),
      );
      closeModal();
      router.refresh();
    } catch {
      setServerError("Tidak dapat menghubungi server. Periksa koneksimu.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(employee: Employee) {
    setBusyId(employee.id);
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !employee.active }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        toast.error(data.message ?? "Gagal mengubah status pekerja.");
        return;
      }
      toast.success(
        employee.active
          ? `${employee.name} dinonaktifkan. Riwayat tetap tersimpan.`
          : `${employee.name} diaktifkan kembali.`,
      );
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server.");
    } finally {
      setBusyId(null);
    }
  }

  function requestToggleActive(employee: Employee) {
    if (employee.active) {
      setDeactivateTarget(employee);
      return;
    }
    void toggleActive(employee);
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    await toggleActive(deactivateTarget);
    setDeactivateTarget(null);
  }

  const deactivating =
    deactivateTarget !== null && busyId === deactivateTarget.id;

  function openCreateDivision() {
    setDivisionModal({ mode: "create" });
    setDivisionForm(EMPTY_DIVISION_FORM);
    setDivisionErrors({});
    setDivisionServerError(null);
  }

  function openEditDivision(division: Division) {
    setDivisionModal({ mode: "edit", division });
    setDivisionForm({
      name: division.name,
      description: division.description,
    });
    setDivisionErrors({});
    setDivisionServerError(null);
  }

  function closeDivisionModal() {
    if (divisionSaving) return;
    setDivisionModal(null);
    setDivisionErrors({});
    setDivisionServerError(null);
  }

  async function submitDivision(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string | undefined> = {};
    if (divisionForm.name.trim().length < 2) {
      nextErrors.name = "Nama divisi minimal 2 karakter.";
    }
    setDivisionErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const modal = divisionModal;
    if (!modal) return;

    setDivisionSaving(true);
    setDivisionServerError(null);
    try {
      const response = await fetch(
        modal.mode === "create"
          ? "/api/divisions"
          : `/api/divisions/${modal.division.id}`,
        {
          method: modal.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: divisionForm.name.trim(),
            description: divisionForm.description.trim(),
          }),
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setDivisionServerError(data.message ?? "Gagal menyimpan divisi.");
        return;
      }
      toast.success(
        data.message ??
          (modal.mode === "create"
            ? "Divisi ditambahkan."
            : "Divisi tersimpan."),
      );
      closeDivisionModal();
      router.refresh();
    } catch {
      setDivisionServerError(
        "Tidak dapat menghubungi server. Periksa koneksimu.",
      );
    } finally {
      setDivisionSaving(false);
    }
  }

  async function setDivisionActive(division: Division, active: boolean) {
    setDivisionBusyId(division.id);
    try {
      const response = await fetch(`/api/divisions/${division.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        toast.error(data.message ?? "Gagal mengubah status divisi.");
        return false;
      }
      toast.success(
        active
          ? `Divisi ${division.name} diaktifkan kembali.`
          : `Divisi ${division.name} dinonaktifkan.`,
      );
      router.refresh();
      return true;
    } catch {
      toast.error("Tidak dapat menghubungi server.");
      return false;
    } finally {
      setDivisionBusyId(null);
    }
  }

  async function confirmDeactivateDivision() {
    if (!deactivateDivisionTarget) return;
    const ok = await setDivisionActive(deactivateDivisionTarget, false);
    if (ok) setDeactivateDivisionTarget(null);
  }

  const deactivatingDivision =
    deactivateDivisionTarget !== null &&
    divisionBusyId === deactivateDivisionTarget.id;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="no-print"
        eyebrow={readOnly ? "Lihat tim" : "Kelola tim"}
        title="Tim."
        description={
          readOnly
            ? "Lihat pekerja, divisi, penempatan, dan beban kerja anggota tim."
            : "Kelola pekerja dan divisi, atur penempatan, serta pantau beban kerja anggota tim."
        }
        action={
          <div className="flex w-full flex-col gap-2 print:hidden sm:w-auto">
            <ReportPrintButton />
            {!readOnly && (divisions.length === 0 ? (
              <Button
                type="button"
                onClick={openCreateDivision}
                className="w-full sm:w-auto"
              >
                <FolderPlus />
                Buat divisi pertama
              </Button>
            ) : tab === "divisi" || activeDivisions.length === 0 ? (
              <Button
                type="button"
                onClick={openCreateDivision}
                className="w-full sm:w-auto"
              >
                <FolderPlus />
                Tambah divisi
              </Button>
            ) : (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={openCreateDivision}
                  className="w-full sm:w-auto"
                >
                  <FolderPlus />
                  Tambah divisi
                </Button>
                <Button
                  type="button"
                  onClick={openAddFromHeader}
                  className="w-full sm:w-auto"
                >
                  <UserPlus />
                  Tambah pekerja
                </Button>
              </div>
            ))}
          </div>
        }
      />

      <div className="no-print grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Anggota aktif"
          value={totals.active}
          suffix={`/ ${totals.total}`}
          icon={UsersRound}
          helper={`${activeDivisions.length} divisi aktif`}
          tone="primary"
        />
        <StatCard
          label="Durasi bulan ini"
          value={Math.floor(totalMinutes / 60)}
          suffix="jam"
          icon={Clock3}
          helper={`${totalMinutes % 60} menit tercatat`}
        />
        <StatCard
          label="Sesi absensi"
          value={totalSessions}
          suffix="sesi"
          icon={BadgeCheck}
          helper="Absensi masuk bulan berjalan"
        />
        <StatCard
          label="Dokumentasi"
          value={totalDocuments}
          suffix="foto"
          icon={Camera}
          helper="Bukti kerja yang diunggah"
        />
      </div>

      <div className="flex flex-col gap-6">
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as TeamTab)}
          className="min-w-0 w-full"
        >
          <Frame spacing="default" className="min-w-0 w-full self-start">
            <FrameHeader className="gap-3 print:hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col gap-0.5">
                <FrameTitle>{tab === "pekerja" ? "Pekerja" : "Divisi"}</FrameTitle>
                <FrameDescription className="text-xs">
                  {tab === "pekerja"
                    ? `${totals.total} pekerja · ${totals.active} aktif · ${total} cocok`
                    : `${divisions.length} divisi · ${activeDivisions.length} aktif · ${filteredDivisions.length} tampil`}
                </FrameDescription>
              </div>
              <TabsList className="w-full sm:w-max">
                <TabsTrigger value="pekerja">
                  <UsersRound aria-hidden="true" />
                  Pekerja
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                    {totals.total}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="divisi">
                  <Building2 aria-hidden="true" />
                  Divisi
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                    {divisions.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>
          </FrameHeader>

          <FramePanel className="p-0">
            <TabsContent value="pekerja" className="flex flex-col" aria-busy={filterPending}>
              <div className="flex flex-col gap-3 border-b border-border p-4 print:hidden lg:flex-row lg:items-center lg:justify-between">
                <InputGroup className="w-full lg:max-w-xs">
                  <InputGroupAddon>
                    <Search aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={workerSearch}
                    onChange={(event) => setWorkerSearch(event.target.value)}
                    placeholder="Cari nama, NIK, HP…"
                    aria-label="Cari pekerja"
                  />
                  {workerSearch && (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setWorkerSearch("")}
                        aria-label="Hapus pencarian pekerja"
                      >
                        <X />
                      </InputGroupButton>
                    </InputGroupAddon>
                  )}
                </InputGroup>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:items-center lg:justify-end">
                  <Select
                    items={workerDivisionItems}
                    value={workerDivisionFilter}
                    onValueChange={(value) => {
                      if (value !== null) setWorkerDivisionFilter(value);
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-full sm:w-44"
                      aria-label="Filter divisi"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semua">Semua divisi</SelectItem>
                      {hasUnassigned && (
                        <SelectItem value="tanpa">Tanpa divisi</SelectItem>
                      )}
                      {divisions.map((division) => (
                        <SelectItem key={division.id} value={division.id}>
                          {division.name}
                          {division.active ? "" : " (nonaktif)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    items={STATUS_FILTER_ITEMS}
                    value={workerStatusFilter}
                    onValueChange={(value) => {
                      if (value !== null) {
                        setWorkerStatusFilter(value as StatusFilter);
                      }
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-full sm:w-36"
                      aria-label="Filter status pekerja"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_FILTER_ITEMS) as StatusFilter[]).map(
                        (value) => (
                          <SelectItem key={value} value={value}>
                            {STATUS_FILTER_ITEMS[value]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>

                  {workerFiltersActive && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearWorkerFilters}
                      className="w-full sm:w-auto"
                    >
                      <X aria-hidden="true" />
                      Hapus filter
                    </Button>
                  )}
                </div>
              </div>

              {divisions.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Building2}
                    title="Belum ada divisi"
                    description={
                      readOnly
                        ? "Belum ada divisi di tim ini."
                        : "Buat divisi pertama sebelum menempatkan pekerja dan menyusun SPKL."
                    }
                    action={
                      readOnly ? undefined : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={openCreateDivision}
                        >
                          <FolderPlus />
                          Buat divisi
                        </Button>
                      )
                    }
                  />
                </div>
              ) : totals.total === 0 && activeDivisions.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Building2}
                    title="Belum ada divisi aktif"
                    description={
                      readOnly
                        ? "Belum ada divisi aktif di tim ini."
                        : "Aktifkan divisi yang sudah ada atau buat divisi baru sebelum menambah pekerja."
                    }
                    action={
                      readOnly ? undefined : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={openCreateDivision}
                        >
                          <FolderPlus />
                          Tambah divisi
                        </Button>
                      )
                    }
                  />
                </div>
              ) : totals.total === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={UsersRound}
                    title="Belum ada pekerja"
                    description={
                      readOnly
                        ? "Belum ada pekerja di tim ini."
                        : "Tambahkan pekerja pertama ke salah satu divisi agar mereka dapat menerima SPKL dan melakukan absensi."
                    }
                    action={
                      readOnly ? undefined : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openAdd()}
                        >
                          <UserPlus />
                          Tambah pekerja
                        </Button>
                      )
                    }
                  />
                </div>
              ) : filteredWorkers.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Search}
                    title="Tidak ada pekerja yang cocok"
                    description="Ubah kata kunci atau filter divisi dan status."
                    action={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={clearWorkerFilters}
                      >
                        Hapus filter
                      </Button>
                    }
                  />
                </div>
              ) : (
                <TeamWorkersGrid
                  rows={filteredWorkers}
                  total={total}
                  pagination={pagination}
                  printRows={printRows}
                  divisionById={divisionById}
                  busyId={busyId}
                  readOnly={readOnly}
                  onEdit={openEdit}
                  onToggle={requestToggleActive}
                />
              )}
            </TabsContent>

            <TabsContent value="divisi" className="flex flex-col">
              <div className="flex flex-col gap-3 border-b border-border p-4 print:hidden lg:flex-row lg:items-center lg:justify-between">
                <InputGroup className="w-full lg:max-w-xs">
                  <InputGroupAddon>
                    <Search aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={divisionSearch}
                    onChange={(event) => setDivisionSearch(event.target.value)}
                    placeholder="Cari nama atau deskripsi…"
                    aria-label="Cari divisi"
                  />
                  {divisionSearch && (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDivisionSearch("")}
                        aria-label="Hapus pencarian divisi"
                      >
                        <X />
                      </InputGroupButton>
                    </InputGroupAddon>
                  )}
                </InputGroup>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:items-center lg:justify-end">
                  <Select
                    items={STATUS_FILTER_ITEMS}
                    value={divisionStatusFilter}
                    onValueChange={(value) => {
                      if (value !== null) {
                        setDivisionStatusFilter(value as StatusFilter);
                      }
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-full sm:w-36"
                      aria-label="Filter status divisi"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_FILTER_ITEMS) as StatusFilter[]).map(
                        (value) => (
                          <SelectItem key={value} value={value}>
                            {STATUS_FILTER_ITEMS[value]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>

                  {divisionFiltersActive && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearDivisionFilters}
                      className="w-full sm:w-auto"
                    >
                      <X aria-hidden="true" />
                      Hapus filter
                    </Button>
                  )}
                </div>
              </div>

              {divisions.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Building2}
                    title="Belum ada divisi"
                    description={
                      readOnly
                        ? "Belum ada divisi di tim ini."
                        : "Buat divisi pertama untuk mengelompokkan pekerja dan menyusun SPKL."
                    }
                    action={
                      readOnly ? undefined : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={openCreateDivision}
                        >
                          <FolderPlus />
                          Buat divisi
                        </Button>
                      )
                    }
                  />
                </div>
              ) : divisionRows.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Search}
                    title="Tidak ada divisi yang cocok"
                    description="Ubah kata kunci atau filter status divisi."
                    action={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={clearDivisionFilters}
                      >
                        Hapus filter
                      </Button>
                    }
                  />
                </div>
              ) : (
                <TeamDivisionsGrid
                  rows={divisionRows}
                  activeDivisionTotal={activeDivisions.length}
                  busyId={divisionBusyId}
                  readOnly={readOnly}
                  onAdd={(division) => openAdd(division.id)}
                  onEdit={openEditDivision}
                  onToggle={(division) => {
                    if (division.active) {
                      setDeactivateDivisionTarget(division);
                    } else {
                      void setDivisionActive(division, true);
                    }
                  }}
                />
              )}
            </TabsContent>
          </FramePanel>

          <FrameFooter className="flex-row items-start gap-2 print:hidden">
            <LockKeyhole
              className="size-3.5 shrink-0"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Menonaktifkan pekerja tidak menghapus riwayat absensi atau
              dokumentasinya. Divisi hanya bisa dinonaktifkan setelah tidak
              memiliki pekerja, dan minimal satu divisi aktif harus tersedia.
            </p>
          </FrameFooter>
          </Frame>
        </Tabs>
      </div>

      <Modal
        open={addOpen || Boolean(editing)}
        onClose={closeModal}
        title={editing ? "Ubah data pekerja" : "Tambah pekerja"}
        description={
          editing
            ? `${editing.name} · ${editing.nik}`
            : "Daftarkan NIK, email, dan WhatsApp terlebih dahulu agar pekerja bisa masuk dengan OTP."
        }
        size="md"
        dismissible={!saving}
        footer={
          <div className="flex w-full gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={closeModal}
              disabled={saving}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="employee-form"
              disabled={saving}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Spinner />
                  Menyimpan…
                </>
              ) : editing ? (
                <>
                  <Save />
                  Simpan
                </>
              ) : (
                <>
                  <UserPlus />
                  Tambah pekerja
                </>
              )}
            </Button>
          </div>
        }
      >
        <form
          id="employee-form"
          onSubmit={submitEmployee}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="employee-name">
              <span>
                Nama lengkap <span className="text-destructive">*</span>
              </span>
            </Label>
            <Input
              id="employee-name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              aria-invalid={Boolean(errors.name)}
              placeholder="Contoh: Andi Pratama"
              autoComplete="name"
            />
            <FieldError>{errors.name}</FieldError>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="employee-nik">
              <span>
                NIK / ID karyawan <span className="text-destructive">*</span>
              </span>
            </Label>
            <Input
              id="employee-nik"
              value={form.nik}
              onChange={(event) =>
                setForm((current) => ({ ...current, nik: event.target.value }))
              }
              aria-invalid={Boolean(errors.nik)}
              placeholder="Contoh: BMBI-2024-061"
            />
            <FieldError>{errors.nik}</FieldError>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="employee-division">
              <span>
                Divisi <span className="text-destructive">*</span>
              </span>
            </Label>
            <Select
              items={divisionItems}
              value={form.divisionId}
              onValueChange={(value) => {
                if (value !== null) {
                  setForm((current) => ({ ...current, divisionId: value }));
                }
              }}
            >
              <SelectTrigger
                id="employee-division"
                className="w-full"
                aria-invalid={Boolean(errors.divisionId)}
              >
                <SelectValue placeholder="Pilih divisi" />
              </SelectTrigger>
              <SelectContent>
                {divisions
                  .filter(
                    (division) =>
                      division.active || division.id === form.divisionId,
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
              Pekerja hanya bisa ditugaskan pada SPKL di divisi ini.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="employee-phone">
              <span>
                Nomor HP / WhatsApp <span className="text-destructive">*</span>
              </span>
            </Label>
            <Input
              id="employee-phone"
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              aria-invalid={Boolean(errors.phone)}
              placeholder="0812 3456 7890"
              inputMode="tel"
              autoComplete="tel"
            />
            <FieldError>{errors.phone}</FieldError>
            <p className="text-xs text-muted-foreground">
              Format 08xx atau 628xx. Nomor ini dipakai untuk menerima OTP dan
              notifikasi SPKL.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="employee-email">
              <span>Email pekerja {!editing && <span className="text-destructive">*</span>}</span>
            </Label>
            <Input
              id="employee-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              aria-invalid={Boolean(errors.email)}
              aria-describedby="employee-email-hint"
              placeholder="nama@perusahaan.com"
              autoComplete="email"
            />
            <FieldError>{errors.email}</FieldError>
            <p id="employee-email-hint" className="text-xs text-muted-foreground">
              Untuk login email dan OTP cadangan jika WhatsApp gagal. Akun lama tanpa email tetap tersimpan; lengkapi agar fallback tersedia.
            </p>
          </div>

          {editing && (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Label htmlFor="employee-active">Akun aktif</Label>
                <p className="text-xs text-muted-foreground">
                  Pekerja nonaktif tidak dapat masuk atau menerima SPKL baru.
                </p>
              </div>
              <Switch
                id="employee-active"
                checked={form.active}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, active: checked }))
                }
              />
            </div>
          )}

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
        </form>
      </Modal>

      <AlertDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deactivating) setDeactivateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan pekerja?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.name} tidak akan bisa masuk atau menerima SPKL
              baru. Riwayat absensi dan dokumentasinya tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deactivating}
              onClick={() => void confirmDeactivate()}
            >
              {deactivating ? <Spinner /> : <Power />}
              Nonaktifkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Modal
        open={divisionModal !== null}
        onClose={closeDivisionModal}
        title={
          divisionModal?.mode === "edit" ? "Ubah divisi" : "Tambah divisi"
        }
        description={
          divisionModal?.mode === "edit"
            ? "Perubahan nama langsung terlihat pada pekerja dan SPKL di divisi ini."
            : "Divisi menjadi dasar pengelompokan pekerja dan penugasan SPKL."
        }
        size="md"
        dismissible={!divisionSaving}
        footer={
          <div className="flex w-full gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={closeDivisionModal}
              disabled={divisionSaving}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="division-form"
              disabled={divisionSaving}
              className="flex-1"
            >
              {divisionSaving ? (
                <>
                  <Spinner />
                  Menyimpan…
                </>
              ) : (
                <>
                  <Save />
                  Simpan divisi
                </>
              )}
            </Button>
          </div>
        }
      >
        <form
          id="division-form"
          onSubmit={submitDivision}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="division-name">
              <span>
                Nama divisi <span className="text-destructive">*</span>
              </span>
            </Label>
            <Input
              id="division-name"
              value={divisionForm.name}
              onChange={(event) =>
                setDivisionForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              aria-invalid={Boolean(divisionErrors.name)}
              placeholder="Contoh: Operasional"
            />
            <FieldError>{divisionErrors.name}</FieldError>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="division-description">Deskripsi</Label>
            <Textarea
              id="division-description"
              value={divisionForm.description}
              onChange={(event) =>
                setDivisionForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Ringkasan pekerjaan divisi ini (opsional)"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Maksimal 200 karakter. Boleh dikosongkan.
            </p>
          </div>

          {divisionServerError && (
            <Alert variant="destructive">
              <AlertDescription>{divisionServerError}</AlertDescription>
            </Alert>
          )}
        </form>
      </Modal>

      <AlertDialog
        open={deactivateDivisionTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deactivatingDivision) {
            setDeactivateDivisionTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan divisi?</AlertDialogTitle>
            <AlertDialogDescription>
              Divisi {deactivateDivisionTarget?.name} tidak akan muncul saat
              membuat SPKL baru. Divisi hanya bisa dinonaktifkan jika sudah
              tidak memiliki pekerja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivatingDivision}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deactivatingDivision}
              onClick={() => void confirmDeactivateDivision()}
            >
              {deactivatingDivision ? <Spinner /> : <Power />}
              Nonaktifkan divisi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

