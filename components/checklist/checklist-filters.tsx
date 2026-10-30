"use client";

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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChecklistLocationOption } from "@/lib/checklist-location-path";

const STATUS_OPTIONS = [
  { value: "aktif", label: "Perlu dikerjakan" },
  { value: "terlambat", label: "Terlambat" },
  { value: "belum_dimulai", label: "Belum dimulai" },
  { value: "berlangsung", label: "Berlangsung" },
  { value: "selesai", label: "Selesai" },
  { value: "semua", label: "Semua status" },
];

const SCOPE_OPTIONS = [
  { value: "1", label: "Termasuk sub-lokasi" },
  { value: "0", label: "Hanya area ini" },
];

export function ChecklistFilterBar({
  filters,
  locations,
  resetHref = "/checklist",
}: {
  filters: {
    status: string;
    locationId: string;
    search: string;
    includeSubLocations: boolean;
  };
  locations: ChecklistLocationOption[];
  resetHref?: string;
}) {
  const { isPending, navigate } = useFilterNavigation({
    status: "aktif",
    includeSub: "1",
  });
  const [status, setStatus] = useOptimisticFilterValue(
    filters.status,
    isPending,
  );
  const [locationId, setLocationId] = useOptimisticFilterValue(
    filters.locationId,
    isPending,
  );
  const [includeSub, setIncludeSub] = useOptimisticFilterValue(
    filters.includeSubLocations ? "1" : "0",
    isPending,
  );
  const search = useDebouncedFilterValue(filters.search, (next) =>
    navigate({ search: next }),
  );

  const locationItems = [
    { value: "", label: "Semua lokasi" },
    ...locations.map((location) => ({
      value: location.id,
      label: location.path,
    })),
  ];
  const filtered =
    status !== "aktif" ||
    Boolean(locationId || search.text) ||
    includeSub === "0";

  return (
    <div
      role="group"
      aria-label="Filter checklist"
      className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <InputGroup className="w-full md:max-w-xs">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          inputMode="search"
          enterKeyHint="search"
          aria-label="Cari checklist"
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
          placeholder="Cari template, kategori, atau lokasi…"
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

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Select
          value={status}
          onValueChange={(next) => {
            if (next === null) return;
            const nextStatus = String(next);
            setStatus(nextStatus);
            navigate({ status: nextStatus });
          }}
          items={STATUS_OPTIONS}
        >
          <SelectTrigger
            size="sm"
            aria-label="Status checklist"
            className="w-full sm:w-44"
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

        <Select
          value={locationId}
          onValueChange={(next) => {
            if (next === null) return;
            const nextLocation = String(next);
            setLocationId(nextLocation);
            navigate({ locationId: nextLocation });
          }}
          items={locationItems}
        >
          <SelectTrigger
            size="sm"
            aria-label="Lokasi checklist"
            className="w-full sm:w-56"
          >
            <SelectValue placeholder="Semua lokasi" />
          </SelectTrigger>
          <SelectContent>
            {locationItems.map((option) => (
              <SelectItem key={option.value || "__all"} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {locationId && (
          <Select
            value={includeSub}
            onValueChange={(next) => {
              if (next === null) return;
              const nextScope = String(next);
              setIncludeSub(nextScope);
              navigate({ includeSub: nextScope });
            }}
            items={SCOPE_OPTIONS}
          >
            <SelectTrigger
              size="sm"
              aria-label="Cakupan area"
              className="w-full sm:w-44"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <FilterPending pending={isPending} />

        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<Link href={resetHref} />}
          >
            <X aria-hidden="true" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
