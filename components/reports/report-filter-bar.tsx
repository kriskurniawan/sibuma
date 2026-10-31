"use client";

import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { FilterPending } from "@/components/filters/filter-pending";
import {
  useDebouncedFilterValue,
  useFilterNavigation,
  useOptimisticFilterValue,
} from "@/components/filters/use-filter-navigation";
import { ReportDateFilters } from "@/components/reports/report-date-filters";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ReportFilterOption {
  value: string;
  label: string;
}

export interface ReportFilterSelect {
  /** Nama parameter URL, mis. "status" atau "locationId". */
  key: string;
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  options: ReportFilterOption[];
  /** Lebar trigger pada layar lebar, mis. "sm:w-44". */
  className?: string;
  /** Parameter lain yang dikembalikan ke default saat filter ini berubah. */
  resetKeys?: string[];
}

type Navigate = (updates: Record<string, string | null | undefined>) => void;

function AutoSelectFilter({
  filter,
  navigate,
  pending,
}: {
  filter: ReportFilterSelect;
  navigate: Navigate;
  pending: boolean;
}) {
  const [value, setValue] = useOptimisticFilterValue(filter.value, pending);

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next === null) return;
        const nextValue = String(next);
        setValue(nextValue);
        navigate({
          [filter.key]: nextValue,
          ...Object.fromEntries(
            (filter.resetKeys ?? []).map((key) => [key, null]),
          ),
        });
      }}
      items={filter.options}
    >
      <SelectTrigger
        id={filter.id}
        aria-label={filter.label}
        className={cn("w-full", filter.className ?? "sm:w-40")}
      >
        <SelectValue placeholder={filter.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {filter.options.map((option) => (
          <SelectItem key={option.value || "__all"} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AutoSearchFilter({
  id,
  label,
  value,
  placeholder,
  className,
  navigate,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  className?: string;
  navigate: Navigate;
}) {
  const search = useDebouncedFilterValue(value, (next) =>
    navigate({ search: next }),
  );

  return (
    <div className={cn("min-w-0", className)}>
      <InputGroup>
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          aria-label={label}
          value={search.text}
          onChange={(event) => search.change(event.target.value)}
          onFocus={search.onFocus}
          onBlur={search.onBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              search.commitNow(event.currentTarget.value);
            }
          }}
          placeholder={placeholder}
        />
        {search.text && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-xs"
              aria-label="Hapus pencarian"
              onClick={() => search.commitNow("")}
            >
              <X aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  );
}

export function ReportFilterBar({
  ariaLabel,
  from,
  to,
  search,
  searchId,
  searchLabel = "Cari",
  searchPlaceholder,
  selectFilters = [],
  summary,
}: {
  ariaLabel: string;
  from: string;
  to: string;
  search: string;
  searchId: string;
  searchLabel?: string;
  searchPlaceholder: string;
  selectFilters?: ReportFilterSelect[];
  summary?: ReactNode;
}) {
  const { isPending, navigate } = useFilterNavigation({ includeSub: "1" });

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-start">
        <AutoSearchFilter
          id={searchId}
          label={searchLabel}
          value={search}
          placeholder={searchPlaceholder}
          className="w-full xl:w-72"
          navigate={navigate}
        />

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-start">
          <ReportDateFilters
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) =>
              navigate({ from: nextFrom, to: nextTo })
            }
            className="col-span-2 sm:col-auto"
          />

          {selectFilters.map((filter) => (
            <AutoSelectFilter
              key={filter.key}
              filter={filter}
              navigate={navigate}
              pending={isPending}
            />
          ))}

          <FilterPending
            pending={isPending}
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </div>

      {summary && (
        <div className="text-xs text-muted-foreground">{summary}</div>
      )}
    </div>
  );
}
