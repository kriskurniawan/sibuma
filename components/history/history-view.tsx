"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  Clock3,
  History,
  Search,
  TimerReset,
  X,
} from "lucide-react";
import { MobileSummary } from "@/components/mobile-summary";
import { SpklCard } from "@/components/spkl/spkl-card";
import {
  Frame,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
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
import type { WorkerOverview } from "@/lib/queries";
import { currentTimeZoneLabel, formatDateHuman } from "@/lib/time";

const FILTERS: Array<{ value: "semua" | SpklStatus; label: string }> = [
  { value: "semua", label: "Semua" },
  { value: "berlangsung", label: SPKL_STATUS_LABEL.berlangsung },
  { value: "terjadwal", label: SPKL_STATUS_LABEL.terjadwal },
  { value: "selesai", label: SPKL_STATUS_LABEL.selesai },
  { value: "dibatalkan", label: SPKL_STATUS_LABEL.dibatalkan },
];

export function HistoryView({ overview }: { overview: WorkerOverview }) {
  const [filter, setFilter] = useState<"semua" | SpklStatus>("semua");
  const [search, setSearch] = useState("");

  const sorted = useMemo(
    () =>
      [...overview.items].sort(
        (a, b) =>
          new Date(b.spkl.startAt).getTime() -
          new Date(a.spkl.startAt).getTime(),
      ),
    [overview.items],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sorted.filter((item) => {
      if (filter !== "semua" && item.status !== filter) return false;
      if (!query) return true;
      return `${item.spkl.title} ${item.spkl.number} ${item.spkl.location.address ?? ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [filter, search, sorted]);

  const grouped = useMemo(() => {
    const groups = new Map<string, SpklListItem[]>();
    for (const item of filtered) {
      const label = formatDateHuman(item.spkl.startAt, "MMMM yyyy");
      const existing = groups.get(label) ?? [];
      existing.push(item);
      groups.set(label, existing);
    }
    return [...groups.entries()];
  }, [filtered]);

  const counts = useMemo(() => {
    const value: Record<string, number> = { semua: overview.items.length };
    for (const item of overview.items) {
      value[item.status] = (value[item.status] ?? 0) + 1;
    }
    return value;
  }, [overview.items]);

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden md:block">
        <PageHeader
          eyebrow="Arsip pribadi"
          title="Lembur."
          description="Semua SPKL yang pernah dan akan kamu jalani, lengkap dengan durasi, kehadiran, dan dokumentasi."
        />
      </div>

      <h1 className="sr-only md:hidden">Lembur</h1>

      <MobileSummary
        className="md:hidden"
        columns={3}
        items={[
          {
            label: "Periode ini",
            tone: "info",
            value: (
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5">
                <span className="sr-only">
                  {Math.floor(overview.stats.monthlyMinutes / 60)} jam{" "}
                  {overview.stats.monthlyMinutes % 60} menit
                </span>
                <span className="inline-flex items-baseline gap-1" aria-hidden="true">
                  {Math.floor(overview.stats.monthlyMinutes / 60)}
                  <span className="text-xs font-medium text-muted-foreground">j</span>
                </span>
                <span className="inline-flex items-baseline gap-1" aria-hidden="true">
                  {overview.stats.monthlyMinutes % 60}
                  <span className="text-xs font-medium text-muted-foreground">m</span>
                </span>
              </span>
            ),
          },
          {
            label: "Sesi selesai",
            value: overview.stats.completedSessions,
            tone: "success",
          },
          {
            label: "Dokumentasi",
            value: overview.stats.documentationCount,
            tone: "info",
          },
        ]}
      />

      <div className="hidden grid-cols-1 gap-3 md:grid md:grid-cols-3">
        <StatCard
          label="Total periode ini"
          value={Math.floor(overview.stats.monthlyMinutes / 60)}
          suffix="jam"
          icon={Clock3}
          helper={`${overview.stats.monthlyMinutes % 60} menit · ${overview.periodLabel}`}
          tone="info"
        />
        <StatCard
          label="Sesi selesai"
          value={overview.stats.completedSessions}
          suffix="sesi"
          icon={CheckCircle2}
          helper={`${overview.stats.monthlySessions} sesi memiliki absensi masuk`}
          tone="success"
        />
        <StatCard
          label="Dokumentasi"
          value={overview.stats.documentationCount}
          suffix="foto"
          icon={Camera}
          helper="Bukti kerja yang kamu unggah pada periode ini"
          tone="info"
        />
      </div>

      <Frame spacing="default">
        <FrameHeader className="gap-3">
          <FrameTitle>Riwayat per bulan</FrameTitle>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="no-scrollbar -mx-1 min-w-0 overflow-x-auto px-1">
              <Tabs
                value={filter}
                onValueChange={(value) =>
                  setFilter(value as "semua" | SpklStatus)
                }
              >
                <TabsList className="w-max">
                  {FILTERS.map((item) => {
                    const count = counts[item.value] ?? 0;
                    return (
                      <TabsTrigger key={item.value} value={item.value}>
                        {item.label}
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                          {count}
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </div>

            <InputGroup className="w-full lg:w-64">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama atau nomor SPKL…"
                aria-label="Cari riwayat SPKL"
              />
              {search && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="icon-xs"
                    onClick={() => setSearch("")}
                    aria-label="Hapus pencarian"
                  >
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
          </div>
        </FrameHeader>

        {grouped.length > 0 ? (
          <FramePanel className="flex flex-col gap-6">
            {grouped.map(([month, items]) => (
              <section key={month} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {month}
                  </h2>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {items.length} SPKL
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => (
                    <SpklCard key={item.spkl.id} item={item} context="worker" />
                  ))}
                </div>
              </section>
            ))}
          </FramePanel>
        ) : (
          <FramePanel>
            <EmptyState
              icon={History}
              title={
                search
                  ? "Tidak ada SPKL yang cocok"
                  : "Belum ada riwayat pada filter ini"
              }
              description={
                search
                  ? "Coba kata kunci lain atau hapus pencarian."
                  : "Penugasan lembur dari atasan akan muncul di sini setelah dibuat."
              }
              action={
                search || filter !== "semua" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setFilter("semua");
                    }}
                  >
                    <TimerReset />
                    Tampilkan semua riwayat
                  </Button>
                ) : (
                  <Button nativeButton={false} render={<Link href="/" />}>
                    <TimerReset />
                    Kembali ke beranda
                  </Button>
                )
              }
            />
          </FramePanel>
        )}

        <FrameFooter className="flex flex-wrap items-start gap-2 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>Ekspor rekap melalui atasan.</p>
          <p>Waktu dalam {currentTimeZoneLabel()}</p>
        </FrameFooter>
      </Frame>

      {overview.items.some((item) => item.status === "berlangsung") && (
        <p className="text-center text-xs font-medium text-muted-foreground">
          Sesi aktif: buka SPKL untuk absen pulang.
        </p>
      )}
    </div>
  );
}
