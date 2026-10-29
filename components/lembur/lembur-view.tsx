"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  ClipboardList,
  Plus,
  Search,
  TimerReset,
  X,
} from "lucide-react";
import { SpklCard } from "@/components/spkl/spkl-card";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { EmptyState, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SPKL_STATUS_LABEL } from "@/lib/constants";
import type { SpklListItem, SpklStatus } from "@/lib/types";

const FILTERS: Array<{ value: "semua" | SpklStatus; label: string }> = [
  { value: "semua", label: "Semua" },
  { value: "berlangsung", label: SPKL_STATUS_LABEL.berlangsung },
  { value: "terjadwal", label: SPKL_STATUS_LABEL.terjadwal },
  { value: "selesai", label: SPKL_STATUS_LABEL.selesai },
  { value: "dibatalkan", label: SPKL_STATUS_LABEL.dibatalkan },
];

export function LemburView({
  items,
  readOnly = false,
}: {
  items: SpklListItem[];
  readOnly?: boolean;
}) {
  const [filter, setFilter] = useState<"semua" | SpklStatus>("semua");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const value: Record<string, number> = { semua: items.length };
    for (const item of items) {
      value[item.status] = (value[item.status] ?? 0) + 1;
    }
    return value;
  }, [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "semua" && item.status !== filter) return false;
      if (!query) return true;
      const workerNames = item.workers.map((worker) => worker.name).join(" ");
      return `${item.spkl.title} ${item.spkl.number} ${item.spkl.location.address ?? ""} ${workerNames}`
        .toLowerCase()
        .includes(query);
    });
  }, [filter, items, search]);

  const resetFilters = () => {
    setFilter("semua");
    setSearch("");
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operasional"
        title="Lembur"
        description={
          readOnly
            ? "Kehadiran dan dokumentasi lembur tim."
            : "Kelola SPKL, kehadiran, dan dokumentasi tim."
        }
        descriptionClassName="hidden sm:block"
        action={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button
              nativeButton={false}
              render={<Link href="/laporan?tab=lembur" />}
              variant="outline"
            >
              <BarChart3 aria-hidden="true" />
              Laporan
            </Button>
            {!readOnly && (
              <Button nativeButton={false} render={<Link href="/spkl/baru" />}>
                <Plus aria-hidden="true" />
                Buat SPKL
              </Button>
            )}
          </div>
        }
      />

      <Frame>
        <FrameHeader className="gap-3">
          <div className="flex flex-col gap-1">
            <FrameTitle>Daftar SPKL</FrameTitle>
            <FrameDescription className="text-xs">
              {items.length} SPKL · {counts.berlangsung ?? 0} berlangsung ·{" "}
              {counts.terjadwal ?? 0} terjadwal
            </FrameDescription>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="no-scrollbar -mx-1 min-w-0 overflow-x-auto px-1">
              <Tabs
                value={filter}
                onValueChange={(value) =>
                  setFilter(value as "semua" | SpklStatus)
                }
              >
                <TabsList className="w-max">
                  {FILTERS.map((item) => (
                    <TabsTrigger key={item.value} value={item.value}>
                      {item.label}
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                        {counts[item.value] ?? 0}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <InputGroup className="w-full lg:w-72">
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari judul, nomor SPKL, atau pekerja…"
                aria-label="Cari SPKL"
              />
              {search && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="icon-xs"
                    onClick={() => setSearch("")}
                    aria-label="Hapus pencarian"
                  >
                    <X aria-hidden="true" />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
          </div>
        </FrameHeader>

        {filtered.length > 0 ? (
          <FramePanel className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <SpklCard key={item.spkl.id} item={item} context="supervisor" />
            ))}
          </FramePanel>
        ) : (
          <FramePanel>
            <EmptyState
              icon={items.length === 0 ? ClipboardList : Search}
              title={
                items.length === 0
                  ? "Belum ada SPKL"
                  : "Tidak ada SPKL yang cocok"
              }
              description={
                items.length === 0
                  ? readOnly
                    ? "Belum ada penugasan lembur untuk tim ini."
                    : "Buat SPKL untuk menugaskan tim."
                  : "Coba kata kunci lain atau tampilkan semua status."
              }
              action={
                items.length === 0 ? (
                  readOnly ? undefined : (
                    <Button
                      nativeButton={false}
                      render={<Link href="/spkl/baru" />}
                    >
                      <Plus aria-hidden="true" />
                      Buat SPKL
                    </Button>
                  )
                ) : (
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    <TimerReset aria-hidden="true" />
                    Tampilkan semua
                  </Button>
                )
              }
            />
          </FramePanel>
        )}

      </Frame>
    </div>
  );
}
