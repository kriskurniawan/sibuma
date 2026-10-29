import { Frame, FramePanel } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function MobileSummarySkeleton({ className }: { className?: string }) {
  return (
    <Frame spacing="sm" className={cn("min-w-0", className)}>
      <div className="grid grid-cols-2 gap-1">
        {Array.from({ length: 4 }, (_, index) => (
          <FramePanel key={index} className="flex min-w-0 flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-3 w-16 max-w-full" />
              <Skeleton className="size-8 shrink-0" />
            </div>
            <Skeleton className="h-7 w-12" />
          </FramePanel>
        ))}
      </div>
    </Frame>
  );
}
