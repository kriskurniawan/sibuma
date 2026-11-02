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

export default function DokumenDetailLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-5 pb-8"
    >
      <span className="sr-only">Memuat detail dokumen kerja…</span>

      <Skeleton className="hidden h-4 w-36 md:block" />

      <div className="hidden flex-col gap-4 md:flex xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-64 max-w-full" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>

      <Frame className="md:hidden">
        <FramePanel className="flex flex-col gap-3">
          <Skeleton className="h-6 w-3/4 max-w-full" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </FramePanel>
      </Frame>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Frame stacked spacing="sm">
            <FrameHeader className="hidden flex-row items-center justify-between gap-3 md:flex">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-48 max-w-full" />
              </div>
              <Skeleton className="h-8 w-32 rounded-md" />
            </FrameHeader>
            <FramePanel className="p-0">
              <Skeleton className="h-[min(70vh,44rem)] w-full rounded-none" />
            </FramePanel>
          </Frame>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Frame spacing="sm">
            <FrameHeader className="gap-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44 max-w-full" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-40 max-w-full" />
                  </div>
                  <Skeleton className="h-5 w-9 rounded-full" />
                </div>
              ))}
            </FramePanel>
          </Frame>

          <Frame spacing="sm">
            <FrameHeader className="gap-1">
              <Skeleton className="h-4 w-32" />
            </FrameHeader>
            <FramePanel className="flex flex-col py-0">
              {Array.from({ length: 5 }, (_, index) => (
                <DetailRowSkeleton key={index} />
              ))}
            </FramePanel>
          </Frame>
        </aside>
      </div>
    </div>
  );
}
