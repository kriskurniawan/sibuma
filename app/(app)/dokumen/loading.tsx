import {
  Frame,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

function DocumentRowSkeleton() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      <Skeleton className="size-8 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-4 w-52 max-w-full" />
        <Skeleton className="h-3 w-36 max-w-full" />
      </div>
      <Skeleton className="hidden h-5 w-16 shrink-0 rounded-full sm:block" />
      <Skeleton className="hidden h-3 w-24 shrink-0 md:block" />
    </div>
  );
}

export default function DokumenLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-5 pb-8"
    >
      <span className="sr-only">Memuat dokumen kerja…</span>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-52" />
          <Skeleton className="hidden h-4 w-full max-w-xl sm:block" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Frame className="order-2 min-w-0 xl:order-1">
          <FrameHeader className="flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-8 w-72 max-w-full rounded-lg" />
          </FrameHeader>
          <FramePanel>
            <Skeleton className="h-9 w-full rounded-md" />
          </FramePanel>
          <FramePanel className="divide-y divide-border/70 p-0">
            {Array.from({ length: 6 }, (_, index) => (
              <DocumentRowSkeleton key={index} />
            ))}
          </FramePanel>
        </Frame>

        <div className="order-1 flex min-w-0 flex-col gap-4 xl:order-2">
          <Frame spacing="sm">
            <FrameHeader className="gap-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="flex flex-col gap-1">
                    <Skeleton className="h-3 w-16 max-w-full" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                ))}
              </div>
            </FramePanel>
          </Frame>
        </div>
      </div>
    </div>
  );
}
