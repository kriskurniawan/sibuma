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
import { Label } from "@/components/ui/label";
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

  return (
    <div
      role="group"
      aria-label="Filter checklist"
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <div className="flex flex-col gap-2 xl:col-span-2">
          <Label htmlFor="status">Status</Label>
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
            <SelectTrigger id="status" className="w-full">
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
        </div>
        <div className="flex flex-col gap-2 xl:col-span-3">
          <Label htmlFor="locationId">Lokasi</Label>
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
            <SelectTrigger id="locationId" className="w-full">
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
        </div>
        <div className="flex flex-col gap-2 xl:col-span-2">
          <Label htmlFor="includeSub">Cakupan area</Label>
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
            <SelectTrigger id="includeSub" className="w-full">
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
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-3">
          <Label htmlFor="search">Cari</Label>
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              id="search"
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
              placeholder="Template, kategori, atau lokasi…"
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
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <FilterPending pending={isPending} />
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={resetHref} />}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
