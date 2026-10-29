import { Skeleton } from "@/components/ui/skeleton";
import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";

function SetupListRowSkeleton() {
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-start gap-2.5">
        <Skeleton className="mt-0.5 size-4 shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-40 max-w-full" />
          <Skeleton className="hidden h-3 w-56 max-w-full md:block" />
        </div>
      </div>
      <Skeleton className="h-8 w-16 shrink-0 rounded-md" />
    </li>
  );
}

export default function ChecklistTemplateLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat template checklist…</span>

      <Skeleton className="hidden h-8 w-24 rounded-md md:block" />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="hidden h-4 w-full max-w-xl md:block" />
        </div>
        <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto">
          <Skeleton className="h-8 w-28 shrink-0 rounded-md" />
          <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
          <Skeleton className="h-8 w-28 shrink-0 rounded-md" />
        </div>
      </div>

      {Array.from({ length: 2 }, (_, index) => (
        <Frame key={index}>
          <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="hidden h-3 w-52 md:block" />
            </div>
            <Skeleton className="h-5 w-8 rounded-md" />
          </FrameHeader>
          <FramePanel className="p-0">
            <ul className="divide-y divide-border/70">
              {Array.from({ length: 3 }, (_, rowIndex) => (
                <SetupListRowSkeleton key={rowIndex} />
              ))}
            </ul>
          </FramePanel>
        </Frame>
      ))}
    </div>
  );
}
