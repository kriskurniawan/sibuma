"use client";

import { useMemo, useRef, useState } from "react";
import { Check, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { FilterPending } from "@/components/filters/filter-pending";
import {
  useDebouncedFilterValue,
  useFilterNavigation,
  useOptimisticFilterValue,
} from "@/components/filters/use-filter-navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChecklistLocationOption } from "@/lib/checklist-location-path";

const QUICK_STATUS = [
  { value: "aktif", label: "Aktif" },
  { value: "terlambat", label: "Terlambat" },
  { value: "selesai", label: "Selesai" },
  { value: "semua", label: "Semua" },
];

const DETAILED_STATUS = [
  { value: "aktif", label: "Perlu dikerjakan" },
  { value: "terlambat", label: "Terlambat" },
  { value: "belum_dimulai", label: "Belum dimulai" },
  { value: "berlangsung", label: "Berlangsung" },
  { value: "selesai", label: "Selesai" },
  { value: "semua", label: "Semua status" },
];

const QUICK_VALUES = new Set(QUICK_STATUS.map((option) => option.value));

export function ChecklistMobileFilters({
  filters,
  locations,
}: {
  filters: {
    status: string;
    locationId: string;
    search: string;
    includeSubLocations: boolean;
  };
  locations: ChecklistLocationOption[];
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
    filters.includeSubLocations,
    isPending,
  );
  const search = useDebouncedFilterValue(filters.search, (next) =>
    navigate({ search: next }),
  );
  const [open, setOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);

  const advancedCount =
    (locationId ? 1 : 0) +
    (locationId && !includeSub ? 1 : 0) +
    (QUICK_VALUES.has(status) ? 0 : 1);

  const selectedLocation = locations.find(
    (location) => location.id === locationId,
  );

  const filteredLocations = useMemo(() => {
    const query = locationQuery.trim().toLowerCase();
    if (!query) return locations;
    return locations.filter((location) =>
      location.path.toLowerCase().includes(query),
    );
  }, [locationQuery, locations]);

  function selectStatus(next: string) {
    setStatus(next);
    navigate({ status: next });
  }

  function selectLocation(next: string | null) {
    if (next) {
      setLocationId(next);
      navigate({ locationId: next });
      return;
    }
    setLocationId("");
    setIncludeSub(true);
    navigate({ locationId: null, includeSub: null });
  }

  function resetFilters() {
    search.reset();
    setStatus("aktif");
    setLocationId("");
    setIncludeSub(true);
    setLocationQuery("");
    navigate({
      status: null,
      locationId: null,
      includeSub: null,
      search: null,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <InputGroup className="min-w-0 flex-1">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            inputMode="search"
            enterKeyHint="search"
            aria-label="Cari checklist"
            placeholder="Cari checklist…"
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

        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          aria-label={
            advancedCount > 0
              ? `Buka filter checklist, ${advancedCount} filter aktif`
              : "Buka filter checklist"
          }
          onClick={() => {
            setLocationQuery("");
            setOpen(true);
          }}
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

      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
        <Tabs
          value={status}
          onValueChange={(value) => {
            if (value) selectStatus(String(value));
          }}
        >
          <TabsList aria-label="Status checklist" className="w-max">
            {QUICK_STATUS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {(selectedLocation || locationId || isPending) && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedLocation && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="max-w-full"
              onClick={() => selectLocation(null)}
            >
              <MapPin aria-hidden="true" />
              <span className="truncate">{selectedLocation.path}</span>
              <X aria-hidden="true" />
              <span className="sr-only">Hapus filter lokasi</span>
            </Button>
          )}
          {locationId && !includeSub && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIncludeSub(true);
                navigate({ includeSub: null });
              }}
            >
              Hanya area ini
              <X aria-hidden="true" />
              <span className="sr-only">Hapus batas cakupan area</span>
            </Button>
          )}
          <FilterPending pending={isPending} />
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0"
          aria-describedby={undefined}
          initialFocus={titleRef}
        >
          <SheetHeader className="border-b border-border/70">
            <SheetTitle ref={titleRef} tabIndex={-1} className="outline-none">
              Filter checklist
            </SheetTitle>
            <SheetDescription>
              Pilih area dan status. Perubahan langsung diterapkan.
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mobile-location-search">Lokasi</Label>
              <InputGroup>
                <InputGroupAddon>
                  <Search aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  id="mobile-location-search"
                  type="search"
                  inputMode="search"
                  placeholder="Cari lokasi…"
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                />
              </InputGroup>

              <div className="rounded-lg border border-border/70">
                <button
                  type="button"
                  onClick={() => selectLocation(null)}
                  aria-pressed={locationId === ""}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1 truncate">Semua lokasi</span>
                  {locationId === "" && (
                    <Check
                      className="size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  )}
                </button>
                {filteredLocations.map((location) => (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => selectLocation(location.id)}
                    aria-pressed={locationId === location.id}
                    className="flex w-full items-center gap-2 border-t border-border/70 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {location.path}
                    </span>
                    {locationId === location.id && (
                      <Check
                        className="size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))}
                {filteredLocations.length === 0 && (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    Lokasi tidak ditemukan.
                  </p>
                )}
              </div>
            </div>

            {locationId && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="mobile-include-sub"
                  checked={includeSub}
                  onCheckedChange={(checked) => {
                    const nextIncludeSub = checked === true;
                    setIncludeSub(nextIncludeSub);
                    navigate({
                      includeSub: nextIncludeSub ? null : "0",
                    });
                  }}
                />
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="mobile-include-sub">
                    Sertakan sub-lokasi
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Tampilkan checklist dari area di bawah lokasi ini.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="mobile-status">Status terperinci</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  if (value !== null) selectStatus(String(value));
                }}
                items={DETAILED_STATUS}
              >
                <SelectTrigger id="mobile-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DETAILED_STATUS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
    </div>
  );
}
