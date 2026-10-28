import {
  Frame,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

export default function LemburLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Memuat data lembur…</span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      <Frame>
        <FrameHeader className="gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-52 max-w-full" />
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Skeleton className="h-9 w-full max-w-xl rounded-md" />
            <Skeleton className="h-9 w-full rounded-md lg:w-72" />
          </div>
        </FrameHeader>
        <FramePanel className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-3">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-4/5" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          ))}
        </FramePanel>
      </Frame>
    </div>
  );
}
