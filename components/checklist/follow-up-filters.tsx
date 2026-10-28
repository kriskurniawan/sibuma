import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
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
  return (
    <form
      method="get"
      aria-label="Filter tindak lanjut"
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <div className="flex flex-col gap-2 xl:col-span-3">
          <Label htmlFor="status">Status</Label>
          <Select
            name="status"
            defaultValue={filters.status}
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

        <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-5">
          <Label htmlFor="search">Cari</Label>
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              id="search"
              name="search"
              defaultValue={filters.search}
              placeholder="Judul, deskripsi, template, lokasi, atau PIC…"
            />
          </InputGroup>
        </div>

        <div className="flex items-end xl:col-span-2">
          <Label
            htmlFor="mine"
            className="flex h-8 items-center gap-2 text-sm font-normal text-foreground"
          >
            <Checkbox
              id="mine"
              name="mine"
              value="1"
              defaultChecked={filters.mine}
            />
            Hanya PIC saya
          </Label>
        </div>

        <div className="flex items-end gap-2 xl:col-span-2">
          <Button type="submit" size="sm" className="flex-1">
            <SlidersHorizontal aria-hidden="true" />
            Terapkan
          </Button>
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
    </form>
  );
}
