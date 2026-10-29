import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileSummarySkeleton } from "@/components/mobile-summary-skeleton";
import {
  Frame,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";

function StatSkeleton() {
  return (
    <Card size="sm">
      <CardHeader>
        <Skeleton className="h-3 w-24" />
        <CardAction>
          <Skeleton className="size-8 rounded-md" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}

function FilterFieldSkeleton({ labelWidth }: { labelWidth: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className={labelWidth} />
      <Skeleton className="h-8 w-full rounded-md" />
    </div>
  );
}

function ChecklistMobileRowSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-3 w-36 max-w-full" />
        </div>
        <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <Skeleton className="h-3 w-8 shrink-0" />
        <Skeleton className="h-1.5 min-w-0 flex-1" />
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <Skeleton className="h-3 w-12 shrink-0" />
        <Skeleton className="size-4 shrink-0" />
      </div>
    </div>
  );
}

function ChecklistTableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-3.5 w-40 max-w-full" />
        <Skeleton className="h-3 w-28 max-w-full" />
      </div>
      <div className="hidden min-w-0 flex-1 flex-col gap-1 lg:flex">
        <Skeleton className="h-3.5 w-32 max-w-full" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="hidden h-3 w-20 shrink-0 lg:block" />
      <div className="hidden w-28 shrink-0 flex-col gap-1 xl:flex">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-1.5 w-full" />
      </div>
      <Skeleton className="hidden h-5 w-16 shrink-0 rounded-full xl:block" />
      <Skeleton className="size-7 shrink-0 rounded-md" />
    </div>
  );
}

export default function ChecklistLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat checklist…</span>

      <div className="hidden flex-col gap-4 md:flex xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

      <MobileSummarySkeleton className="md:hidden" />

      <div className="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-4">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-end justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="hidden h-3 w-40 md:block" />
          </div>
          <Skeleton className="h-3 w-12 md:hidden" />
        </FrameHeader>

        <FramePanel className="hidden md:block">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
            <div className="xl:col-span-2">
              <FilterFieldSkeleton labelWidth="h-3 w-12" />
            </div>
            <div className="xl:col-span-3">
              <FilterFieldSkeleton labelWidth="h-3 w-14" />
            </div>
            <div className="xl:col-span-2">
              <FilterFieldSkeleton labelWidth="h-3 w-24" />
            </div>
            <div className="sm:col-span-2 xl:col-span-3">
              <FilterFieldSkeleton labelWidth="h-3 w-10" />
            </div>
            <div className="flex items-end gap-2 xl:col-span-2">
              <Skeleton className="h-8 flex-1 rounded-md" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          </div>
        </FramePanel>

        <FramePanel className="md:hidden">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 min-w-0 flex-1 rounded-md" />
              <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
            </div>
            <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
              <div className="flex w-max items-center gap-2">
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </div>
          </div>
        </FramePanel>

        <FramePanel className="p-0">
          <div className="hidden divide-y divide-border/70 md:block">
            {Array.from({ length: 5 }, (_, index) => (
              <ChecklistTableRowSkeleton key={index} />
            ))}
          </div>
          <div className="divide-y divide-border/70 md:hidden">
            {Array.from({ length: 4 }, (_, index) => (
              <ChecklistMobileRowSkeleton key={index} />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-2">
            <Skeleton className="h-8 w-44 max-w-full" />
            <Skeleton className="h-8 w-40 max-w-full" />
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
