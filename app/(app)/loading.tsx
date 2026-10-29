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

function ChecklistRowSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-2 py-3">
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

function FollowUpRowSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Skeleton className="h-4 w-44 max-w-full" />
          <Skeleton className="h-3 w-32 max-w-full" />
        </div>
        <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-24 max-w-full" />
        </div>
        <Skeleton className="size-4 shrink-0" />
      </div>
    </div>
  );
}

export default function AppLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat halaman…</span>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="hidden h-4 w-full max-w-xl sm:block" />
        </div>
        <Skeleton className="hidden h-9 w-36 shrink-0 sm:block" />
      </div>

      <Frame spacing="sm" className="sm:hidden">
        <FramePanel className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-44 max-w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-9 w-full rounded-md" />
        </FramePanel>
      </Frame>

      <MobileSummarySkeleton className="sm:hidden" />

      <div className="hidden grid-cols-2 gap-3 sm:grid xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr]">
        <Frame
          spacing="sm"
          className="order-1 min-w-0 sm:order-3 xl:col-start-2 xl:row-start-2"
        >
          <FrameHeader className="flex-row items-start justify-between gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-12" />
          </FrameHeader>
          <FramePanel>
            <div className="flex items-start gap-3">
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-44 max-w-full" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="size-4 shrink-0" />
            </div>
          </FramePanel>
        </Frame>

        <section className="order-2 flex min-w-0 flex-col gap-3 sm:order-1 xl:row-span-2">
          <Frame spacing="sm">
            <FrameHeader className="flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="hidden h-3 w-48 sm:block" />
              </div>
              <Skeleton className="h-3 w-10" />
            </FrameHeader>
            <FramePanel className="flex flex-col">
              <ChecklistRowSkeleton />
              <div className="border-t border-border/70">
                <ChecklistRowSkeleton />
              </div>
              <div className="border-t border-border/70">
                <ChecklistRowSkeleton />
              </div>
            </FramePanel>
          </Frame>
        </section>

        <Frame
          spacing="sm"
          className="order-3 min-w-0 sm:order-2 xl:col-start-2 xl:row-start-1"
        >
          <FrameHeader className="flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
            <Skeleton className="h-3 w-10" />
          </FrameHeader>
          <FramePanel className="flex flex-col">
            <FollowUpRowSkeleton />
            <div className="border-t border-border/70">
              <FollowUpRowSkeleton />
            </div>
          </FramePanel>
        </Frame>
      </div>
    </div>
  );
}
