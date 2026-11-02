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
  const searchState = useDebouncedFilterValue(search, (next) =>
    navigate({ q: next }),
  );

  const filtered =
    searchState.text.trim().length > 0 ||
    currentMine === "saya" ||
    currentAudience !== "semua";

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
            placeholder="Cari judul, isi, atau penulis…"
            aria-label="Cari catatan"
            maxLength={80}
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
          value={currentMine}
          onValueChange={(value) => {
            if (value === null) return;
            const next = String(value);
            setCurrentMine(next);
            navigate({ penulis: next === "saya" ? "saya" : null });
          }}
          items={AUTHOR_OPTIONS}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter penulis">
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
            className="w-full sm:w-40"
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

        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            className="col-span-2 shrink-0 sm:col-span-1"
            nativeButton={false}
            render={<Link href="/catatan" />}
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
