import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

function HeaderActionsSkeleton({ withBadge }: { withBadge?: boolean }) {
  if (!withBadge) return <Skeleton className="h-8 w-28" />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-8 w-28" />
    </div>
  );
}

function RecordHeaderSkeleton({ withBadge }: { withBadge?: boolean }) {
  return (
    <>
      <div className="hidden flex-col gap-4 md:flex xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-72 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <HeaderActionsSkeleton withBadge={withBadge} />
      </div>
      <Frame className="md:hidden">
        <FramePanel className="flex flex-col gap-3">
          <Skeleton className="h-3 w-40" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-48 max-w-full" />
          <HeaderActionsSkeleton withBadge={withBadge} />
        </FramePanel>
      </Frame>
    </>
  );
}

function AnswerSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-1.5"><Skeleton className="h-3 w-5" /><Skeleton className="h-5 w-14 rounded-full" /><Skeleton className="h-5 w-16 rounded-full" /></div>
      <div className="flex flex-col gap-1.5"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div>
      <Skeleton className="h-16 w-full" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3"><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-20" /></div>
    </div>
  );
}

export function ChecklistDetailSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-6 lg:gap-8">
      <span className="sr-only">Memuat detail checklist…</span>
      <RecordHeaderSkeleton withBadge />
      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5"><FrameTitle className="max-md:sr-only">Ringkasan</FrameTitle><Skeleton className="h-4 w-52 max-w-full" /></div><Skeleton className="h-3 w-8" />
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4">
          <Skeleton className="h-2 w-full" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 xl:grid-cols-4">
            {["Lokasi", "Tanggal jadwal", "Deadline", "Pembuat"].map((label) => <div key={label} className="flex flex-col gap-0.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd><Skeleton className="h-4 w-24 max-w-full" /></dd></div>)}
            <div className="col-span-2 flex flex-col gap-1"><dt className="text-xs text-muted-foreground">Tim yang ditugaskan</dt><dd className="flex flex-wrap gap-2"><Skeleton className="h-6 w-24 rounded-full" /><Skeleton className="h-6 w-28 rounded-full" /></dd></div>
            <div className="col-span-2 flex flex-col gap-0.5"><dt className="text-xs text-muted-foreground">Jadwal</dt><dd><Skeleton className="h-4 w-44 max-w-full" /></dd></div>
          </dl>
        </FramePanel>
      </Frame>
      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5"><FrameTitle>Item checklist</FrameTitle><Skeleton className="h-4 w-48 max-w-full" /></div><Skeleton className="h-5 w-12" />
        </FrameHeader>
        <FramePanel className="p-0"><div className="divide-y divide-border/70">{Array.from({ length: 3 }, (_, index) => <AnswerSkeleton key={index} />)}</div></FramePanel>
      </Frame>
    </div>
  );
}

export function ChecklistTemplateDetailSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex min-w-0 flex-col gap-6 lg:gap-8">
      <span className="sr-only">Memuat template checklist…</span>
      <RecordHeaderSkeleton />
      <Frame className="min-w-0">
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5"><FrameTitle className="max-md:sr-only">Item checklist</FrameTitle><FrameDescription className="hidden text-xs md:block">Versi terbit dan checklist lama tidak berubah.</FrameDescription></div>
          <Skeleton className="h-8 w-full sm:w-56" />
        </FrameHeader>
        <FramePanel>
          <ul className="divide-y divide-border/70">
            {Array.from({ length: 3 }, (_, index) => <li key={index} className="flex flex-col gap-1.5 py-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></li>)}
          </ul>
        </FramePanel>
      </Frame>
      <Frame className="min-w-0">
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5"><FrameTitle>Riwayat versi</FrameTitle><FrameDescription className="text-xs">Pilih “Lihat” untuk menampilkan item versi tersebut di bagian atas.</FrameDescription></div><Skeleton className="h-5 w-16" />
        </FrameHeader>
        <FramePanel>
          <ul className="divide-y divide-border/70">
            {Array.from({ length: 2 }, (_, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="flex min-w-0 flex-col gap-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-48 max-w-full" /></div><Skeleton className="h-8 w-20" /></li>)}
          </ul>
        </FramePanel>
      </Frame>
    </div>
  );
}
