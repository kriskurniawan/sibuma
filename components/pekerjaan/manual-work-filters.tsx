"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { readOwnerId } from "@/lib/access";
import type {
  ManualWorkFilterDivision,
  ManualWorkFilters as WorkFilters,
  ManualWorkFilterWorker,
} from "@/lib/manual-work-types";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const searchState = useDebouncedFilterValue(filters.search, (next) => navigate({ search: next }));
  const filtered = currentStatus !== "semua" || searchState.text.length > 0 ||
    Boolean(filters.divisionId) || Boolean(filters.employeeId);

  return (
    <WorkFilterNavigationContext.Provider value={{ isPending, navigate }}>
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
      <div className="min-w-0 xl:flex-1">
        <InputGroup>
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
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Select
          value={currentStatus}
          onValueChange={(value) => {
            if (value === null) return;
            setCurrentStatus(String(value));
            navigate({ status: String(value) });
          }}
          items={STATUS_OPTIONS}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter status"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {dynamicOptions}
        {filtered && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="col-span-2 shrink-0 sm:col-span-1"
            onClick={() => {
              searchState.cancelPending();
              searchState.reset();
              setCurrentStatus("semua");
              navigate({ status: null, search: null, divisionId: null, employeeId: null });
            }}
          >
            <X aria-hidden="true" />Reset
          </Button>
        )}
        <FilterPending pending={isPending} className="col-span-2 sm:col-span-1" />
      </div>
      </div>
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
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter divisi pekerja" aria-busy={loading}><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(divisionItems).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
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
          className={cn("w-full sm:w-52", showDivision ? "col-span-2 sm:col-span-1" : "col-span-1")}
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
      <FilterPending pending={isPending} className="col-span-2 sm:col-span-1" />
      {loading && <span className="sr-only" role="status">Memuat pilihan filter…</span>}
      {error && <div className="col-span-2 sm:col-span-1"><DataLoadError message="Pilihan filter gagal dimuat." /></div>}
    </>
  );
}
