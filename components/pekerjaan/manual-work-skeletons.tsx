import {
  ManualWorkDynamicFilters,
  ManualWorkFilters,
} from "@/components/pekerjaan/manual-work-filters";
import {
  ManualWorkListFrame,
  ManualWorkPageShell,
  ManualWorkSummary,
} from "@/components/pekerjaan/manual-work-list";
import { ListPaginationSkeleton } from "@/components/list-pagination";
import { FrameFooter, FramePanel } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

function WorkRowSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-3 w-32 max-w-full" />
        </div>
        <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-3 w-28 max-w-full" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="size-5 shrink-0 rounded-full" />
        <Skeleton className="h-3 w-24 max-w-full" />
      </div>
    </div>
  );
}

export function ManualWorkSummarySkeleton() {
  return (
    <div aria-busy="true" className="contents">
      <span className="sr-only" role="status">Memuat ringkasan pekerjaan…</span>
      <ManualWorkSummary />
    </div>
  );
}

export function ManualWorkFiltersSkeleton() {
  return <ManualWorkDynamicFilters loading />;
}

export function ManualWorkCountSkeleton() {
  return <Skeleton className="h-4 w-44" />;
}

export function ManualWorkRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <FramePanel aria-busy="true" className="divide-y divide-border/70 p-0">
      <span className="sr-only" role="status">Memuat daftar pekerjaan…</span>
      {Array.from({ length: rows }, (_, index) => <WorkRowSkeleton key={index} />)}
    </FramePanel>
  );
}

export function ManualWorkFooterSkeleton() {
  return (
    <FrameFooter aria-busy="true">
      <span className="sr-only" role="status">Memuat navigasi halaman pekerjaan…</span>
      <ListPaginationSkeleton />
    </FrameFooter>
  );
}

export function ManualWorkListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ManualWorkListFrame
      description={<ManualWorkCountSkeleton />}
      controls={<ManualWorkFilters dynamicOptions={<ManualWorkFiltersSkeleton />} />}
      footer={<ManualWorkFooterSkeleton />}
    >
      <ManualWorkRowsSkeleton rows={rows} />
    </ManualWorkListFrame>
  );
}

export function ManualWorkPageSkeleton() {
  return (
    <ManualWorkPageShell summary={<ManualWorkSummarySkeleton />}>
      <ManualWorkListSkeleton />
    </ManualWorkPageShell>
  );
}
