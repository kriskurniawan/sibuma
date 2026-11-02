import {
  Frame,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-w-0 flex-col gap-6"
    >
      <span className="sr-only">Memuat profil…</span>

      <div className="hidden flex-col gap-2 md:flex">
        <Skeleton className="h-7 w-24" />
      </div>

      <Frame spacing="default">
        <FramePanel className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-14 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Skeleton className="h-5 w-40 max-w-full" />
              <Skeleton className="h-3 w-52 max-w-full" />
            </div>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 sm:gap-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="h-8 w-32" />
        </FramePanel>
      </Frame>

      <Frame spacing="default">
        <FrameHeader>
          <Skeleton className="h-5 w-24" />
        </FrameHeader>
        <FramePanel className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
          <Skeleton className="h-8 w-36" />
        </FramePanel>
      </Frame>

      <Frame spacing="default">
        <FrameHeader>
          <Skeleton className="h-5 w-28" />
        </FrameHeader>
        <FramePanel>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-[18.4px] w-8 rounded-full" />
          </div>
        </FramePanel>
      </Frame>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Frame spacing="default">
            <FrameHeader>
              <Skeleton className="h-5 w-28" />
            </FrameHeader>
            <FramePanel>
              <div className="flex flex-col divide-y divide-border">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="flex items-center gap-3 py-3">
                    <Skeleton className="size-4 shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Skeleton className="h-4 w-40 max-w-full" />
                      <Skeleton className="h-3 w-56 max-w-full" />
                    </div>
                    <Skeleton className="size-4 shrink-0" />
                  </div>
                ))}
              </div>
            </FramePanel>
          </Frame>

          <Frame spacing="default">
            <FrameHeader>
              <Skeleton className="h-5 w-32" />
            </FrameHeader>
            <FramePanel className="flex min-w-0 flex-col gap-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-8 w-40" />
            </FramePanel>
          </Frame>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Frame spacing="default">
            <FrameHeader>
              <Skeleton className="h-5 w-32" />
            </FrameHeader>
            <FramePanel className="flex min-w-0 flex-col gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </FramePanel>
          </Frame>

          <Frame spacing="default">
            <FrameHeader>
              <Skeleton className="h-5 w-36" />
            </FrameHeader>
            <FramePanel className="flex min-w-0 flex-col gap-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </FramePanel>
          </Frame>
        </div>
      </div>
    </div>
  );
}
