import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";
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
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-3 w-28 max-w-full" />
      </CardContent>
    </Card>
  );
}

function QrRowSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Skeleton className="mt-0.5 size-4 shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-44 max-w-full" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export default function ChecklistQrLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-w-0 flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat QR area…</span>

      <Skeleton className="hidden h-4 w-40 md:block" />

      <div className="hidden flex-col gap-4 md:flex xl:flex-row xl:items-end xl:justify-between">
        <div className="hidden min-w-0 flex-1 flex-col gap-2 md:flex">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="hidden h-8 w-24 shrink-0 rounded-md md:block" />
      </div>

      <Skeleton className="h-14 w-full rounded-lg" />

      <MobileSummarySkeleton className="md:hidden" columns={3} items={3} />

      <div className="hidden gap-3 md:grid md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>

      <Frame spacing="default" className="min-w-0">
        <div className="hidden md:block">
          <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-52" />
            </div>
            <Skeleton className="h-5 w-8 rounded-md" />
          </FrameHeader>
        </div>

        <FramePanel className="divide-y divide-border/70 p-0">
          {Array.from({ length: 4 }, (_, index) => (
            <QrRowSkeleton key={index} />
          ))}
        </FramePanel>
      </Frame>

      <MobileFabSkeleton />
    </div>
  );
}
