"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { FilterPending } from "@/components/filters/filter-pending";
import {
  useDebouncedFilterValue,
  useFilterNavigation,
  useOptimisticFilterValue,
} from "@/components/filters/use-filter-navigation";
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
import type {
  ManualWorkFilterDivision,
  ManualWorkFilterWorker,
} from "@/lib/manual-work-types";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "aktif", label: "Aktif" },
  { value: "terlambat", label: "Terlambat" },
  { value: "belum_mulai", label: "Belum mulai" },
  { value: "selesai", label: "Selesai" },
  { value: "dibatalkan", label: "Dibatalkan" },
  { value: "semua", label: "Semua" },
];

interface WorkerGroup {
  id: string;
  name: string;
  workers: ManualWorkFilterWorker[];
}

export function ManualWorkFilters({
  status,
  search,
  divisionId,
  employeeId,
  divisions,
  workers,
}: {
  status: string;
  search: string;
  divisionId: string;
  employeeId: string;
  divisions: ManualWorkFilterDivision[];
  workers: ManualWorkFilterWorker[];
}) {
  const { isPending, navigate } = useFilterNavigation({ status: "aktif" });
  const [currentStatus, setCurrentStatus] = useOptimisticFilterValue(
    status,
    isPending,
  );
  const [currentDivision, setCurrentDivision] = useOptimisticFilterValue(
    divisionId,
    isPending,
  );
  const [currentEmployee, setCurrentEmployee] = useOptimisticFilterValue(
    employeeId,
    isPending,
  );
  const searchState = useDebouncedFilterValue(search, (next) =>
    navigate({ search: next }),
  );

  const activeDivision =
    currentDivision && currentDivision !== "semua" ? currentDivision : null;
  const visibleWorkers = useMemo(
    () =>
      activeDivision
        ? workers.filter((worker) => worker.divisionId === activeDivision)
        : workers,
    [activeDivision, workers],
  );

  const workerGroups = useMemo(() => {
    const groups = new Map<string, WorkerGroup>();
    for (const worker of visibleWorkers) {
      const id = worker.divisionId ?? "tanpa";
      const group = groups.get(id);
      if (group) {
        group.workers.push(worker);
      } else {
        groups.set(id, {
          id,
          name: worker.divisionName ?? "Tanpa divisi",
          workers: [worker],
        });
      }
    }
    return [...groups.values()];
  }, [visibleWorkers]);

  const divisionItems = useMemo(() => {
    const items: Record<string, string> = { semua: "Semua divisi" };
    for (const division of divisions) {
      items[division.id] = division.active
        ? division.name
        : `${division.name} (nonaktif)`;
    }
    return items;
  }, [divisions]);

  const workerItems = useMemo(() => {
    const items: Record<string, string> = { semua: "Semua pekerja" };
    for (const worker of visibleWorkers) items[worker.id] = worker.name;
    return items;
  }, [visibleWorkers]);

  const filtered =
    currentStatus !== "aktif" ||
    searchState.text.length > 0 ||
    Boolean(activeDivision) ||
    (currentEmployee !== "" && currentEmployee !== "semua");

  function changeDivision(value: string) {
    setCurrentDivision(value);
    setCurrentEmployee("semua");
    navigate({
      divisionId: value === "semua" ? null : value,
      employeeId: null,
    });
  }

  function changeEmployee(value: string) {
    setCurrentEmployee(value);
    navigate({ employeeId: value === "semua" ? null : value });
  }

  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
      <div className="min-w-0 xl:flex-1">
        <InputGroup>
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
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
              <InputGroupButton
                size="icon-xs"
                aria-label="Hapus pencarian"
                onClick={() => searchState.commitNow("")}
              >
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
            const nextStatus = String(value);
            setCurrentStatus(nextStatus);
            navigate({ status: nextStatus });
          }}
          items={STATUS_OPTIONS}
        >
          <SelectTrigger
            className="w-full sm:w-36"
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

        {divisions.length > 0 && (
          <Select
            value={currentDivision || "semua"}
            onValueChange={(value) => {
              if (value === null) return;
              changeDivision(String(value));
            }}
            items={divisionItems}
          >
            <SelectTrigger
              className="w-full sm:w-44"
              aria-label="Filter divisi pekerja"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua divisi</SelectItem>
              {divisions.map((division) => (
                <SelectItem key={division.id} value={division.id}>
                  {division.name}
                  {division.active ? "" : " (nonaktif)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={currentEmployee || "semua"}
          onValueChange={(value) => {
            if (value === null) return;
            changeEmployee(String(value));
          }}
          items={workerItems}
        >
          <SelectTrigger
            className={cn(
              "w-full sm:w-52",
              divisions.length > 0 ? "col-span-2 sm:col-span-1" : "col-span-1",
            )}
            aria-label="Siapa yang bekerja"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua pekerja</SelectItem>
            {workerGroups.map((group) => (
              <SelectGroup key={group.id}>
                <SelectLabel>{group.name}</SelectLabel>
                {group.workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            className="col-span-2 shrink-0 sm:col-span-1"
            nativeButton={false}
            render={<Link href="/pekerjaan" />}
          >
            <X aria-hidden="true" />
            Reset
          </Button>
        )}
        <FilterPending
          pending={isPending}
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </div>
  );
}
