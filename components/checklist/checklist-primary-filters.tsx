"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useDebouncedFilterValue, useFilterNavigation } from "@/components/filters/use-filter-navigation";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChecklistLocationOption } from "@/lib/checklist-location-path";

const STATUSES = [
  { value: "aktif", label: "Perlu dikerjakan" },
  { value: "terlambat", label: "Terlambat" },
  { value: "belum_dimulai", label: "Belum diisi" },
  { value: "berlangsung", label: "Berlangsung" },
  { value: "selesai", label: "Selesai" },
  { value: "semua", label: "Semua status" },
];
const QUICK_STATUSES = [
  { value: "aktif", label: "Aktif" },
  { value: "terlambat", label: "Terlambat" },
  { value: "selesai", label: "Selesai" },
  { value: "semua", label: "Semua" },
];
const SCOPES = [{ value: "1", label: "Termasuk sub-lokasi" }, { value: "0", label: "Hanya area ini" }];

/** Only the options slot suspends; search, static status and sheet stay mounted. */
export function ChecklistLocationFilter({ locations }: { locations?: ChecklistLocationOption[] }) {
  const params = useSearchParams();
  const { navigate } = useFilterNavigation({ status: "aktif", includeSub: "1" });
  const value = params.get("locationId") ?? "";
  const items = [{ value: "", label: "Semua lokasi" }, ...(locations ?? []).map((location) => ({ value: location.id, label: location.path }))];
  if (value && !items.some((item) => item.value === value)) items.push({ value, label: "Lokasi terpilih" });
  return <Select value={value} items={items} disabled={!locations} onValueChange={(next) => { if (next !== null) navigate({ locationId: String(next) }); }}>
    <SelectTrigger size="sm" aria-label="Lokasi checklist" className="w-full sm:w-56"><SelectValue placeholder="Semua lokasi" /></SelectTrigger>
    <SelectContent>{items.map((item) => <SelectItem key={item.value || "__all"} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
  </Select>;
}

export function ChecklistPrimaryFilters({ locations }: { locations?: ReactNode }) {
  const params = useSearchParams();
  const { navigate } = useFilterNavigation({ status: "aktif", includeSub: "1" });
  const status = params.get("status") ?? "aktif";
  const locationId = params.get("locationId") ?? "";
  const includeSub = params.get("includeSub") !== "0";
  const search = useDebouncedFilterValue(params.get("search") ?? "", (next) => navigate({ search: next }));
  const [open, setOpen] = useState(false);
  const filtered = status !== "aktif" || Boolean(locationId || search.text) || !includeSub;

  const searchInput = (mobile: boolean) => <InputGroup className={mobile ? "min-w-0 flex-1" : "w-full md:max-w-xs"}>
    <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
    <InputGroupInput type="search" inputMode="search" enterKeyHint="search" aria-label="Cari checklist" placeholder={mobile ? "Cari checklist…" : "Cari template, kategori, atau lokasi…"} value={search.text} onChange={(event) => search.change(event.target.value)} onFocus={search.onFocus} onBlur={search.onBlur} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search.commitNow(event.currentTarget.value); } }} />
    {search.text && <InputGroupAddon align="inline-end"><InputGroupButton type="button" size="icon-xs" aria-label="Hapus pencarian" onClick={() => search.commitNow("")}><X aria-hidden="true" /></InputGroupButton></InputGroupAddon>}
  </InputGroup>;
  const statusSelect = <Select value={status} items={STATUSES} onValueChange={(next) => { if (next !== null) navigate({ status: String(next) }); }}>
    <SelectTrigger size="sm" aria-label="Status checklist" className="w-full sm:w-44"><SelectValue /></SelectTrigger>
    <SelectContent>{STATUSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
  </Select>;
  const scopeSelect = locationId ? <Select value={includeSub ? "1" : "0"} items={SCOPES} onValueChange={(next) => { if (next !== null) navigate({ includeSub: String(next) }); }}>
    <SelectTrigger size="sm" aria-label="Cakupan area" className="w-full sm:w-44"><SelectValue /></SelectTrigger>
    <SelectContent>{SCOPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
  </Select> : null;

  return <>
    <div className="hidden border-b border-border p-4 md:block">
      <div role="group" aria-label="Filter checklist" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {searchInput(false)}
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {statusSelect}{locations ?? <ChecklistLocationFilter />}{scopeSelect}
          {filtered && <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/checklist" />}><X aria-hidden="true" />Reset</Button>}
        </div>
      </div>
    </div>
    <div className="border-b border-border p-4 md:hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">{searchInput(true)}<Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-label="Buka filter checklist"><SlidersHorizontal aria-hidden="true" />Filter</Button></div>
        <div className="no-scrollbar -mx-1 overflow-x-auto px-1"><Tabs value={status} onValueChange={(next) => { if (next) navigate({ status: String(next) }); }}><TabsList aria-label="Status checklist" className="w-max">{QUICK_STATUSES.map((item) => <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>)}</TabsList></Tabs></div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[85dvh]">
          <SheetHeader><SheetTitle>Filter checklist</SheetTitle><SheetDescription>Pilih area dan status. Perubahan langsung diterapkan.</SheetDescription></SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            <div className="flex flex-col gap-2"><Label>Lokasi</Label>{locations ?? <ChecklistLocationFilter />}</div>
            {scopeSelect && <div className="flex flex-col gap-2"><Label>Cakupan area</Label>{scopeSelect}</div>}
            <div className="flex flex-col gap-2"><Label>Status terperinci</Label>{statusSelect}</div>
          </div>
          <SheetFooter className="flex-row gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => { search.reset(); navigate({ search: null, status: null, locationId: null, includeSub: null }); }}>Reset</Button><Button type="button" className="flex-1" onClick={() => setOpen(false)}>Selesai</Button></SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  </>;
}
