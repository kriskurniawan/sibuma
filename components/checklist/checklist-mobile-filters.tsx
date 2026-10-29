"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(filters.search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(filters.status);
  const [draftLocation, setDraftLocation] = useState(filters.locationId);
  const [draftIncludeSub, setDraftIncludeSub] = useState(
    filters.includeSubLocations,
  );
  const [locationQuery, setLocationQuery] = useState("");

  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const advancedCount =
    (filters.locationId ? 1 : 0) +
    (filters.locationId && !filters.includeSubLocations ? 1 : 0) +
    (QUICK_VALUES.has(filters.status) ? 0 : 1);

  const selectedLocation = locations.find(
    (location) => location.id === filters.locationId,
  );

  const filteredLocations = useMemo(() => {
    const query = locationQuery.trim().toLowerCase();
    if (!query) return locations;
    return locations.filter((location) =>
      location.path.toLowerCase().includes(query),
    );
  }, [locationQuery, locations]);

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (
        !value ||
        (key === "status" && value === "aktif") ||
        (key === "includeSub" && value === "1")
      ) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("page");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  function submitSearch(value: string) {
    if (timer.current) clearTimeout(timer.current);
    navigate({ search: value.trim() || null });
  }

  function changeSearch(value: string) {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => submitSearch(value), 400);
  }

  function openFilters() {
    setDraftStatus(filters.status);
    setDraftLocation(filters.locationId);
    setDraftIncludeSub(filters.includeSubLocations);
    setLocationQuery("");
    setOpen(true);
  }

  function applyFilters() {
    navigate({
      status: draftStatus,
      locationId: draftLocation || null,
      includeSub: draftLocation ? (draftIncludeSub ? null : "0") : null,
    });
    setOpen(false);
  }

  function resetFilters() {
    if (timer.current) clearTimeout(timer.current);
    setSearch("");
    setDraftStatus("aktif");
    setDraftLocation("");
    setDraftIncludeSub(true);
    setLocationQuery("");
    navigate({
      status: null,
      locationId: null,
      includeSub: null,
      search: null,
    });
    setOpen(false);
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
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitSearch(event.currentTarget.value);
              }
            }}
          />
          {search && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Hapus pencarian"
                onClick={() => {
                  setSearch("");
                  submitSearch("");
                }}
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
          onClick={openFilters}
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
          value={filters.status}
          onValueChange={(value) =>
            navigate({ status: value ? String(value) : null })
          }
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

      {(selectedLocation || filters.locationId) && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedLocation && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="max-w-full"
              onClick={() =>
                navigate({ locationId: null, includeSub: null })
              }
            >
              <MapPin aria-hidden="true" />
              <span className="truncate">{selectedLocation.path}</span>
              <X aria-hidden="true" />
              <span className="sr-only">Hapus filter lokasi</span>
            </Button>
          )}
          {filters.locationId && !filters.includeSubLocations && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate({ includeSub: null })}
            >
              Hanya area ini
              <X aria-hidden="true" />
              <span className="sr-only">Hapus batas cakupan area</span>
            </Button>
          )}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0"
          aria-describedby={undefined}
        >
          <SheetHeader className="border-b border-border/70">
            <SheetTitle>Filter checklist</SheetTitle>
            <SheetDescription>
              Pilih area dan status yang ingin ditampilkan.
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
                  onClick={() => setDraftLocation("")}
                  aria-pressed={draftLocation === ""}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1 truncate">Semua lokasi</span>
                  {draftLocation === "" && (
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
                    onClick={() => setDraftLocation(location.id)}
                    aria-pressed={draftLocation === location.id}
                    className="flex w-full items-center gap-2 border-t border-border/70 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {location.path}
                    </span>
                    {draftLocation === location.id && (
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

            {draftLocation && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="mobile-include-sub"
                  checked={draftIncludeSub}
                  onCheckedChange={(checked) =>
                    setDraftIncludeSub(checked === true)
                  }
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
                value={draftStatus}
                onValueChange={(value) => setDraftStatus(String(value))}
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
            <Button type="button" className="flex-1" onClick={applyFilters}>
              Terapkan filter
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
