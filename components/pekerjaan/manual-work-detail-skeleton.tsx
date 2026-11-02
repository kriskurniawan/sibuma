import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

function DetailRowSkeleton({ label }: { label?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 text-sm last:border-0">
      {label ? (
        <span className="text-muted-foreground">{label}</span>
      ) : (
        <Skeleton className="h-3 w-24" />
      )}
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

export function ManualWorkDetailSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-5"
    >
      <span className="sr-only">Memuat detail pekerjaan harian…</span>
      <div className="hidden flex-col gap-4 md:flex xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">
            Pekerjaan harian
          </p>
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
      <Frame className="md:hidden">
        <FramePanel className="flex flex-col gap-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </FramePanel>
      </Frame>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Frame>
            <div className="hidden md:block">
              <FrameHeader>
                <FrameTitle>Rincian pekerjaan</FrameTitle>
                <FrameDescription>
                  Rincian pekerjaan dan dokumentasi.
                </FrameDescription>
              </FrameHeader>
            </div>
            <FramePanel className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
              </div>
              <div className="flex flex-col">
                {["Lokasi", "Mulai", "Target selesai", "Dokumentasi"].map((label) => (
                  <DetailRowSkeleton key={label} label={label} />
                ))}
              </div>
            </FramePanel>
          </Frame>
          <Frame role="region" aria-label="Dokumentasi">
            <div className="hidden md:block">
              <FrameHeader className="flex-row items-start justify-between gap-3">
                <FrameTitle>Dokumentasi</FrameTitle>
                <Skeleton className="h-4 w-24" />
              </FrameHeader>
            </div>
            <FramePanel className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="size-16" />
                ))}
              </div>
              <Skeleton className="h-8 w-28" />
            </FramePanel>
          </Frame>
          <Frame>
            <FrameHeader>
              <FrameTitle>Riwayat</FrameTitle>
              <FrameDescription>
                Jejak perubahan status dan catatan pekerjaan.
              </FrameDescription>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex gap-3">
                  <Skeleton className="mt-1 size-2 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-48 max-w-full" />
                  </div>
                </div>
              ))}
            </FramePanel>
          </Frame>
        </div>
        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-20 xl:self-start">
          <div className="hidden md:block">
            <Frame spacing="sm">
              <FrameHeader>
                <FrameTitle>Status & tindakan</FrameTitle>
                <Skeleton className="h-4 w-44 max-w-full" />
              </FrameHeader>
              <FramePanel className="flex flex-col gap-3">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </FramePanel>
            </Frame>
          </div>
          <Frame spacing="sm">
            <FrameHeader>
              <FrameTitle>Pekerja</FrameTitle>
              <Skeleton className="h-4 w-32" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-2">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Skeleton className="h-4 w-32 max-w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </FramePanel>
          </Frame>
          <Frame spacing="sm">
            <FrameHeader><FrameTitle>Informasi</FrameTitle></FrameHeader>
            <FramePanel className="flex flex-col">
              <DetailRowSkeleton />
              <DetailRowSkeleton label="Dibuat" />
            </FramePanel>
          </Frame>
        </aside>
      </div>
    </div>
  );
}
