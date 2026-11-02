"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { BarChart3, ClipboardList, Plus, Search, TimerReset } from "lucide-react";
import { DataLoadError } from "@/components/data-load-error";
import { MobileFab } from "@/components/mobile-fab";
import { useSessionUser } from "@/components/session-user-provider";
import { SpklListRow, SpklListRowSkeleton } from "@/components/spkl/spkl-card";
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
  SpklListControlsProvider,
  SpklListCount,
  SpklListToolbar,
  useSpklListControls,
  type SpklListCountSlots,
} from "@/components/lembur/spkl-list-controls";
import { isReadOnly } from "@/lib/access";
import type { SpklListItem } from "@/lib/types";

/** Static identity/actions are shared by the route and its loading fallback. */
export function LemburPageShell({ children }: { children: ReactNode }) {
  const readOnly = isReadOnly(useSessionUser());

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        mobileCompact
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
              size="sm"
            >
              <BarChart3 aria-hidden="true" />
              Laporan
            </Button>
            {!readOnly && (
              <div className="max-md:hidden">
                <Button nativeButton={false} render={<Link href="/spkl/baru" />} size="sm">
                  <Plus aria-hidden="true" />
                  Buat SPKL
                </Button>
              </div>
            )}
          </div>
        }
      />
      {children}
      {!readOnly && (
        <MobileFab href="/spkl/baru">
          <Plus aria-hidden="true" />
          Buat SPKL
        </MobileFab>
      )}
    </div>
  );
}

/** The toolbar/provider stay mounted while only numbers and rows stream. */
export function LemburView({
  counts = {},
  children,
}: {
  counts?: SpklListCountSlots;
  children: ReactNode;
}) {
  return (
    <SpklListControlsProvider>
      <Frame spacing="xs">
        <FrameHeader className="gap-3">
          <div className="flex flex-col gap-1">
            <FrameTitle className="max-md:sr-only">Daftar SPKL</FrameTitle>
            <FrameDescription className="max-md:hidden text-xs">
              <span className="inline-flex flex-wrap items-center gap-1">
                {counts.semua ?? <SpklListCount />}
                <span>SPKL ·</span>
                {counts.berlangsung ?? <SpklListCount />}
                <span>berlangsung ·</span>
                {counts.terjadwal ?? <SpklListCount />}
                <span>terjadwal</span>
              </span>
            </FrameDescription>
          </div>
          <SpklListToolbar
            counts={counts}
            searchPlaceholder="Cari judul, nomor SPKL, atau pekerja…"
            searchLabel="Cari SPKL"
            searchClassName="w-full lg:w-72"
          />
        </FrameHeader>
        {children}
      </Frame>
    </SpklListControlsProvider>
  );
}

/** Streamed rows consume the persistent shell's current filters. */
export function LemburRows({
  items,
  error = false,
}: {
  items?: SpklListItem[];
  error?: boolean;
}) {
  const readOnly = isReadOnly(useSessionUser());
  const { filter, search, resetFilters } = useSpklListControls();
  const loading = items === undefined && !error;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (items ?? []).filter((item) => {
      if (filter !== "semua" && item.status !== filter) return false;
      if (!query) return true;
      const workerNames = item.workers.map((worker) => worker.name).join(" ");
      return `${item.spkl.title} ${item.spkl.number} ${item.spkl.location.address ?? ""} ${workerNames}`
        .toLowerCase()
        .includes(query);
    });
  }, [filter, items, search]);

  return error ? (
    <FramePanel><DataLoadError message="Daftar SPKL belum dapat dimuat." /></FramePanel>
  ) : loading ? (
    <FramePanel className="divide-y divide-border/70" aria-busy="true" role="status">
      <span className="sr-only">Memuat daftar SPKL…</span>
      {Array.from({ length: 6 }, (_, index) => <SpklListRowSkeleton key={index} context="supervisor" />)}
    </FramePanel>
  ) : filtered.length > 0 ? (
    <FramePanel className="divide-y divide-border/70">
      {filtered.map((item) => <SpklListRow key={item.spkl.id} item={item} context="supervisor" />)}
    </FramePanel>
  ) : (
    <FramePanel>
      <EmptyState
        icon={items?.length === 0 ? ClipboardList : Search}
        title={items?.length === 0 ? "Belum ada SPKL" : "Tidak ada SPKL yang cocok"}
        description={items?.length === 0
          ? readOnly ? "Belum ada penugasan lembur untuk tim ini." : "Buat SPKL untuk menugaskan tim."
          : "Coba kata kunci lain atau tampilkan semua status."}
        action={items?.length === 0 ? (
          readOnly ? (
            <Button nativeButton={false} render={<Link href="/laporan?tab=lembur" />} variant="outline" size="sm">
              <BarChart3 aria-hidden="true" />Lihat laporan
            </Button>
          ) : (
            <Button nativeButton={false} render={<Link href="/spkl/baru" />} size="sm">
              <Plus aria-hidden="true" />Buat SPKL
            </Button>
          )
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
            <TimerReset aria-hidden="true" />Tampilkan semua
          </Button>
        )}
      />
    </FramePanel>
  );
}
