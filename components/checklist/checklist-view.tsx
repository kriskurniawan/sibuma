import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
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
import { MobileSummary } from "@/components/mobile-summary";
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
  const filtered =
    filters.status !== "aktif" ||
    Boolean(filters.locationId || filters.search);

  return (
    <div className="flex flex-col gap-4 md:gap-6 lg:gap-8">
      <div className="hidden md:block">
        <PageHeader
          eyebrow="Operasional"
          title="Checklist"
          description="Pemeriksaan rutin dan progres pekerjaan tim."
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

      <MobileSummary
        className="md:hidden"
        items={[
          {
            label: "Perlu dikerjakan",
            value: totals.todo,
            icon: ClipboardList,
            tone: "primary",
            href: "/checklist?status=aktif",
            ariaLabel: `Buka ${totals.todo} checklist aktif`,
          },
          {
            label: "Terlambat",
            value: totals.overdue,
            icon: Clock3,
            tone: totals.overdue > 0 ? "destructive" : "neutral",
            href: "/checklist?status=terlambat",
            ariaLabel: `Buka ${totals.overdue} checklist terlambat`,
          },
          {
            label: "Selesai bulan ini",
            value: totals.completedThisMonth,
            icon: CheckCircle2,
            tone: "success",
          },
          {
            label: "Tindak lanjut",
            value: totals.openFollowUps,
            icon: ListChecks,
            tone: totals.openFollowUps > 0 ? "warning" : "neutral",
            href: "/checklist/tindak-lanjut",
            ariaLabel: `Buka tindak lanjut, ${totals.openFollowUps} belum selesai`,
          },
        ]}
      />

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
          tone={totals.overdue > 0 ? "destructive" : "neutral"}
          helper="Melewati deadline, tetap dijadwal yang sama"
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
          tone={totals.openFollowUps > 0 ? "warning" : "neutral"}
          helper="Terbuka, diproses, atau tertunda"
        />
      </div>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-end justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Daftar checklist</FrameTitle>
            <FrameDescription className="hidden text-xs md:block">
              {total} checklist sesuai filter.
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
              title={
                filtered
                  ? "Tidak ada checklist sesuai filter"
                  : "Belum ada checklist"
              }
              description={
                filtered
                  ? "Ubah atau reset filter untuk melihat checklist lain."
                  : canManage
                    ? "Atur jadwal untuk mulai pemeriksaan rutin."
                    : readOnly
                      ? "Belum ada pemeriksaan terjadwal untuk tim ini."
                      : "Belum ada penugasan. Hubungi atasan jika diperlukan."
              }
              action={
                filtered ? (
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/checklist" />}
                  >
                    <RefreshCw />
                    Reset filter
                  </Button>
                ) : canManage ? (
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
