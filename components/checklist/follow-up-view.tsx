import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ListChecks,
  LoaderCircle,
} from "lucide-react";
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
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
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

      <PageHeader
        eyebrow="Operasional"
        title="Tindak lanjut"
        description="Temuan dibuat manual oleh tim dan dipantau terpisah dari status checklist. PIC dapat memperbarui progres dan menutup tindak lanjut tanpa persetujuan atasan."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Belum selesai"
          value={totals.open}
          suffix="temuan"
          icon={ListChecks}
          tone="info"
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
          tone="warning"
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
              {total} tindak lanjut sesuai filter. Satu item bermasalah hanya
              memiliki satu tindak lanjut aktif.
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
              title="Tidak ada tindak lanjut"
              description={
                canEdit
                  ? "Buat tindak lanjut dari item checklist yang berstatus perlu perhatian atau tidak baik. Temuan tidak dibuat otomatis."
                  : "Belum ada temuan untuk tim ini. Tindak lanjut akan tampil di sini setelah dibuat oleh tim."
              }
              action={
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/checklist" />}
                >
                  <ListChecks aria-hidden="true" />
                  Buka checklist
                </Button>
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
