import { Skeleton } from "@/components/ui/skeleton";
import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";

export default function ChecklistScheduleLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat jadwal checklist…</span>
      <Skeleton className="h-7 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <Frame>
        <FrameHeader>
          <Skeleton className="h-4 w-36" />
        </FrameHeader>
        <FramePanel>
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-72" />
              </div>
            ))}
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
