"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ClipboardList, Clock3, ListChecks, RefreshCw, Settings2 } from "lucide-react";
import { ChecklistGrid } from "@/components/checklist/checklist-grid";
import { ChecklistPrimaryFilters } from "@/components/checklist/checklist-primary-filters";
import { ChecklistPrimaryGridSkeleton } from "@/components/checklist/checklist-primary-grid-skeleton";
import { QrScanButton } from "@/components/checklist/qr-scanner";
import { MobileSummary } from "@/components/mobile-summary";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { useSessionUser } from "@/components/session-user-provider";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isReadOnly } from "@/lib/access";
import type { PageRequest } from "@/lib/pagination";
import type { ChecklistInspectionRow, ChecklistTotals } from "@/lib/checklist-types";
import type { SessionUser } from "@/lib/types";

export interface ChecklistFilters {
  status: string;
  locationId: string;
  search: string;
  includeSubLocations: boolean;
}

export function ChecklistSummary({ totals, failed = false }: { totals?: ChecklistTotals; failed?: boolean }) {
  const value = (key: keyof ChecklistTotals) => totals ? totals[key] : failed ? "—" : <Skeleton className="inline-block h-7 w-12 align-middle" />;
  return (
    <>
      <MobileSummary className="md:hidden" items={[
        { label: "Perlu dikerjakan", value: value("todo"), icon: ClipboardList, tone: "primary", href: "/checklist?status=aktif", ariaLabel: "Buka checklist aktif" },
        { label: "Terlambat", value: value("overdue"), icon: Clock3, tone: totals && totals.overdue > 0 ? "destructive" : "neutral", href: "/checklist?status=terlambat", ariaLabel: "Buka checklist terlambat" },
        { label: "Selesai bulan ini", value: value("completedThisMonth"), icon: CheckCircle2, tone: "success" },
        { label: "Tindak lanjut", value: value("openFollowUps"), icon: ListChecks, tone: totals && totals.openFollowUps > 0 ? "warning" : "neutral", href: "/checklist/tindak-lanjut", ariaLabel: "Buka tindak lanjut" },
      ]} />
      <div className="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-4">
        <StatCard label="Perlu dikerjakan" value={value("todo")} suffix="checklist" icon={ClipboardList} tone="primary" helper="Belum diisi atau berlangsung, belum terlambat" />
        <StatCard label="Terlambat" value={value("overdue")} suffix="checklist" icon={Clock3} tone={totals && totals.overdue > 0 ? "destructive" : "neutral"} helper="Lewat tanggal jadwal, masih bisa diisi sampai deadline" />
        <StatCard label="Selesai bulan ini" value={value("completedThisMonth")} suffix="checklist" icon={CheckCircle2} tone="success" helper="Dihitung dari waktu penyelesaian" />
        <StatCard label="Tindak lanjut terbuka" value={value("openFollowUps")} suffix="temuan" icon={ListChecks} tone={totals && totals.openFollowUps > 0 ? "warning" : "neutral"} helper="Terbuka, diproses, atau tertunda" />
      </div>
    </>
  );
}

export function ChecklistCountSkeleton() {
  return <Skeleton className="inline-block h-3 w-8 align-middle" />;
}

/** Shared by the page and route loading: only the supplied data slots suspend. */
export function ChecklistView({ user: snapshot, summary, count, followUpCount, filtersRegion, children }: {
  user?: SessionUser;
  summary?: ReactNode;
  count?: ReactNode;
  followUpCount?: ReactNode;
  filtersRegion?: ReactNode;
  children?: ReactNode;
}) {
  const sessionUser = useSessionUser();
  const user = snapshot ?? sessionUser;
  if (user.role === "super_admin") return null;
  const canManage = user.role === "atasan" && !isReadOnly(user);
  const resultCount = count ?? <ChecklistCountSkeleton />;

  return (
    <div className="flex flex-col gap-4 md:gap-6 lg:gap-8">
      <div className="hidden md:block">
        <PageHeader eyebrow="Operasional" title="Checklist" description="Pemeriksaan rutin dan progres pekerjaan tim." action={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" nativeButton={false} render={<Link href="/checklist/tindak-lanjut" />}>
              <ListChecks />Tindak lanjut{followUpCount ?? <ChecklistCountSkeleton />}
            </Button>
            <QrScanButton className="hidden md:inline-flex" />
            {canManage && <>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/checklist/template" />}><Settings2 />Template</Button>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/checklist/jadwal" />}><CalendarClock />Jadwal</Button>
            </>}
          </div>
        } />
      </div>
      <h1 className="sr-only md:hidden">Checklist</h1>
      {summary ?? <ChecklistSummary />}
      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-end justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle className="max-md:sr-only">Daftar checklist</FrameTitle>
            <FrameDescription className="hidden text-xs md:block">{resultCount} checklist sesuai filter.</FrameDescription>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <span className="text-xs text-muted-foreground tabular-nums">{resultCount} hasil</span>
            {user.role === "atasan" && <QrScanButton />}
          </div>
        </FrameHeader>
        <FramePanel className="p-0">
          <ChecklistPrimaryFilters locations={filtersRegion} />
          {children ?? <ChecklistListSkeleton />}
        </FramePanel>
      </Frame>
    </div>
  );
}

export function ChecklistListSkeleton() {
  return (
    <div aria-busy="true" role="status" aria-label="Memuat daftar checklist">
      <ChecklistPrimaryGridSkeleton />
      <div className="divide-y divide-border/70 md:hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex min-w-0 flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1"><Skeleton className="h-4 w-48 max-w-full" /><Skeleton className="h-3 w-36 max-w-full" /></div>
              <div className="flex shrink-0 items-center gap-1"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-16" /></div>
            </div>
            <div className="flex flex-wrap items-center gap-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" /></div>
            <div className="flex min-w-0 items-center gap-3"><Skeleton className="h-3 w-8 shrink-0" /><Skeleton className="h-1.5 min-w-0 flex-1" /><Skeleton className="size-6 shrink-0 rounded-full" /><Skeleton className="h-3 w-12 shrink-0" /><Skeleton className="size-4 shrink-0" /></div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-2">
        <Skeleton className="h-8 w-44 max-w-full" /><Skeleton className="h-8 w-40 max-w-full" />
      </div>
    </div>
  );
}

export function ChecklistRows({ items, total, pagination, filters, canManage, readOnly }: {
  items: ChecklistInspectionRow[];
  total: number;
  pagination: PageRequest;
  filters: ChecklistFilters;
  canManage: boolean;
  readOnly: boolean;
}) {
  const filtered = filters.status !== "aktif" || Boolean(filters.locationId || filters.search) || !filters.includeSubLocations;
  if (items.length > 0) return <ChecklistGrid items={items} total={total} pagination={pagination} />;
  return <EmptyState icon={ClipboardList}
    title={filtered ? "Tidak ada checklist sesuai filter" : "Belum ada checklist"}
    description={filtered ? "Ubah atau reset filter untuk melihat checklist lain." : canManage ? "Atur jadwal untuk mulai pemeriksaan rutin." : readOnly ? "Belum ada pemeriksaan terjadwal untuk tim ini." : "Belum ada penugasan. Hubungi atasan jika diperlukan."}
    action={filtered ? (
      <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/checklist" />}><RefreshCw />Reset filter</Button>
    ) : canManage ? (
      <Button size="sm" nativeButton={false} render={<Link href="/checklist/jadwal" />}><CalendarClock />Atur jadwal checklist</Button>
    ) : (
      <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/checklist" />}><RefreshCw />Muat ulang</Button>
    )}
  />;
}
