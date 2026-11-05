import { PublicShell } from "@/components/checklist/public-shell";
import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

export default function PublicEquipmentDetailLoading() {
  return (
    <PublicShell
      headerAction={
        <>
          <Skeleton className="hidden h-6 w-20 sm:block" />
          <Skeleton className="h-8 w-28" />
        </>
      }
    >
      <div
        aria-busy="true"
        aria-live="polite"
        className="flex min-w-0 flex-col gap-4 md:gap-6"
      >
        <span className="sr-only">Memuat riwayat peralatan…</span>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-6 w-56 max-w-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Frame spacing="default">
          <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
          </FrameHeader>
          <FramePanel>
            <ul className="divide-y divide-border/70">
              {Array.from({ length: 3 }, (_, index) => (
                <li
                  key={index}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Skeleton className="h-4 w-24" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </li>
              ))}
            </ul>
          </FramePanel>
        </Frame>
        <Frame spacing="default">
          <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Skeleton className="h-4 w-36 max-w-full" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </FrameHeader>
          <FramePanel className="p-0">
            <ul className="divide-y divide-border/70">
              {Array.from({ length: 3 }, (_, index) => (
                <li
                  key={index}
                  className="flex flex-col gap-2 px-4 py-4 sm:px-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-3 w-44 max-w-full" />
                  <Skeleton className="h-4 w-3/4 max-w-full" />
                </li>
              ))}
            </ul>
          </FramePanel>
        </Frame>
      </div>
    </PublicShell>
  );
}
