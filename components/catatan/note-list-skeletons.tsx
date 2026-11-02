import { NoteListFrame, NotePageShell } from "@/components/catatan/note-list-shell";
import { ListPaginationSkeleton } from "@/components/list-pagination";
import { FrameFooter, FramePanel } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

function NoteRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <Skeleton className="mt-0.5 size-6 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-2/3 max-w-sm sm:hidden" />
        <Skeleton className="h-5 w-3/4 max-w-xl" />
      </div>
      <div className="mt-0.5 flex shrink-0 items-center gap-2">
        <Skeleton className="h-4 w-5" />
        <Skeleton className="size-4" />
      </div>
    </div>
  );
}

export function NoteListCountSkeleton() {
  return <Skeleton className="h-4 w-44 max-w-full" />;
}

export function NoteListRowsSkeleton() {
  return (
    <FramePanel aria-busy="true" className="divide-y divide-border p-0">
      <span className="sr-only" role="status">Memuat catatan…</span>
      {Array.from({ length: 5 }, (_, index) => <NoteRowSkeleton key={index} />)}
    </FramePanel>
  );
}

export function NoteListFooterSkeleton() {
  return (
    <FrameFooter aria-busy="true">
      <span className="sr-only" role="status">Memuat navigasi halaman catatan…</span>
      <ListPaginationSkeleton />
    </FrameFooter>
  );
}

export function NoteListPageSkeleton() {
  return (
    <NotePageShell>
      <NoteListFrame description={<NoteListCountSkeleton />} footer={<NoteListFooterSkeleton />}>
        <NoteListRowsSkeleton />
      </NoteListFrame>
    </NotePageShell>
  );
}
