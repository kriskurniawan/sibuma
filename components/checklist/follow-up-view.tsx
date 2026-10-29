import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ListChecks,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { MobileSummary } from "@/components/mobile-summary";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ChecklistFollowUpFilters } from "@/components/checklist/follow-up-filters";
import { ChecklistFollowUpGrid } from "@/components/checklist/follow-up-grid";
import type { PageRequest } from "@/lib/pagination";
import type {
  ChecklistFollowUpRow,
  ChecklistFollowUpTotals,
} from "@/lib/checklist-types";

export function ChecklistFollowUpView({
  items,
  total,
  pagination,
  totals,
  filters,
  canEdit,
}: {
  items: ChecklistFollowUpRow[];
  total: number;
  pagination: PageRequest;
  totals: ChecklistFollowUpTotals;
  filters: { status: string; search: string; mine: boolean };
  canEdit: boolean;
}) {
  const filtered =
    filters.status !== "aktif" || Boolean(filters.search) || filters.mine;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="hidden items-center justify-between gap-2 md:flex">
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={<Link href="/checklist" />}
        >
          <ArrowLeft aria-hidden="true" />
          Checklist
        </Button>
      </div>

      <div className="hidden md:block">
        <PageHeader
          eyebrow="Operasional"
          title="Tindak lanjut"
          description="Pantau temuan dan progres penanganan PIC."
        />
      </div>

      <h1 className="sr-only md:hidden">Tindak lanjut</h1>

      <MobileSummary
        className="md:hidden"
        items={[
          {
            label: "Belum selesai",
            value: totals.open,
            icon: ListChecks,
            tone: totals.open > 0 ? "warning" : "neutral",
          },
          {
            label: "Diproses",
            value: totals.inProgress,
            icon: LoaderCircle,
            tone: "primary",
          },
          {
            label: "Terlambat",
            value: totals.overdue,
            icon: Clock3,
            tone: totals.overdue > 0 ? "destructive" : "neutral",
          },
          {
            label: "Selesai bulan ini",
            value: totals.doneThisMonth,
            icon: CheckCircle2,
            tone: "success",
          },
        ]}
      />

      <div className="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-4">
        <StatCard
          label="Belum selesai"
          value={totals.open}
          suffix="temuan"
          icon={ListChecks}
          tone={totals.open > 0 ? "warning" : "neutral"}
          helper="Terbuka, diproses, atau tertunda"
        />
        <StatCard
          label="Sedang diproses"
          value={totals.inProgress}
          suffix="temuan"
          icon={LoaderCircle}
          tone="primary"
          helper="Sudah mulai ditangani PIC"
        />
        <StatCard
          label="Terlambat"
          value={totals.overdue}
          suffix="temuan"
          icon={Clock3}
          tone={totals.overdue > 0 ? "destructive" : "neutral"}
          helper="Melewati deadline tindak lanjut"
        />
        <StatCard
          label="Selesai bulan ini"
          value={totals.doneThisMonth}
          suffix="temuan"
          icon={CheckCircle2}
          tone="success"
          helper="Dihitung dari waktu penyelesaian"
        />
      </div>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Daftar tindak lanjut</FrameTitle>
            <FrameDescription className="text-xs">
              {total} temuan sesuai filter.
            </FrameDescription>
          </div>
        </FrameHeader>

        <FramePanel>
          <ChecklistFollowUpFilters filters={filters} />
        </FramePanel>

        <FramePanel className="p-0">
          {items.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title={
                filtered
                  ? "Tidak ada tindak lanjut sesuai filter"
                  : "Tidak ada tindak lanjut"
              }
              description={
                filtered
                  ? "Ubah atau reset filter untuk melihat temuan lain."
                  : canEdit
                    ? "Tambahkan temuan dari item checklist yang bermasalah."
                    : "Belum ada temuan untuk tim ini."
              }
              action={
                filtered ? (
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/checklist/tindak-lanjut" />}
                  >
                    <RotateCcw aria-hidden="true" />
                    Reset filter
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href="/checklist" />}
                  >
                    <ListChecks aria-hidden="true" />
                    Buka checklist
                  </Button>
                )
              }
            />
          ) : (
            <ChecklistFollowUpGrid
              items={items}
              total={total}
              pagination={pagination}
              canEdit={canEdit}
            />
          )}
        </FramePanel>
      </Frame>
    </div>
  );
}
