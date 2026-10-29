import {
  Frame,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";
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

export default function PekerjaanLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-5 pb-8"
    >
      <span className="sr-only">Memuat data pekerjaan harian…</span>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="hidden h-4 w-full max-w-xl sm:block" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      <MobileSummarySkeleton className="md:hidden" />

      <div className="hidden grid-cols-2 gap-3 md:grid xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="hidden h-3 w-44 sm:block" />
          </div>
          <Skeleton className="h-3 w-16" />
        </FrameHeader>

        <FramePanel className="flex flex-col gap-2 md:flex-row md:items-center">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md md:w-44" />
        </FramePanel>

        <FramePanel className="divide-y divide-border/70 p-0">
          {Array.from({ length: 5 }, (_, index) => (
            <WorkRowSkeleton key={index} />
          ))}
        </FramePanel>
      </Frame>
    </div>
  );
}
