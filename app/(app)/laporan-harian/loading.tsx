import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { PageHeader } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";

export default function DailyReportLoading() {
  return (
    <div
      className="flex min-w-0 flex-col gap-4 md:gap-6 lg:gap-8"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Memuat laporan harian…</span>

      <PageHeader
        mobileCompact
        eyebrow="Operasional"
        title="Laporan harian"
        description="Teks dan kolase foto siap dibagikan ke WhatsApp."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-7 w-32" />
          </div>
        }
      />

      <Frame spacing="default">
        <FramePanel className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-full sm:w-60" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-3 w-44 max-w-full" />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-3 w-64 max-w-full" />
            <Skeleton className="h-7 w-24" />
          </div>
        </FramePanel>
      </Frame>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Frame spacing="default" className="min-w-0">
          <FrameHeader className="flex flex-row items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <FrameTitle>Teks laporan</FrameTitle>
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="h-7 w-20" />
          </FrameHeader>
          <FramePanel>
            <div className="flex flex-col gap-3 py-1">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-48" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-10/12" />
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3.5 w-5/12" />
            </div>
          </FramePanel>
        </Frame>

        <Frame spacing="default" className="min-w-0">
          <FrameHeader>
            <FrameTitle>Ringkasan</FrameTitle>
            <Skeleton className="h-3 w-56 max-w-full" />
          </FrameHeader>
          <FramePanel className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 flex-col">
              {["Tim", "Pekerjaan selesai", "Checklist selesai", "Foto terpilih", "Kolase"].map(
                (label) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0"
                  >
                    <span className="text-sm text-muted-foreground">
                      {label}
                    </span>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ),
              )}
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-3/4" />
          </FramePanel>
        </Frame>
      </div>

      <Frame spacing="default" className="min-w-0">
        <FrameHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <FrameTitle>Foto dokumentasi</FrameTitle>
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-7 w-28" />
          </div>
        </FrameHeader>
        <FramePanel className="min-w-0">
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-muted"
              >
                <Skeleton className="absolute inset-0 size-full rounded-none" />
                <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-2">
                  <Skeleton className="h-5 w-20" />
                  <div className="flex gap-1">
                    <Skeleton className="size-7" />
                    <Skeleton className="size-7" />
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
