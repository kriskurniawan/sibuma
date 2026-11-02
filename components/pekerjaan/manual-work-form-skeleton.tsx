import {
  Frame,
  FrameFooter,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

function FieldSkeleton({ labelWidth = "w-28" }: { labelWidth?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className={`h-3 ${labelWidth}`} />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}

export function ManualWorkFormSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-5 pb-24 xl:pb-0"
    >
      <span className="sr-only">Memuat formulir pekerjaan harian…</span>

      <Skeleton className="hidden h-4 w-40 md:block" />

      <div className="hidden flex-col gap-2 md:flex">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Frame>
            <FrameHeader>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              <FieldSkeleton labelWidth="w-32" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
              <FieldSkeleton labelWidth="w-20" />
              <FieldSkeleton labelWidth="w-36" />
            </FramePanel>
          </Frame>

          <Frame>
            <FrameHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </FrameHeader>
            <FramePanel className="grid gap-4 sm:grid-cols-2">
              <FieldSkeleton labelWidth="w-28" />
              <FieldSkeleton labelWidth="w-28" />
            </FramePanel>
          </Frame>
        </div>

        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-20 xl:self-start">
          <Frame spacing="sm">
            <FrameHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <div className="flex flex-col gap-2 pt-1">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="flex items-center gap-2.5">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="flex flex-1 flex-col gap-1">
                      <Skeleton className="h-3.5 w-32 max-w-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="size-4 shrink-0" />
                  </div>
                ))}
              </div>
            </FramePanel>
            <FrameFooter className="hidden xl:flex">
              <Skeleton className="h-9 w-full rounded-md" />
            </FrameFooter>
          </Frame>
        </aside>
      </div>

      <div className="mobile-action-bar fixed inset-x-0 z-30 border-t border-border bg-background px-4 pt-2.5 xl:hidden">
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <Skeleton className="h-9 flex-1 rounded-md" />
          <Skeleton className="h-9 flex-[1.4] rounded-md" />
        </div>
      </div>
    </div>
  );
}
