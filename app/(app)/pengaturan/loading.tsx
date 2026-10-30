import { Frame, FrameHeader, FramePanel } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";
import { SETTINGS_TABS } from "@/lib/settings-tabs";

export default function SettingsLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Memuat pengaturan…</span>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="hidden h-4 w-full max-w-xl md:block" />
        </div>
        <Skeleton className="h-9 w-36 shrink-0 rounded-md" />
      </div>

      <div className="flex w-full max-w-4xl flex-col gap-4">
        <div className="flex h-8 w-max max-w-full items-center gap-4 overflow-hidden">
          {SETTINGS_TABS.map((tab, index) => (
            <Skeleton
              key={tab.value}
              className={
                index === SETTINGS_TABS.length - 1 ? "h-4 w-24" : "h-4 w-16"
              }
            />
          ))}
        </div>

        <Frame spacing="default">
          <FrameHeader className="gap-2">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Skeleton className="h-4 w-44 max-w-full" />
                <Skeleton className="hidden h-3 w-72 max-w-full md:block" />
              </div>
            </div>
          </FrameHeader>

          <FramePanel>
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="flex flex-col gap-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-full rounded-md" />
                  </div>
                ))}
              </div>

              <div className="grid gap-4 border-t border-border/70 pt-5 sm:grid-cols-2">
                {Array.from({ length: 2 }, (_, index) => (
                  <div key={index} className="flex flex-col gap-2">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-8 w-full rounded-md" />
                  </div>
                ))}
              </div>

              <div className="flex justify-end border-t border-border/70 pt-4">
                <Skeleton className="h-8 w-36 rounded-md" />
              </div>
            </div>
          </FramePanel>
        </Frame>
      </div>
    </div>
  );
}
