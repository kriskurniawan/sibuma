"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Search, X } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SPKL_STATUS_LABEL } from "@/lib/constants";
import type { SpklStatus } from "@/lib/types";

export type SpklListFilter = "semua" | SpklStatus;
export type SpklListCountSlots = Partial<Record<SpklListFilter, ReactNode>>;

const FILTERS: Array<{ value: SpklListFilter; label: string }> = [
  { value: "semua", label: "Semua" },
  { value: "berlangsung", label: SPKL_STATUS_LABEL.berlangsung },
  { value: "terjadwal", label: SPKL_STATUS_LABEL.terjadwal },
  { value: "selesai", label: SPKL_STATUS_LABEL.selesai },
  { value: "dibatalkan", label: SPKL_STATUS_LABEL.dibatalkan },
];

interface SpklListControls {
  filter: SpklListFilter;
  search: string;
  setFilter: (value: SpklListFilter) => void;
  setSearch: (value: string) => void;
  resetFilters: () => void;
}

const SpklListControlsContext = createContext<SpklListControls | null>(null);

/** Owns controls outside the streamed data regions, so pending input survives. */
export function SpklListControlsProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<SpklListFilter>("semua");
  const [search, setSearch] = useState("");
  const resetFilters = useCallback(() => {
    setFilter("semua");
    setSearch("");
  }, []);
  const value = useMemo(
    () => ({ filter, search, setFilter, setSearch, resetFilters }),
    [filter, search, resetFilters],
  );

  return <SpklListControlsContext.Provider value={value}>{children}</SpklListControlsContext.Provider>;
}

export function useSpklListControls() {
  const value = useContext(SpklListControlsContext);
  if (!value) throw new Error("SpklListControlsProvider is required for list controls.");
  return value;
}

export function SpklListCount({ value, error = false }: { value?: number; error?: boolean }) {
  if (error) return <span aria-label="Jumlah belum tersedia">—</span>;
  return value === undefined ? <Skeleton className="inline-block h-4 w-4 align-middle" /> : value;
}

export function SpklListToolbar({
  counts = {},
  searchPlaceholder,
  searchLabel,
  searchClassName,
}: {
  counts?: SpklListCountSlots;
  searchPlaceholder: string;
  searchLabel: string;
  searchClassName: string;
}) {
  const { filter, search, setFilter, setSearch } = useSpklListControls();

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="no-scrollbar -mx-1 min-w-0 overflow-x-auto px-1">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as SpklListFilter)}>
          <TabsList className="w-max">
            {FILTERS.map((item) => (
              <TabsTrigger key={item.value} value={item.value} type="button">
                {item.label}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {counts[item.value] ?? <SpklListCount />}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <InputGroup className={searchClassName}>
        <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
        <InputGroupInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
        />
        {search && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="button" size="icon-xs" onClick={() => setSearch("")} aria-label="Hapus pencarian">
              <X aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  );
}
