import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  ListChecks,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { ChecklistFilterBar } from "@/components/checklist/checklist-filters";
import { ChecklistGrid } from "@/components/checklist/checklist-grid";
import { ChecklistMobileFilters } from "@/components/checklist/checklist-mobile-filters";
import { QrScanButton } from "@/components/checklist/qr-scanner";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import {
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import type { PageRequest } from "@/lib/pagination";
import type { ChecklistLocationOption } from "@/lib/checklist-location-path";
import type {
  ChecklistInspectionRow,
  ChecklistTotals,
} from "@/lib/checklist-types";
import { cn } from "@/lib/utils";

function MobileStat({
  label,
  value,
  href,
  className,
}: {
  label: ReactNode;
  value: number;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        {href && (
          <ChevronRight className="size-3.5" aria-hidden="true" />
        )}
      </span>
      <span className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </span>
    </>
  );

  const classes = cn("flex min-w-0 flex-col gap-0.5 p-3", className);

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          classes,
          "transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}

export function ChecklistView({
  items,
  total,
  pagination,
  totals,
  filters,
  locations,
  canManage,
  readOnly = false,
}: {
  items: ChecklistInspectionRow[];
  total: number;
  pagination: PageRequest;
  totals: ChecklistTotals;
  filters: {
    status: string;
    locationId: string;
    search: string;
    includeSubLocations: boolean;
  };
  locations: ChecklistLocationOption[];
  canManage: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 md:gap-6 lg:gap-8">
      <div className="hidden md:block">
        <PageHeader
          eyebrow="Operasional"
          title="Checklist"
          description="Jadwal pemeriksaan rutin lintas operasional. Semua anggota tim yang ditugaskan dapat mengisi item yang sama tanpa saling menimpa."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/checklist/tindak-lanjut" />}
              >
                <ListChecks />
                Tindak lanjut
                {totals.openFollowUps > 0 && (
                  <span className="rounded-full bg-primary-foreground/20 px-1.5 text-xs tabular-nums">
                    {totals.openFollowUps}
                  </span>
                )}
              </Button>
              <QrScanButton className="hidden md:inline-flex" />
              {canManage && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/checklist/template" />}
                  >
                    <Settings2 />
                    Template
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/checklist/jadwal" />}
                  >
                    <CalendarClock />
                    Jadwal
                  </Button>
                </>
              )}
            </div>
          }
        />
      </div>

      <Frame className="md:hidden" spacing="sm">
        <FramePanel className="p-0">
          <div className="grid grid-cols-2">
            <MobileStat
              label="Perlu dikerjakan"
              value={totals.todo}
              className="border-r border-b border-border/70"
            />
            <MobileStat
              label="Terlambat"
              value={totals.overdue}
              className="border-b border-border/70"
            />
            <MobileStat
              label="Selesai bulan ini"
              value={totals.completedThisMonth}
              className="border-r border-border/70"
            />
            <MobileStat
              label="Tindak lanjut"
              value={totals.openFollowUps}
              href="/checklist/tindak-lanjut"
            />
          </div>
        </FramePanel>
      </Frame>

      <div className="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-4">
        <StatCard
          label="Perlu dikerjakan"
          value={totals.todo}
          suffix="checklist"
          icon={ClipboardList}
          tone="primary"
          helper="Belum dimulai atau sedang berlangsung"
        />
        <StatCard
          label="Terlambat"
          value={totals.overdue}
          suffix="checklist"
          icon={Clock3}
          tone="warning"
          helper="Melewati tenggat, tetap dijadwal yang sama"
        />
        <StatCard
          label="Selesai bulan ini"
          value={totals.completedThisMonth}
          suffix="checklist"
          icon={CheckCircle2}
          tone="success"
          helper="Dihitung dari waktu penyelesaian"
        />
        <StatCard
          label="Tindak lanjut terbuka"
          value={totals.openFollowUps}
          suffix="temuan"
          icon={ListChecks}
          tone="info"
          helper="Terbuka, diproses, atau tertunda"
        />
      </div>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-end justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Daftar checklist</FrameTitle>
            <FrameDescription className="hidden text-xs md:block">
              {total} checklist sesuai filter. Tenggat dihitung otomatis dari
              kalender, bukan dari status manual.
            </FrameDescription>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums md:hidden">
            {total} hasil
          </span>
        </FrameHeader>

        <FramePanel className="hidden md:block">
          <ChecklistFilterBar filters={filters} locations={locations} />
        </FramePanel>

        <FramePanel className="md:hidden">
          <ChecklistMobileFilters filters={filters} locations={locations} />
        </FramePanel>

        <FramePanel className="p-0">
          {items.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Belum ada checklist"
              description={
                canManage
                  ? "Buat template, tetapkan lokasi, lalu atur jadwal agar checklist muncul otomatis di sini."
                  : readOnly
                    ? "Belum ada checklist untuk tim ini. Checklist muncul otomatis setelah atasan membuat jadwal."
                    : "Belum ada checklist yang ditugaskan kepadamu. Hubungi atasan bila seharusnya ada."
              }
              action={
                canManage ? (
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href="/checklist/jadwal" />}
                  >
                    <CalendarClock />
                    Atur jadwal checklist
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/checklist" />}
                  >
                    <RefreshCw />
                    Muat ulang
                  </Button>
                )
              }
            />
          ) : (
            <ChecklistGrid items={items} total={total} pagination={pagination} />
          )}
        </FramePanel>
      </Frame>
    </div>
  );
}
