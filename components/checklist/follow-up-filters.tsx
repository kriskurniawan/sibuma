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

  return (
    <div
      role="group"
      aria-label="Filter tindak lanjut"
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <div className="flex flex-col gap-2 xl:col-span-3">
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

        <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-6">
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
              placeholder="Judul, deskripsi, template, lokasi, atau PIC…"
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

        <div className="flex items-end xl:col-span-3">
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
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <FilterPending pending={isPending} />
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href="/checklist/tindak-lanjut" />}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
