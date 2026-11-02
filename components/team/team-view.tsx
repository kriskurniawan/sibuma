"use client";

import { Suspense, use, useEffect, useMemo, useState, type FormEvent } from "react";
import { TeamListSkeleton, useTeamPageState } from "@/components/team/team-page-shell";
import { useFilterNavigation } from "@/components/filters/use-filter-navigation";
import { DataLoadError } from "@/components/data-load-error";
import type { PageRequest } from "@/lib/pagination";
import { useRouter } from "next/navigation";
import {
  Building2,
  FolderPlus,
  Power,
  RefreshCw,
  Save,
  Search,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { useDialogIntent } from "@/hooks/use-dialog-intent";
import { Alert, AlertDescription } from "@/components/reui/alert";
import { TeamDivisionsGrid } from "@/components/team/team-divisions-grid";
import type { TeamDivisionCountsPromise, TeamDivisionOptionsPromise, TeamWorkerRow } from "@/components/team/team-grid-shared";
import { TeamWorkersGrid } from "@/components/team/team-workers-grid";
import {
  EmptyState,
  FieldError,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Division, Employee } from "@/lib/types";

type StatusFilter = "semua" | "aktif" | "nonaktif";

interface TeamViewProps {
  team: TeamWorkerRow[];
  total: number;
  pagination: PageRequest;
  divisionCounts: TeamDivisionCountsPromise;
  filters: { search: string; division: string; status: StatusFilter };
  printRows?: TeamWorkerRow[];
  divisionOptions: TeamDivisionOptionsPromise;
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

/** Only division options gate this tab; counts and destructive safeguards
 * resolve separately inside the grid, without hiding the division rows. */
function DivisionTabContent({
  divisionOptions,
  divisionCounts,
  busyId,
  readOnly,
  onCreateDivision,
  onAdd,
  onEdit,
  onToggle,
}: {
  divisionOptions: TeamDivisionOptionsPromise;
  divisionCounts: TeamDivisionCountsPromise;
  busyId: string | null;
  readOnly: boolean;
  onCreateDivision: () => void;
  onAdd: (division: Division) => void;
  onEdit: (division: Division) => void;
  onToggle: (division: Division) => void;
}) {
  const router = useRouter();
  const pageState = useTeamPageState();
  const divisions = use(divisionOptions);
  if (!divisions) {
    return <div className="p-4"><DataLoadError message="Data divisi belum dapat dimuat." /></div>;
  }
  const query = (pageState?.divisionSearch ?? "").trim().toLowerCase();
  const status = pageState?.divisionStatus ?? "semua";
  const rows = divisions.filter((division) => {
    if (status === "aktif" && !division.active) return false;
    if (status === "nonaktif" && division.active) return false;
    return !query || `${division.name} ${division.description}`.toLowerCase().includes(query);
  }).map((division) => ({ division }));

  if (divisions.length === 0) {
    return (
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
            readOnly ? (
              <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}><RefreshCw aria-hidden="true" />Muat ulang</Button>
            ) : (
              <div className="max-md:hidden">
                <Button
                  type="button"
                  size="sm"
                  onClick={onCreateDivision}
                  data-dialog-intent="division-new"
                >
                  <FolderPlus />
                  Buat divisi
                </Button>
              </div>
            )
          }
        />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
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
              onClick={pageState?.clearDivisionFilters}
            >
              Hapus filter
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <TeamDivisionsGrid
      rows={rows}
      divisionCounts={divisionCounts}
      activeDivisionTotal={divisions.filter((division) => division.active).length}
      busyId={busyId}
      readOnly={readOnly}
      onAdd={onAdd}
      onEdit={onEdit}
      onToggle={onToggle}
    />
  );
}

export function TeamView({ team, total, pagination, divisionCounts, filters, printRows, divisionOptions, readOnly = false }: TeamViewProps) {
  const router = useRouter();
  const pageState = useTeamPageState();
  const { navigate } = useFilterNavigation({ division: "semua", status: "semua" });
  const tab = pageState?.tab ?? "pekerja";
  const workerDivisionFilter = pageState?.workerDivision ?? filters.division;
  const [resolvedOptions, setResolvedOptions] = useState<{
    source: TeamDivisionOptionsPromise;
    divisions: Division[] | null;
  } | null>(null);
  const [pendingEmployeeAction, setPendingEmployeeAction] = useState<
    { mode: "create"; divisionId?: string } | { mode: "edit"; employee: Employee } | null
  >(null);
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

  // Observe options without suspending the rows. The promise identity keeps a
  // refresh from reusing stale options for a new action.
  useEffect(() => {
    let current = true;
    void divisionOptions.then((divisions) => {
      if (current) setResolvedOptions({ source: divisionOptions, divisions });
    });
    return () => { current = false; };
  }, [divisionOptions]);
  const optionsReady = resolvedOptions?.source === divisionOptions;
  const divisions = optionsReady ? resolvedOptions?.divisions : undefined;
  const activeDivisions = useMemo(
    () => divisions?.filter((division) => division.active) ?? [],
    [divisions],
  );
  const firstActiveDivisionId = activeDivisions[0]?.id ?? "";
  const divisionItems = useMemo(
    () =>
      Object.fromEntries(
        (divisions ?? []).map((division) => [
          division.id,
          division.active ? division.name : `${division.name} (nonaktif)`,
        ]),
      ),
    [divisions],
  );
  const filteredWorkers = team;

  // Klik sebelum hidrasi tidak memiliki handler React. Hook ini membuka dialog
  // yang sama setelah komponen siap, sehingga klik pertama tidak hilang.
  useDialogIntent("worker-new", openAddFromHeader);
  useDialogIntent("division-new", () => { if (!readOnly) openCreateDivision(); });

  useEffect(() => {
    if (!pendingEmployeeAction || !optionsReady || !divisions || readOnly) return;
    if (pendingEmployeeAction.mode === "edit") {
      openEdit(pendingEmployeeAction.employee);
    } else if (activeDivisions.length === 0) {
      setPendingEmployeeAction(null);
      openCreateDivision();
    } else {
      const selected = divisions.find((division) => division.id === pendingEmployeeAction.divisionId);
      openAdd(selected?.active ? selected.id : undefined);
    }
  }, [pendingEmployeeAction, optionsReady, divisions, readOnly, activeDivisions]);

  const workerFiltersActive =
    filters.search.trim().length > 0 ||
    workerDivisionFilter !== "semua" ||
    filters.status !== "semua";

  function openAdd(divisionId?: string) {
    if (readOnly) return;
    setPendingEmployeeAction(null);
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
    if (readOnly) return;
    // Retain the static action while only its division prerequisite is pending.
    if (!divisions) {
      setPendingEmployeeAction({ mode: "create", divisionId: workerDivisionFilter });
      return;
    }
    if (activeDivisions.length === 0) {
      openCreateDivision();
      return;
    }
    const selected = divisions.find(
      (division) => division.id === workerDivisionFilter,
    );
    openAdd(selected?.active ? selected.id : undefined);
  }

  function clearWorkerFilters() {
    navigate({ search: null, division: null, status: null });
  }

  function requestEdit(employee: Employee) {
    if (readOnly) return;
    if (!divisions) {
      setPendingEmployeeAction({ mode: "edit", employee });
      return;
    }
    openEdit(employee);
  }

  function openEdit(employee: Employee) {
    if (readOnly) return;
    setPendingEmployeeAction(null);
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
    if (readOnly) return;
    setPendingEmployeeAction(null);
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
    <>
      {tab === "pekerja" ? (
        <div className="flex flex-col">
              {total === 0 && !workerFiltersActive && divisions?.length === 0 ? (
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
                      readOnly ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}><RefreshCw aria-hidden="true" />Muat ulang</Button>
                      ) : (
                        <div className="max-md:hidden">
                          <Button
                            type="button"
                            size="sm"
                            onClick={openCreateDivision}
                            data-dialog-intent="division-new"
                          >
                            <FolderPlus />
                            Buat divisi
                          </Button>
                        </div>
                      )
                    }
                  />
                </div>
              ) : divisions && activeDivisions.length === 0 && total === 0 && !workerFiltersActive ? (
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
                      readOnly ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}><RefreshCw aria-hidden="true" />Muat ulang</Button>
                      ) : (
                        <div className="max-md:hidden">
                          <Button
                            type="button"
                            size="sm"
                            onClick={openCreateDivision}
                            data-dialog-intent="division-new"
                          >
                            <FolderPlus />
                            Tambah divisi
                          </Button>
                        </div>
                      )
                    }
                  />
                </div>
              ) : total === 0 && !workerFiltersActive ? (
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
                      readOnly ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}><RefreshCw aria-hidden="true" />Muat ulang</Button>
                      ) : (
                        <div className="max-md:hidden">
                          <Button
                            type="button"
                            size="sm"
                            data-dialog-intent="worker-new"
                          >
                            <UserPlus />
                            Tambah pekerja
                          </Button>
                        </div>
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
                  divisionOptions={divisionOptions}
                  busyId={busyId}
                  readOnly={readOnly}
                  onEdit={requestEdit}
                  onToggle={requestToggleActive}
                />
              )}
        </div>
      ) : (
        <Suspense fallback={<TeamListSkeleton kind="divisi" />}>
          <DivisionTabContent
            divisionOptions={divisionOptions}
            divisionCounts={divisionCounts}
            busyId={divisionBusyId}
            readOnly={readOnly}
            onCreateDivision={openCreateDivision}
            onAdd={(division) => {
              if (readOnly) return;
              if (divisions) openAdd(division.id);
              else setPendingEmployeeAction({ mode: "create", divisionId: division.id });
            }}
            onEdit={openEditDivision}
            onToggle={(division) => {
              if (division.active) {
                setDeactivateDivisionTarget(division);
              } else {
                void setDivisionActive(division, true);
              }
            }}
          />
        </Suspense>
      )}

      <Modal
        open={pendingEmployeeAction !== null}
        onClose={() => setPendingEmployeeAction(null)}
        title={pendingEmployeeAction?.mode === "edit" ? "Ubah data pekerja" : "Tambah pekerja"}
        description="Pilihan divisi diperlukan sebelum formulir pekerja dibuka."
        size="md"
      >
        {optionsReady && !divisions ? (
          <DataLoadError message="Pilihan divisi belum dapat dimuat. Coba lagi untuk melanjutkan." />
        ) : (
          <div className="flex flex-col gap-2" role="status" aria-label="Memuat pilihan divisi"><p className="text-sm text-muted-foreground">Memuat pilihan divisi…</p><Skeleton className="h-8 w-full" /></div>
        )}
      </Modal>

      <Modal
        open={addOpen || Boolean(editing)}
        onClose={closeModal}
        title={editing ? "Ubah data pekerja" : "Tambah pekerja"}
        description={
          editing
            ? `${editing.name} · ${editing.nik}`
            : "NIK, email, dan WhatsApp digunakan untuk login OTP."
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
                {(divisions ?? [])
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
              Format 08xx atau 628xx untuk OTP dan notifikasi SPKL.
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
              Untuk login dan OTP cadangan saat WhatsApp gagal.
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
    </>
  );
}

