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

const STATUS_OPTIONS = [
  { value: "aktif", label: "Belum selesai" },
  { value: "terlambat", label: "Terlambat" },
  { value: "terbuka", label: "Terbuka" },
  { value: "diproses", label: "Diproses" },
  { value: "tertunda", label: "Tertunda" },
  { value: "selesai", label: "Selesai" },
  { value: "dibatalkan", label: "Dibatalkan" },
  { value: "semua", label: "Semua status" },
];

export function ChecklistFollowUpFilters({
  filters,
}: {
  filters: { status: string; search: string; mine: boolean };
}) {
  const { isPending, navigate } = useFilterNavigation({
    status: "aktif",
    mine: "",
  });
  const [status, setStatus] = useOptimisticFilterValue(
    filters.status,
    isPending,
  );
  const [mine, setMine] = useOptimisticFilterValue(filters.mine, isPending);
  const search = useDebouncedFilterValue(filters.search, (next) =>
    navigate({ search: next }),
  );
  const filtered =
    status !== "aktif" || Boolean(search.text.trim()) || Boolean(mine);

  return (
    <div
      role="group"
      aria-label="Filter tindak lanjut"
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
          aria-label="Cari tindak lanjut"
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
          placeholder="Cari judul, lokasi, atau PIC…"
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
            aria-label="Status tindak lanjut"
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

        <Label
          htmlFor="mine"
          className="flex h-8 items-center gap-2 text-sm font-normal text-foreground"
        >
          <Checkbox
            id="mine"
            checked={mine}
            onCheckedChange={(checked) => {
              const nextMine = checked === true;
              setMine(nextMine);
              navigate({ mine: nextMine ? "1" : "" });
            }}
          />
          Hanya PIC saya
        </Label>

        <FilterPending pending={isPending} />

        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<Link href="/checklist/tindak-lanjut" />}
          >
            <X aria-hidden="true" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
