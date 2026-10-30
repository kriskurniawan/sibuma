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
    <PublicShell>
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
          <FramePanel className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-36 max-w-full" />
            <Skeleton className="h-7 w-24 shrink-0" />
          </FramePanel>
        </Frame>
        <Frame spacing="default">
          <FrameHeader><Skeleton className="h-4 w-32" /></FrameHeader>
          <FramePanel className="flex flex-col gap-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full max-w-72" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </FramePanel>
        </Frame>
      </div>
    </PublicShell>
  );
}
