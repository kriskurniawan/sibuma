import { Skeleton } from "@/components/ui/skeleton";
import {
  Frame,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";

function MenuRowSkeleton() {
  return (
    <div className="flex min-w-0 items-center gap-3 py-3">
      <Skeleton className="size-4 shrink-0 rounded-sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className="h-4 w-36 max-w-full" />
        <Skeleton className="hidden h-3 w-48 max-w-full md:block" />
      </div>
      <Skeleton className="size-4 shrink-0" />
    </div>
  );
}

function MenuGroupSkeleton({ rows }: { rows: number }) {
  return (
    <Frame stacked spacing="default" className="min-w-0">
      <FrameHeader>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="hidden h-3 w-56 max-w-full md:block" />
      </FrameHeader>
      <FramePanel>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, index) => (
            <MenuRowSkeleton key={index} />
          ))}
        </div>
      </FramePanel>
    </Frame>
  );
}

export default function MenuLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-w-0 flex-col gap-6"
    >
      <span className="sr-only">Memuat menu…</span>

      <Skeleton className="hidden h-7 w-24 md:block" />

      <Frame spacing="default">
        <FramePanel>
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="size-4 shrink-0" />
          </div>
        </FramePanel>
      </Frame>

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
        <MenuGroupSkeleton rows={7} />
        <MenuGroupSkeleton rows={2} />
        <MenuGroupSkeleton rows={1} />
      </div>

      <Frame spacing="default">
        <FramePanel className="flex flex-col gap-3">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </FramePanel>
      </Frame>
    </div>
  );
}
