import {
  Frame,
  FrameFooter,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";
import { MobileFabSkeleton } from "@/components/mobile-fab";
import { Skeleton } from "@/components/ui/skeleton";

function NoteRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <Skeleton className="mt-0.5 size-6 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-2/3 max-w-sm sm:hidden" />
        <Skeleton className="h-5 w-3/4 max-w-xl" />
      </div>
      <div className="mt-0.5 flex shrink-0 items-center gap-2">
        <Skeleton className="h-4 w-5" />
        <Skeleton className="size-4" />
      </div>
    </div>
  );
}

export default function CatatanLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-5 pb-8"
    >
      <span className="sr-only">Memuat catatan…</span>

      <div className="hidden flex-col gap-4 md:flex xl:flex-row xl:items-end xl:justify-between">
        <div className="hidden min-w-0 flex-1 flex-col gap-2 md:flex">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>
        <Skeleton className="hidden h-7 w-36 rounded-md md:block" />
      </div>

      <Frame>
        <FrameHeader>
          <div className="flex min-w-0 flex-col gap-0.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-44 max-w-full" />
          </div>
        </FrameHeader>
        <FramePanel>
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <Skeleton className="h-8 w-full rounded-lg xl:flex-1" />
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Skeleton className="h-8 w-full rounded-lg sm:w-40" />
              <Skeleton className="h-8 w-full rounded-lg sm:w-40" />
            </div>
          </div>
        </FramePanel>
        <FramePanel className="divide-y divide-border p-0">
          {Array.from({ length: 5 }, (_, index) => (
            <NoteRowSkeleton key={index} />
          ))}
        </FramePanel>
        <FrameFooter>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-7 w-48 max-w-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-7 w-28" />
            </div>
          </div>
        </FrameFooter>
      </Frame>

      <MobileFabSkeleton />
    </div>
  );
}
