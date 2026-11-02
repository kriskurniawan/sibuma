import {
  Frame,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Memuat notifikasi…</span>

      {/* PageHeader memakai mobileCompact: judul dan deskripsi hanya tampil
          di app bar pada ponsel, jadi skeleton pun disembunyikan di sana.
          Tombol aktivasi tetap terlihat di semua ukuran. */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="hidden flex-col gap-2 md:flex">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>

      <Frame spacing="sm">
        <FrameHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </FrameHeader>
        <FramePanel>
          <div className="flex flex-col gap-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3 p-2">
                <Skeleton className="size-8 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
