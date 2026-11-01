import {
  Frame,
  FrameFooter,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";
import { MobileSummarySkeleton } from "@/components/mobile-summary-skeleton";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-28 max-w-full" />
      </CardContent>
    </Card>
  );
}

function SpklCardSkeleton() {
  return (
    <Frame spacing="default">
      <FramePanel className="flex min-w-0 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </div>
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-3 w-24 max-w-full" />
          <Skeleton className="h-3 w-32 max-w-full" />
          <Skeleton className="h-3 w-16" />
        </div>

        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-24 max-w-full" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="size-4" />
          </div>
        </div>
      </FramePanel>
    </Frame>
  );
}

function MonthSkeleton() {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SpklCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

export default function RiwayatLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Memuat riwayat lembur…</span>

      <div className="hidden min-w-0 flex-col gap-2 md:flex">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <MobileSummarySkeleton className="md:hidden" columns={3} items={3} />

      <div className="hidden grid-cols-1 gap-3 md:grid md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>

      <Frame>
        <FrameHeader className="gap-3">
          <Skeleton className="h-4 w-32" />

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="no-scrollbar -mx-1 min-w-0 overflow-x-auto px-1">
              <div className="flex w-max items-center gap-2">
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-8 w-full rounded-md lg:w-64" />
          </div>
        </FrameHeader>

        <FramePanel className="flex flex-col gap-6">
          <MonthSkeleton />
          <MonthSkeleton />
        </FramePanel>

        <FrameFooter className="flex flex-wrap items-start gap-2 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-28" />
        </FrameFooter>
      </Frame>
    </div>
  );
}
