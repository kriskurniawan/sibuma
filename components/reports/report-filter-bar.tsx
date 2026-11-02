"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { FilterPending } from "@/components/filters/filter-pending";
import {
  useDebouncedFilterValue,
  useFilterNavigation,
  useOptimisticFilterValue,
} from "@/components/filters/use-filter-navigation";
import { ReportDateFilters } from "@/components/reports/report-date-filters";
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
  SelectItem,
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
const ReportNavigationContext = createContext<{
  isPending: boolean;
  navigate: Navigate;
} | null>(null);

/** Dynamic options appear inline on desktop and inside the filter sheet on
 * smaller screens, so their labels and widths follow their placement. */
const ReportFilterPlacementContext = createContext<"inline" | "sheet">(
  "inline",
);

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
  const sheet = useContext(ReportFilterPlacementContext) === "sheet";
  const fieldId = sheet ? `${filter.id}-sheet` : filter.id;

  const select = (
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
        id={fieldId}
        aria-label={filter.label}
        className={
          sheet
            ? "w-full"
            : cn("w-full", filter.className ?? "sm:w-40")
        }
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

  if (!sheet) return select;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId}>{filter.label}</Label>
      {select}
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

export function ReportSelectFilters({
  filters,
}: {
  filters: ReportFilterSelect[];
}) {
  const navigation = useContext(ReportNavigationContext);
  if (!navigation)
    throw new Error("ReportFilterBar is required for report selects.");
  const { isPending, navigate } = navigation;
  return filters.map((filter) => (
    <AutoSelectFilter
      key={filter.key}
      filter={filter}
      navigate={navigate}
      pending={isPending}
    />
  ));
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
  selectContent,
  summary,
  activeCount = 0,
  resetHref,
}: {
  ariaLabel: string;
  from: string;
  to: string;
  search: string;
  searchId: string;
  searchLabel?: string;
  searchPlaceholder: string;
  selectFilters?: ReportFilterSelect[];
  /** Database-backed selects can stream without replacing search or dates. */
  selectContent?: ReactNode;
  summary?: ReactNode;
  /** Filters other than search; used for the mobile Filter badge. */
  activeCount?: number;
  resetHref: string;
}) {
  const { isPending, navigate } = useFilterNavigation({ includeSub: "1" });
  const [open, setOpen] = useState(false);
  const openLabel =
    activeCount > 0
      ? `Buka ${ariaLabel.toLowerCase()}, ${activeCount} filter aktif`
      : `Buka ${ariaLabel.toLowerCase()}`;

  return (
    <ReportNavigationContext.Provider value={{ isPending, navigate }}>
      <div role="group" aria-label={ariaLabel} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-start">
          <div className="flex min-w-0 items-center gap-2 xl:w-72 xl:flex-none">
            <AutoSearchFilter
              id={searchId}
              label={searchLabel}
              value={search}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1"
              navigate={navigate}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 xl:hidden"
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-label={openLabel}
              onClick={() => setOpen(true)}
            >
              <SlidersHorizontal aria-hidden="true" />
              Filter
              {activeCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-xs font-medium tabular-nums text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </Button>
          </div>

          <div className="hidden min-w-0 flex-wrap items-start gap-2 xl:flex">
            <ReportDateFilters
              from={from}
              to={to}
              onChange={(nextFrom, nextTo) =>
                navigate({ from: nextFrom, to: nextTo })
              }
            />

            {selectContent}

            <ReportSelectFilters filters={selectFilters} />

            <FilterPending pending={isPending} />
          </div>

          <div className="xl:hidden">
            <FilterPending pending={isPending} />
          </div>
        </div>

        {summary && (
          <div className="text-xs text-muted-foreground">{summary}</div>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0">
          <SheetHeader className="border-b border-border/70">
            <SheetTitle>Filter laporan</SheetTitle>
            <SheetDescription>
              Atur rentang tanggal dan filter laporan. Perubahan langsung
              diterapkan.
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Rentang tanggal</Label>
              <ReportDateFilters
                from={from}
                to={to}
                errorId="report-date-range-error-sheet"
                onChange={(nextFrom, nextTo) =>
                  navigate({ from: nextFrom, to: nextTo })
                }
              />
            </div>

            <ReportFilterPlacementContext.Provider value="sheet">
              {selectContent}
              <ReportSelectFilters filters={selectFilters} />
            </ReportFilterPlacementContext.Provider>
          </div>

          <SheetFooter className="flex-row gap-2 border-t border-border/70 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              variant="outline"
              className="flex-1"
              nativeButton={false}
              render={<Link href={resetHref} />}
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
    </ReportNavigationContext.Provider>
  );
}
