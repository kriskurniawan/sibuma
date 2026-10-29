import { Skeleton } from "@/components/ui/skeleton";
import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";

function AnswerSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-4 pr-4 pl-4 sm:pr-5 sm:pl-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Skeleton className="h-3 w-5" />
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-3/4 max-w-full" />
        <Skeleton className="h-3 w-1/2 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-16 w-full rounded-md" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

export default function ChecklistDetailLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat detail checklist…</span>

      <Skeleton className="hidden h-8 w-24 rounded-md md:block" />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-72 max-w-full" />
          <Skeleton className="hidden h-4 w-full max-w-xl md:block" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-52 max-w-full" />
          </div>
          <Skeleton className="h-3 w-8" />
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4">
          <Skeleton className="h-2 w-full" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex flex-col gap-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24 max-w-full" />
              </div>
            ))}
            <div className="col-span-2 flex flex-col gap-1">
              <Skeleton className="h-3 w-28" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-4 w-44 max-w-full" />
            </div>
          </div>
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
          <Skeleton className="h-5 w-12 rounded-md" />
        </FrameHeader>
        <FramePanel className="p-0">
          <div className="divide-y divide-border/70">
            {Array.from({ length: 3 }, (_, index) => (
              <AnswerSkeleton key={index} />
            ))}
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
