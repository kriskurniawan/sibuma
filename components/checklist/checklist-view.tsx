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
}) {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Daftar checklist</FrameTitle>
            <FrameDescription className="text-xs">
              {total} checklist sesuai filter. Tenggat dihitung otomatis dari
              kalender, bukan dari status manual.
            </FrameDescription>
          </div>
        </FrameHeader>

        <FramePanel>
          <ChecklistFilterBar filters={filters} locations={locations} />
        </FramePanel>

        <FramePanel className="p-0">
          {items.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Belum ada checklist"
              description={
                canManage
                  ? "Buat template, tetapkan lokasi, lalu atur jadwal agar checklist muncul otomatis di sini."
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
