"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { History, TimerReset } from "lucide-react";
import { DataLoadError } from "@/components/data-load-error";
import { SpklListRow, SpklListRowSkeleton } from "@/components/spkl/spkl-card";
import {
  Frame,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { EmptyState, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  SpklListControlsProvider,
  SpklListToolbar,
  useSpklListControls,
  type SpklListCountSlots,
} from "@/components/lembur/spkl-list-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { currentTimeZoneLabel, formatDateHuman } from "@/lib/time";
import type { SpklListItem } from "@/lib/types";

export function HistoryPageShell({
  summary,
  children,
}: {
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        mobileCompact
        eyebrow="Arsip pribadi"
        title="Lembur."
        description="Semua SPKL yang pernah dan akan kamu jalani, lengkap dengan durasi, kehadiran, dan dokumentasi."
      />
      {summary}
      {children}
    </div>
  );
}

function HistoryRowsSkeleton() {
  return (
    <FramePanel className="flex flex-col gap-6" aria-busy="true" role="status">
      <span className="sr-only">Memuat riwayat lembur…</span>
      {Array.from({ length: 2 }, (_, month) => (
        <section key={month} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 px-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="divide-y divide-border/70">
            {Array.from({ length: 3 }, (_, row) => <SpklListRowSkeleton key={row} context="worker" />)}
          </div>
        </section>
      ))}
    </FramePanel>
  );
}

/** Controls and footer persist independently of the rows/count boundaries. */
export function HistoryView({
  counts,
  children,
}: {
  counts?: SpklListCountSlots;
  children: ReactNode;
}) {
  return (
    <SpklListControlsProvider>
      <Frame spacing="xs">
        <FrameHeader className="gap-3">
          <FrameTitle>Riwayat per bulan</FrameTitle>
          <SpklListToolbar
            counts={counts}
            searchPlaceholder="Cari nama atau nomor SPKL…"
            searchLabel="Cari riwayat SPKL"
            searchClassName="w-full lg:w-64"
          />
        </FrameHeader>
        {children}
        <FrameFooter className="flex flex-wrap items-start gap-2 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>Ekspor rekap melalui atasan.</p>
          <p>Waktu dalam {currentTimeZoneLabel()}</p>
        </FrameFooter>
      </Frame>
    </SpklListControlsProvider>
  );
}

/** Streamed row data uses the latest search/tab state from the shell. */
export function HistoryRows({
  items,
  error = false,
}: {
  items?: SpklListItem[];
  error?: boolean;
}) {
  const { filter, search, resetFilters } = useSpklListControls();
  const loading = items === undefined && !error;
  const sorted = useMemo(
    () => [...(items ?? [])].sort(
      (a, b) => new Date(b.spkl.startAt).getTime() - new Date(a.spkl.startAt).getTime(),
    ),
    [items],
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

  return (
    <>
      {error ? (
        <FramePanel><DataLoadError message="Riwayat lembur belum dapat dimuat." /></FramePanel>
      ) : loading ? (
        <HistoryRowsSkeleton />
      ) : grouped.length > 0 ? (
        <FramePanel className="flex flex-col gap-6">
          {grouped.map(([month, monthItems]) => (
            <section key={month} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 px-4">
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{month}</h2>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">{monthItems.length} SPKL</span>
              </div>
              <div className="divide-y divide-border/70">
                {monthItems.map((item) => <SpklListRow key={item.spkl.id} item={item} context="worker" />)}
              </div>
            </section>
          ))}
          {items?.some((item) => item.status === "berlangsung") && (
            <p className="text-center text-xs font-medium text-muted-foreground">Sesi aktif: buka SPKL untuk absen pulang.</p>
          )}
        </FramePanel>
      ) : (
        <FramePanel>
          <EmptyState
            icon={History}
            title={search ? "Tidak ada SPKL yang cocok" : "Belum ada riwayat pada filter ini"}
            description={search
              ? "Coba kata kunci lain atau hapus pencarian."
              : "Penugasan lembur dari atasan akan muncul di sini setelah dibuat."}
            action={search || filter !== "semua" ? (
              <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                <TimerReset aria-hidden="true" />Tampilkan semua riwayat
              </Button>
            ) : (
              <Button nativeButton={false} render={<Link href="/" />} size="sm">
                <TimerReset aria-hidden="true" />Kembali ke beranda
              </Button>
            )}
          />
        </FramePanel>
      )}
    </>
  );
}
