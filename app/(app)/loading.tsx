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

export default function AppLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat halaman…</span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-10 w-36 shrink-0 rounded-md" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatSkeleton key={index} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.55fr]">
        <section className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64 max-w-full" />
          <Frame spacing="sm">
            <FrameHeader>
              <Skeleton className="h-4 w-48" />
              <Skeleton className="mt-2 h-3 w-56" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
                </div>
              ))}
            </FramePanel>
          </Frame>
        </section>

        <aside className="flex flex-col gap-4">
          <Frame spacing="sm">
            <FrameHeader>
              <Skeleton className="h-4 w-28" />
            </FrameHeader>
            <FramePanel>
              <Skeleton className="h-32 w-full rounded-md" />
            </FramePanel>
          </Frame>
          <Frame spacing="sm">
            <FrameHeader>
              <Skeleton className="h-4 w-24" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-6 w-full" />
              ))}
            </FramePanel>
          </Frame>
        </aside>
      </div>
    </div>
  );
}
