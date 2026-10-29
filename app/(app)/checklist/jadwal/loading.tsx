import { Skeleton } from "@/components/ui/skeleton";
import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";

function ScheduleRowSkeleton() {
  return (
    <li className="flex flex-col gap-2.5 px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-48 max-w-full" />
        </div>
        <Skeleton className="h-8 w-16 shrink-0 rounded-md" />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-40 max-w-full" />
        <Skeleton className="h-3 w-24" />
      </div>

      <div className="hidden items-center md:flex">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="-ml-2 size-6 rounded-full" />
        <Skeleton className="-ml-2 size-6 rounded-full" />
      </div>
    </li>
  );
}

export default function ChecklistScheduleLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat jadwal checklist…</span>

      <Skeleton className="hidden h-8 w-24 rounded-md md:block" />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-7 w-48 max-w-full" />
          <Skeleton className="hidden h-4 w-full max-w-xl md:block" />
        </div>
        <Skeleton className="h-8 w-28 shrink-0 rounded-md" />
      </div>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="hidden h-3 w-52 md:block" />
          </div>
          <Skeleton className="h-5 w-8 rounded-md" />
        </FrameHeader>
        <FramePanel className="p-0">
          <ul className="divide-y divide-border/70">
            {Array.from({ length: 4 }, (_, index) => (
              <ScheduleRowSkeleton key={index} />
            ))}
          </ul>
        </FramePanel>
      </Frame>
    </div>
  );
}
