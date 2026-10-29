import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

function DetailRowSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-4 w-32 max-w-full" />
    </div>
  );
}

export default function PekerjaanDetailLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-5 pb-8"
    >
      <span className="sr-only">Memuat detail pekerjaan harian…</span>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-64 max-w-full" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-36 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Frame>
            <FrameHeader className="gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12 max-w-full" />
                <Skeleton className="h-3 w-4/5 max-w-full" />
              </div>
              <div className="flex flex-col divide-y divide-border">
                {Array.from({ length: 4 }, (_, index) => (
                  <DetailRowSkeleton key={index} />
                ))}
              </div>
            </FramePanel>
          </Frame>

          <Frame>
            <FrameHeader className="flex flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-52 max-w-full" />
              </div>
              <Skeleton className="h-3 w-10" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="size-16 rounded-md" />
                ))}
                <Skeleton className="h-8 w-28 rounded-md" />
              </div>
              <Skeleton className="h-3 w-20" />
            </FramePanel>
          </Frame>

          <Frame>
            <FrameHeader className="gap-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-52 max-w-full" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex gap-3">
                  <Skeleton className="mt-1 size-2 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-40 max-w-full" />
                  </div>
                </div>
              ))}
            </FramePanel>
          </Frame>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <Frame spacing="sm">
            <FrameHeader className="gap-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-44 max-w-full" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </FramePanel>
          </Frame>

          <Frame spacing="sm">
            <FrameHeader className="flex flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="size-4" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-2.5">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1">
                    <Skeleton className="h-3 w-32 max-w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </FramePanel>
          </Frame>
        </aside>
      </div>
    </div>
  );
}
