import { Frame, FramePanel } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function MobileSummarySkeleton({
  className,
  items = 4,
  columns = 2,
}: {
  className?: string;
  items?: number;
  columns?: 2 | 3;
}) {
  return (
    <Frame spacing="sm" className={cn("min-w-0", className)}>
      <div
        className={cn(
          "grid gap-1",
          columns === 2 ? "grid-cols-2" : "grid-cols-3",
        )}
      >
        {Array.from({ length: items }, (_, index) => (
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
