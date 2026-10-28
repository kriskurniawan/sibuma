import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  { value: "aktif", label: "Perlu dikerjakan" },
  { value: "terlambat", label: "Terlambat" },
  { value: "belum_dimulai", label: "Belum dimulai" },
  { value: "berlangsung", label: "Berlangsung" },
  { value: "selesai", label: "Selesai" },
  { value: "semua", label: "Semua status" },
];

export function ChecklistFilterBar({
  filters,
  locations,
  resetHref = "/checklist",
}: {
  filters: { status: string; locationId: string; search: string };
  locations: Array<{ id: string; name: string }>;
  resetHref?: string;
}) {
  const locationItems = [
    { value: "", label: "Semua lokasi" },
    ...locations.map((location) => ({
      value: location.id,
      label: location.name,
    })),
  ];

  return (
    <form
      method="get"
      aria-label="Filter checklist"
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
        <div className="flex flex-col gap-2 xl:col-span-3">
          <Label htmlFor="locationId">Lokasi</Label>
          <Select
            name="locationId"
            defaultValue={filters.locationId}
            items={locationItems}
          >
            <SelectTrigger id="locationId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locationItems.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-4">
          <Label htmlFor="search">Cari</Label>
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              id="search"
              name="search"
              defaultValue={filters.search}
              placeholder="Template, kategori, atau lokasi…"
            />
          </InputGroup>
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
            render={<Link href={resetHref} />}
          >
            Reset
          </Button>
        </div>
      </div>
    </form>
  );
}
