import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function ChecklistLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat checklist…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
      <Frame>
        <FrameHeader>
          <Skeleton className="h-4 w-36" />
        </FrameHeader>
        <FramePanel>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </FramePanel>
        <FramePanel>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
