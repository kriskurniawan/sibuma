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
import { Label } from "@/components/ui/label";
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
  /** Grid span pembungkus, mis. "xl:col-span-2". */
  className?: string;
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
    <div className={cn("flex flex-col gap-2", filter.className)}>
      <Label htmlFor={filter.id}>{filter.label}</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next === null) return;
          const nextValue = String(next);
          setValue(nextValue);
          navigate({ [filter.key]: nextValue });
        }}
        items={filter.options}
      >
        <SelectTrigger id={filter.id} className="w-full">
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
    </div>
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
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <InputGroup>
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          type="search"
          inputMode="search"
          enterKeyHint="search"
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
  searchClassName,
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
  searchClassName?: string;
  selectFilters?: ReportFilterSelect[];
  summary?: ReactNode;
}) {
  const { isPending, navigate } = useFilterNavigation({ includeSub: "1" });

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <ReportDateFilters
          from={from}
          to={to}
          onChange={(nextFrom, nextTo) =>
            navigate({ from: nextFrom, to: nextTo })
          }
        />
        {selectFilters.map((filter) => (
          <AutoSelectFilter
            key={filter.key}
            filter={filter}
            navigate={navigate}
            pending={isPending}
          />
        ))}
        <AutoSearchFilter
          id={searchId}
          label={searchLabel}
          value={search}
          placeholder={searchPlaceholder}
          className={searchClassName}
          navigate={navigate}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterPending pending={isPending} />
        {summary}
      </div>
    </div>
  );
}
