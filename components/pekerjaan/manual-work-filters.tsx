"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { DataLoadError } from "@/components/data-load-error";
import { FilterPending } from "@/components/filters/filter-pending";
import {
  useDebouncedFilterValue,
  useFilterNavigation,
  useOptimisticFilterValue,
} from "@/components/filters/use-filter-navigation";
import { useSessionUser } from "@/components/session-user-provider";
import { Button } from "@/components/ui/button";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { readOwnerId } from "@/lib/access";
import type {
  ManualWorkFilterDivision,
  ManualWorkFilters as WorkFilters,
  ManualWorkFilterWorker,
} from "@/lib/manual-work-types";
import type { SessionUser } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "semua", label: "Semua" },
  { value: "aktif", label: "Aktif" },
  { value: "terlambat", label: "Terlambat" },
  { value: "belum_mulai", label: "Belum mulai" },
  { value: "terbuka", label: "Terbuka" },
  { value: "dikerjakan", label: "Dikerjakan" },
  { value: "selesai", label: "Selesai" },
  { value: "dibatalkan", label: "Dibatalkan" },
];

/** Both filter groups must share one pending URL snapshot; otherwise two
 * overlapping navigations overwrite each other's parameters. */
const WorkFilterNavigationContext = createContext<{
  isPending: boolean;
  navigate: ReturnType<typeof useFilterNavigation>["navigate"];
} | null>(null);

/** Dynamic options render inline on desktop and inside the filter sheet on
 * smaller screens, so their labels and widths follow their placement. */
const WorkFilterPlacementContext = createContext<"inline" | "sheet">("inline");

function useWorkFilters(): Required<WorkFilters> {
  const params = useSearchParams();
  const status = params.get("status") ?? "semua";
  return {
    status: STATUS_OPTIONS.some((option) => option.value === status) ? status : "semua",
    search: params.get("search") ?? "",
    divisionId: params.get("divisionId") === "semua" ? "" : params.get("divisionId") ?? "",
    employeeId: params.get("employeeId") === "semua" ? "" : params.get("employeeId") ?? "",
  };
}

/** Search and status are real controls even before database options arrive. */
export function ManualWorkFilters({ dynamicOptions }: { dynamicOptions: ReactNode }) {
  const filters = useWorkFilters();
  const { isPending, navigate } = useFilterNavigation({ status: "semua" });
  const [currentStatus, setCurrentStatus] = useOptimisticFilterValue(filters.status, isPending);
  const [open, setOpen] = useState(false);
  const searchState = useDebouncedFilterValue(filters.search, (next) => navigate({ search: next }));
  const filtered = currentStatus !== "semua" || searchState.text.length > 0 ||
    Boolean(filters.divisionId) || Boolean(filters.employeeId);
  const advancedCount =
    (currentStatus !== "semua" ? 1 : 0) +
    (filters.divisionId ? 1 : 0) +
    (filters.employeeId ? 1 : 0);

  function resetFilters() {
    searchState.cancelPending();
    searchState.reset();
    setCurrentStatus("semua");
    navigate({ status: null, search: null, divisionId: null, employeeId: null });
  }

  function statusSelect(fullWidth = false) {
    return (
      <Select
        value={currentStatus}
        onValueChange={(value) => {
          if (value === null) return;
          setCurrentStatus(String(value));
          navigate({ status: String(value) });
        }}
        items={STATUS_OPTIONS}
      >
        <SelectTrigger
          className={fullWidth ? "w-full" : "w-full xl:w-36"}
          aria-label="Filter status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <WorkFilterNavigationContext.Provider value={{ isPending, navigate }}>
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="flex min-w-0 items-center gap-2 xl:flex-1">
          <InputGroup className="min-w-0 flex-1">
            <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
            <InputGroupInput
              type="search"
              inputMode="search"
              enterKeyHint="search"
              value={searchState.text}
              onChange={(event) => searchState.change(event.target.value)}
              onFocus={searchState.onFocus}
              onBlur={searchState.onBlur}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  searchState.commitNow(event.currentTarget.value);
                }
              }}
              placeholder="Cari nama pekerjaan atau lokasi…"
              aria-label="Cari pekerjaan harian"
            />
            {searchState.text && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton type="button" size="icon-xs" aria-label="Hapus pencarian" onClick={() => searchState.commitNow("")}>
                  <X aria-hidden="true" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 xl:hidden"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={advancedCount > 0
              ? `Buka filter pekerjaan, ${advancedCount} filter aktif`
              : "Buka filter pekerjaan"}
            onClick={() => setOpen(true)}
          >
            <SlidersHorizontal aria-hidden="true" />
            Filter
            {advancedCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-xs font-medium tabular-nums text-primary-foreground">
                {advancedCount}
              </span>
            )}
          </Button>
        </div>

        <div className="hidden flex-wrap items-center gap-2 xl:flex">
          {statusSelect()}
          <WorkFilterPlacementContext.Provider value="inline">
            {dynamicOptions}
          </WorkFilterPlacementContext.Provider>
          {filtered && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetFilters}
            >
              <X aria-hidden="true" />Reset
            </Button>
          )}
          <FilterPending pending={isPending} />
        </div>

        <div className="xl:hidden">
          <FilterPending pending={isPending} />
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0">
          <SheetHeader className="border-b border-border/70">
            <SheetTitle>Filter pekerjaan</SheetTitle>
            <SheetDescription>
              Pilih status, divisi, dan pekerja. Perubahan langsung diterapkan.
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              {statusSelect(true)}
            </div>
            <WorkFilterPlacementContext.Provider value="sheet">
              {dynamicOptions}
            </WorkFilterPlacementContext.Provider>
          </div>

          <SheetFooter className="flex-row gap-2 border-t border-border/70 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={resetFilters}
            >
              Reset
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Selesai
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </WorkFilterNavigationContext.Provider>
  );
}

export function ManualWorkDynamicFilters({
  divisions = [],
  workers = [],
  loading = false,
  error = false,
  user: snapshot,
}: {
  divisions?: ManualWorkFilterDivision[];
  workers?: ManualWorkFilterWorker[];
  loading?: boolean;
  error?: boolean;
  /** Fresh page user; the layout snapshot is only a loading fallback. */
  user?: SessionUser;
}) {
  const sessionUser = useSessionUser();
  const user = snapshot ?? sessionUser;
  const filters = useWorkFilters();
  const placement = useContext(WorkFilterPlacementContext);
  const sheet = placement === "sheet";
  const fallbackNavigation = useFilterNavigation();
  const { isPending, navigate } = useContext(WorkFilterNavigationContext) ?? fallbackNavigation;
  const [divisionId, setDivision] = useOptimisticFilterValue(filters.divisionId, isPending);
  const [employeeId, setEmployee] = useOptimisticFilterValue(filters.employeeId, isPending);
  // The session determines this slot, not option counts, so loading never moves it.
  const showDivision = !(user.role === "pekerja" && !readOwnerId(user));
  const visibleWorkers = useMemo(
    () => divisionId && divisionId !== "semua" ? workers.filter((worker) => worker.divisionId === divisionId) : workers,
    [divisionId, workers],
  );
  const workerGroups = useMemo(() => {
    const groups = new Map<string, { name: string; workers: ManualWorkFilterWorker[] }>();
    for (const worker of visibleWorkers) {
      const id = worker.divisionId ?? "tanpa";
      const group = groups.get(id);
      if (group) group.workers.push(worker);
      else groups.set(id, { name: worker.divisionName ?? "Tanpa divisi", workers: [worker] });
    }
    return [...groups.entries()];
  }, [visibleWorkers]);
  const divisionItems: Record<string, string> = { semua: "Semua divisi" };
  for (const division of divisions) divisionItems[division.id] = `${division.name}${division.active ? "" : " (nonaktif)"}`;
  if (divisionId && !divisionItems[divisionId]) divisionItems[divisionId] = "Divisi dipilih";
  const workerItems: Record<string, string> = { semua: "Semua pekerja" };
  for (const worker of visibleWorkers) workerItems[worker.id] = worker.name;
  if (employeeId && !workerItems[employeeId]) workerItems[employeeId] = "Pekerja dipilih";

  return (
    <>
      {showDivision && (
        <div className={sheet ? "flex flex-col gap-2" : "contents"}>
          {sheet && <Label>Divisi</Label>}
          <Select
            value={divisionId || "semua"}
            disabled={loading || error}
            items={divisionItems}
            onValueChange={(value) => {
              if (value === null) return;
              setDivision(String(value));
              setEmployee("");
              navigate({ divisionId: value === "semua" ? null : String(value), employeeId: null });
            }}
          >
            <SelectTrigger
              className={sheet ? "w-full" : "w-full xl:w-44"}
              aria-label="Filter divisi pekerja"
              aria-busy={loading}
            ><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(divisionItems).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className={sheet ? "flex flex-col gap-2" : "contents"}>
        {sheet && <Label>Siapa yang bekerja</Label>}
        <Select
          value={employeeId || "semua"}
          disabled={loading || error}
          items={workerItems}
          onValueChange={(value) => {
            if (value === null) return;
            setEmployee(String(value));
            navigate({ employeeId: value === "semua" ? null : String(value) });
          }}
        >
          <SelectTrigger
            className={sheet ? "w-full" : "w-full xl:w-52"}
            aria-label="Siapa yang bekerja"
            aria-busy={loading}
          ><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua pekerja</SelectItem>
            {employeeId && !visibleWorkers.some((worker) => worker.id === employeeId) && (
              <SelectItem value={employeeId}>Pekerja dipilih</SelectItem>
            )}
            {workerGroups.map(([id, group]) => (
              <SelectGroup key={id}>
                <SelectLabel>{group.name}</SelectLabel>
                {group.workers.map((worker) => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      {loading && <span className="sr-only" role="status">Memuat pilihan filter…</span>}
      {error && <div className="w-full"><DataLoadError message="Pilihan filter gagal dimuat." /></div>}
    </>
  );
}
