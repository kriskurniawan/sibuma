import {
  Frame,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";
import { MobileFabSkeleton } from "@/components/mobile-fab";
import { MobileSummarySkeleton } from "@/components/mobile-summary-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function StatSkeleton() {
  return (
    <Card size="sm">
      <CardHeader>
        <Skeleton className="h-3 w-24" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-28 max-w-full" />
      </CardContent>
    </Card>
  );
}

function TeamRowSkeleton() {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-4 w-44 max-w-full" />
        <Skeleton className="h-3 w-28 max-w-full" />
      </div>
      <Skeleton className="hidden h-5 w-16 shrink-0 rounded-full sm:block" />
      <Skeleton className="h-8 w-16 shrink-0 rounded-md" />
    </div>
  );
}

export default function TimLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Memuat data tim…</span>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="hidden min-w-0 flex-1 flex-col gap-2 md:flex">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="hidden h-9 w-32 shrink-0 rounded-md md:block" />
      </div>

      <MobileSummarySkeleton className="md:hidden" />

      <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-8 w-56 max-w-full rounded-md" />
        </FrameHeader>

        <FramePanel className="flex flex-col gap-2 md:flex-row md:items-center">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md md:w-44" />
        </FramePanel>

        <FramePanel className="divide-y divide-border/70 p-0">
          {Array.from({ length: 6 }, (_, index) => (
            <TeamRowSkeleton key={index} />
          ))}
        </FramePanel>
      </Frame>

      <MobileFabSkeleton />
    </div>
  );
}
