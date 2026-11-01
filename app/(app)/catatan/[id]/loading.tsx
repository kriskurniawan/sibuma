import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

export default function CatatanDetailLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-5 pb-8"
    >
      <span className="sr-only">Memuat detail catatan…</span>

      <Skeleton className="hidden h-4 w-32 md:block" />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-64 max-w-full sm:h-8" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-7 w-8 shrink-0 rounded-md" />
      </div>

      <Frame>
        <FrameHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-48 max-w-full" />
          </div>
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
        </FrameHeader>
        <FramePanel className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12 max-w-full" />
          <Skeleton className="h-4 w-4/5 max-w-full" />
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-32 max-w-full" />
          </div>
        </FrameHeader>
        <FramePanel>
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="w-36 shrink-0 overflow-hidden rounded-md border border-border sm:w-44"
              >
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <Skeleton className="h-4 w-20 max-w-full" />
                  <Skeleton className="h-4 w-8 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
