import {
  Frame,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

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
          <Skeleton className="h-3 w-36 max-w-full" />
          <Skeleton className="h-3 w-20" />
        </div>

        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-24 max-w-full" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="size-4" />
          </div>
        </div>
      </FramePanel>
    </Frame>
  );
}

export default function LemburLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Memuat data lembur…</span>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="hidden h-4 w-full max-w-xl sm:block" />
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      <Frame>
        <FrameHeader className="gap-3">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-52 max-w-full" />
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="no-scrollbar -mx-1 min-w-0 overflow-x-auto px-1">
              <div className="flex w-max items-center gap-2">
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-8 w-full rounded-md lg:w-72" />
          </div>
        </FrameHeader>

        <FramePanel className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <SpklCardSkeleton key={index} />
          ))}
        </FramePanel>
      </Frame>
    </div>
  );
}
