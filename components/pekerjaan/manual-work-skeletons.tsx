import { MobileFabSkeleton } from "@/components/mobile-fab";
import { MobileSummarySkeleton } from "@/components/mobile-summary-skeleton";
import {
  Frame,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function StatSkeleton() {
  return (
    <Card size="sm">
      <CardHeader>
        <Skeleton className="h-3 w-24" />
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-28 max-w-full" />
      </CardContent>
    </Card>
  );
}

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
    <>
      <MobileSummarySkeleton className="md:hidden" />

      <div className="hidden grid-cols-2 gap-3 md:grid xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>
    </>
  );
}

export function ManualWorkFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
      <div className="min-w-0 xl:flex-1">
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Skeleton className="h-9 w-full sm:w-36" />
        <Skeleton className="h-9 w-full sm:w-44" />
        <Skeleton className="col-span-2 h-9 w-full sm:col-span-1 sm:w-52" />
      </div>
    </div>
  );
}

export function ManualWorkRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <FramePanel className="divide-y divide-border/70 p-0">
      {Array.from({ length: rows }, (_, index) => (
        <WorkRowSkeleton key={index} />
      ))}
    </FramePanel>
  );
}

export function ManualWorkListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Frame>
      <FrameHeader className="flex flex-row flex-wrap items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <FrameTitle className="max-md:sr-only">Daftar pekerjaan</FrameTitle>
          <Skeleton className="hidden h-3 w-44 md:block" />
        </div>
        <Skeleton className="h-3 w-16 md:hidden" />
      </FrameHeader>

      <FramePanel>
        <ManualWorkFiltersSkeleton />
      </FramePanel>

      <ManualWorkRowsSkeleton rows={rows} />

      <FrameFooter>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-16" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </div>
        </div>
      </FrameFooter>
    </Frame>
  );
}

export function ManualWorkPageSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-5 pb-8"
    >
      <span className="sr-only">Memuat data pekerjaan harian…</span>

      <div className="hidden flex-col gap-4 md:flex xl:flex-row xl:items-end xl:justify-between">
        <div className="hidden min-w-0 flex-1 flex-col gap-2 md:flex">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="hidden h-4 w-full max-w-xl sm:block" />
        </div>
        <Skeleton className="hidden h-9 w-36 rounded-md md:block" />
      </div>

      <ManualWorkSummarySkeleton />
      <ManualWorkListSkeleton />

      <MobileFabSkeleton />
    </div>
  );
}
