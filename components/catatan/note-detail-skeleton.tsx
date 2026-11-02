import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

export function NoteDetailSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-5">
      <span className="sr-only">Memuat detail catatan…</span>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">Catatan</p>
        <Skeleton className="h-7 w-64 max-w-full sm:h-8" />
        <Skeleton className="h-5 w-40" />
      </div>
      <dl aria-label="Riwayat catatan" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-1.5"><dt>Dibuat</dt><dd><Skeleton className="h-4 w-36" /></dd></div>
      </dl>
      <Frame>
        <FrameHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <FrameTitle>Isi catatan</FrameTitle>
            <Skeleton className="h-4 w-48 max-w-full" />
          </div>
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
        </FrameHeader>
        <FramePanel className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" />
        </FramePanel>
      </Frame>
      <Frame>
        <FrameHeader><FrameTitle>Foto</FrameTitle><Skeleton className="h-4 w-32" /></FrameHeader>
        <FramePanel>
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="w-36 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:w-44">
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <span className="flex min-w-0 items-center justify-between gap-2 px-2 py-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-8 shrink-0" />
                </span>
              </div>
            ))}
          </div>
        </FramePanel>
      </Frame>
      <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Skeleton className="h-7 w-full sm:w-28" /><Skeleton className="h-7 w-full sm:w-32" />
      </div>
    </div>
  );
}
