import { Skeleton } from "@/components/ui/skeleton";
import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";

export default function ChecklistDetailLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat detail checklist…</span>
      <Skeleton className="h-7 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Frame>
        <FrameHeader>
          <Skeleton className="h-4 w-32" />
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4">
          <Skeleton className="h-2 w-full" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </FramePanel>
      </Frame>
      <Frame>
        <FrameHeader>
          <Skeleton className="h-4 w-40" />
        </FrameHeader>
        <FramePanel className="flex flex-col gap-5">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col gap-3">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ))}
        </FramePanel>
      </Frame>
    </div>
  );
}
