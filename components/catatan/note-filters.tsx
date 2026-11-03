"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const AUTHOR_OPTIONS = [
  { value: "semua", label: "Semua penulis" },
  { value: "saya", label: "Catatan saya" },
];

const AUDIENCE_OPTIONS = [
  { value: "semua", label: "Semua jenis" },
  { value: "divisi", label: "Divisi" },
  { value: "karyawan", label: "Rekan kerja" },
];

export function NoteFilters({
  search,
  onlyMine,
  audience,
}: {
  search: string;
  onlyMine: boolean;
  audience: "semua" | "divisi" | "karyawan";
}) {
  const { isPending, navigate } = useFilterNavigation();
  const [currentMine, setCurrentMine] = useOptimisticFilterValue(
    onlyMine ? "saya" : "semua",
    isPending,
  );
  const [currentAudience, setCurrentAudience] = useOptimisticFilterValue(
    audience,
    isPending,
  );
  const [open, setOpen] = useState(false);
  const searchState = useDebouncedFilterValue(search, (next) =>
    navigate({ q: next }),
  );

  const filtered =
    searchState.text.trim().length > 0 ||
    currentMine === "saya" ||
    currentAudience !== "semua";
  // Search stays in the toolbar, so the badge only counts sheet filters.
  const advancedCount =
    (currentMine === "saya" ? 1 : 0) + (currentAudience !== "semua" ? 1 : 0);

  function resetFilters() {
    searchState.cancelPending();
    searchState.reset();
    setCurrentMine("semua");
    setCurrentAudience("semua");
    navigate({ q: null, penulis: null, jenis: null });
  }

  function authorSelect(sheet: boolean) {
    return (
      <Select
        value={currentMine}
        onValueChange={(value) => {
          if (value === null) return;
          const next = String(value);
          setCurrentMine(next);
          navigate({ penulis: next === "saya" ? "saya" : null });
        }}
        items={AUTHOR_OPTIONS}
      >
        <SelectTrigger
          id={sheet ? "note-author-filter-sheet" : "note-author-filter"}
          className={sheet ? "w-full" : "w-full xl:w-40"}
          aria-label="Filter penulis"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AUTHOR_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  function audienceSelect(sheet: boolean) {
    return (
      <Select
        value={currentAudience}
        onValueChange={(value) => {
          if (value === null) return;
          const next = String(value);
          setCurrentAudience(next as "semua" | "divisi" | "karyawan");
          navigate({ jenis: next === "semua" ? null : next });
        }}
        items={AUDIENCE_OPTIONS}
      >
        <SelectTrigger
          id={sheet ? "note-audience-filter-sheet" : "note-audience-filter"}
          className={sheet ? "w-full" : "w-full xl:w-40"}
          aria-label="Filter jenis catatan"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AUDIENCE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="flex min-w-0 items-center gap-2 xl:flex-1">
          <InputGroup className="min-w-0 flex-1">
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
              placeholder="Cari judul, isi, atau penulis…"
              aria-label="Cari catatan"
              maxLength={80}
            />
            {searchState.text && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label="Hapus pencarian"
                  onClick={() => searchState.commitNow("")}
                >
                  <X aria-hidden="true" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 xl:hidden"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={
              advancedCount > 0
                ? `Buka filter catatan, ${advancedCount} filter aktif`
                : "Buka filter catatan"
            }
            onClick={() => setOpen(true)}
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

        <div className="hidden flex-wrap items-center gap-2 xl:flex">
          {authorSelect(false)}
          {audienceSelect(false)}

          {filtered && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetFilters}
            >
              <X aria-hidden="true" />
              Reset
            </Button>
          )}
          <FilterPending pending={isPending} />
        </div>

        <div className="xl:hidden">
          <FilterPending pending={isPending} />
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0">
          <SheetHeader className="border-b border-border/70">
            <SheetTitle>Filter catatan</SheetTitle>
            <SheetDescription>
              Pilih penulis dan jenis catatan. Perubahan langsung diterapkan.
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="note-author-filter-sheet">Penulis</Label>
              {authorSelect(true)}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="note-audience-filter-sheet">Jenis catatan</Label>
              {audienceSelect(true)}
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
    </>
  );
}
