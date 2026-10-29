import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileSummarySkeleton } from "@/components/mobile-summary-skeleton";
import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";

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

function FollowUpMobileRowSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-3 w-36 max-w-full" />
        </div>
        <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
      </div>
      <Skeleton className="h-3 w-3/4 max-w-full" />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-24 max-w-full" />
        </div>
        <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
      </div>
    </div>
  );
}

function FollowUpTableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-3.5 w-40 max-w-full" />
        <Skeleton className="h-3 w-28 max-w-full" />
      </div>
      <Skeleton className="hidden h-3 w-24 shrink-0 lg:block" />
      <div className="hidden min-w-0 flex-col gap-1 xl:flex">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="hidden h-5 w-16 shrink-0 rounded-full lg:block" />
      <Skeleton className="hidden h-5 w-20 shrink-0 rounded-full xl:block" />
      <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
    </div>
  );
}

export default function ChecklistFollowUpLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat tindak lanjut…</span>

      <div className="hidden items-center justify-between gap-2 md:flex">
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      <div className="hidden flex-col gap-2 md:flex">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <MobileSummarySkeleton className="md:hidden" />

      <div className="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-4">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>

      <Frame>
        <FrameHeader>
          <div className="flex flex-col gap-0.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-36" />
          </div>
        </FrameHeader>

        <FramePanel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
            <div className="flex flex-col gap-2 xl:col-span-3">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-5">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
            <div className="flex flex-col gap-2 xl:col-span-2">
              <Skeleton className="h-3 w-24" />
              <div className="flex h-8 items-center gap-2">
                <Skeleton className="size-4 shrink-0 rounded-sm" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex items-end gap-2 xl:col-span-2">
              <Skeleton className="h-8 flex-1 rounded-md" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          </div>
        </FramePanel>

        <FramePanel className="p-0">
          <div className="hidden divide-y divide-border/70 md:block">
            {Array.from({ length: 5 }, (_, index) => (
              <FollowUpTableRowSkeleton key={index} />
            ))}
          </div>
          <div className="divide-y divide-border/70 md:hidden">
            {Array.from({ length: 4 }, (_, index) => (
              <FollowUpMobileRowSkeleton key={index} />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-2">
            <Skeleton className="h-3 w-44 max-w-full" />
            <Skeleton className="h-8 w-40 max-w-full" />
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
