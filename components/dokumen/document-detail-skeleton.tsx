import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

export function DocumentDetailSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-5"
    >
      <span className="sr-only">Memuat detail dokumen kerja…</span>
      <div className="hidden flex-col gap-4 md:flex xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Dokumen kerja</p>
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <Frame className="md:hidden">
        <FramePanel className="flex flex-col gap-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-5 w-44" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </FramePanel>
      </Frame>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Frame stacked spacing="sm">
            <FrameHeader className="hidden flex-row flex-wrap items-center justify-between gap-2 md:flex">
              <div className="flex min-w-0 flex-col gap-0.5">
                <FrameTitle>Pratinjau</FrameTitle>
                <Skeleton className="h-4 w-56 max-w-full" />
              </div>
              <Skeleton className="h-8 w-32" />
            </FrameHeader>
            <FramePanel className="overflow-hidden p-0">
              <Skeleton className="h-[min(70vh,44rem)] w-full" />
            </FramePanel>
          </Frame>
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          <Frame stacked spacing="sm">
            <FrameHeader>
              {/* Ownership and account access determine this section's title. */}
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-44 max-w-full" />
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">
              {Array.from({ length: 2 }, (_, index) => (
                <div key={index} className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-40 max-w-full" />
                  </div>
                  <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
                </div>
              ))}
            </FramePanel>
          </Frame>
          <Frame stacked spacing="sm">
            <FrameHeader><FrameTitle>Informasi berkas</FrameTitle></FrameHeader>
            <FramePanel className="flex flex-col py-0">
              {["Pemilik", "Folder", "Nama berkas", "Ukuran", "Diunggah"].map((label) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-border py-3 text-sm last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </FramePanel>
          </Frame>
        </aside>
      </div>
    </div>
  );
}
