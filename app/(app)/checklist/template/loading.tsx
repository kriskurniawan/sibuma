import { Skeleton } from "@/components/ui/skeleton";
import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";

export default function ChecklistTemplateLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat template checklist…</span>
      <Skeleton className="h-7 w-32" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      {Array.from({ length: 2 }, (_, index) => (
        <Frame key={index}>
          <FrameHeader>
            <Skeleton className="h-4 w-32" />
          </FrameHeader>
          <FramePanel>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </FramePanel>
        </Frame>
      ))}
    </div>
  );
}
