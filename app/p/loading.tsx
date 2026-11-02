import { PublicShell } from "@/components/checklist/public-shell";
import { MobileSummarySkeleton } from "@/components/mobile-summary-skeleton";
import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function PublicStatSkeleton() {
  return (
    <Card size="sm">
      <CardHeader>
        <Skeleton className="h-3 w-24" />
        <CardAction><Skeleton className="size-8" /></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}

export default function PublicLoading() {
  return (
    <PublicShell
      headerAction={
        <>
          <Skeleton className="hidden h-6 w-20 sm:block" />
          <Skeleton className="h-8 w-28" />
        </>
      }
    >
      <div aria-busy="true" aria-live="polite" className="flex min-w-0 flex-col gap-4 md:gap-6">
        <span className="sr-only">Memuat informasi checklist…</span>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48 max-w-full" />
          <Skeleton className="h-4 w-36 max-w-full" />
        </div>
        <MobileSummarySkeleton className="md:hidden" />
        <div className="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <PublicStatSkeleton key={index} />)}
        </div>
        <Frame spacing="default">
          <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="h-3 w-44 max-w-full" />
            </div>
            <Skeleton className="h-6 w-24" />
          </FrameHeader>
          <FramePanel className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 border-b border-border pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Skeleton className="h-3 w-44 max-w-full" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex flex-wrap gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full max-w-72" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </FramePanel>
        </Frame>
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-5">
          <Frame spacing="default" className="lg:col-span-2">
            <FrameHeader className="flex-row items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Skeleton className="h-4 w-32 max-w-full" />
                <Skeleton className="h-3 w-36 max-w-full" />
              </div>
              <Skeleton className="size-8 shrink-0 md:hidden" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-3 w-28 max-w-full" />
                  <Skeleton className="h-3 w-36 max-w-full" />
                </div>
              ))}
            </FramePanel>
          </Frame>
          <Frame spacing="default" className="lg:col-span-3">
            <FrameHeader className="flex-row items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Skeleton className="h-4 w-36 max-w-full" />
                <Skeleton className="h-3 w-44 max-w-full" />
              </div>
              <Skeleton className="size-8 shrink-0 md:hidden" />
            </FrameHeader>
            <FramePanel>
              <div className="flex min-w-0 gap-6 overflow-hidden">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="flex min-w-40 flex-1 flex-col gap-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="mt-6 h-4 w-28 max-w-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </FramePanel>
          </Frame>
        </div>
      </div>
    </PublicShell>
  );
}
