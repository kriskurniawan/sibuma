import Link from "next/link";
import { DataLoadError } from "@/components/data-load-error";
import { Frame, FramePanel } from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkerHistorySummary } from "@/lib/spkl-list-queries";

/** Values/helpers load in place; summary labels and surfaces are shared. */
export function HistorySummary({
  summary,
  error = false,
}: {
  summary?: WorkerHistorySummary;
  error?: boolean;
}) {
  const loading = summary === undefined && !error;
  const stats = summary?.stats;
  const empty = stats && stats.monthlyMinutes === 0 && stats.monthlySessions === 0
    && stats.completedSessions === 0 && stats.documentationCount === 0;

  return (
    <div className="flex flex-col gap-3" aria-busy={loading} role={loading ? "status" : undefined}>
      {loading && <span className="sr-only">Memuat ringkasan lembur…</span>}
      <Frame spacing="xs">
        <div className="grid min-w-0 grid-cols-3 gap-1 md:gap-3">
          <FramePanel className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">
              <span className="md:hidden">Periode ini</span>
              <span className="hidden md:inline">Total periode ini</span>
            </p>
            <div className="flex min-w-0 flex-wrap items-baseline gap-1 text-xl font-semibold tracking-tight tabular-nums md:text-2xl">
              {stats ? Math.floor(stats.monthlyMinutes / 60) : loading ? <Skeleton className="h-7 w-10" /> : "—"}
              <span className="text-xs font-medium text-muted-foreground">jam</span>
              <span className="md:hidden">
                {stats ? stats.monthlyMinutes % 60 : loading ? <Skeleton className="inline-block h-5 w-6" /> : "—"}
              </span>
              <span className="text-xs font-medium text-muted-foreground md:hidden">m</span>
            </div>
            <div className="hidden text-xs text-muted-foreground md:block">
              <span className="inline-flex flex-wrap items-center gap-1">
                {stats ? stats.monthlyMinutes % 60 : loading ? <Skeleton className="h-4 w-6" /> : "—"}
                <span>menit ·</span>
                {summary ? summary.periodLabel : loading ? <Skeleton className="h-4 w-28 max-w-full" /> : "—"}
              </span>
            </div>
          </FramePanel>
          <FramePanel className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">Sesi selesai</p>
            <div className="flex flex-wrap items-baseline gap-1 text-xl font-semibold tracking-tight tabular-nums md:text-2xl">
              {stats ? stats.completedSessions : loading ? <Skeleton className="h-7 w-10" /> : "—"}
              <span className="hidden text-xs font-medium text-muted-foreground md:inline">sesi</span>
            </div>
            <div className="hidden text-xs text-muted-foreground md:block">
              {stats ? `${stats.monthlySessions} sesi memiliki absensi masuk`
                : loading ? <><Skeleton className="inline-block h-4 w-6" /> sesi memiliki absensi masuk</> : "Ringkasan tidak tersedia"}
            </div>
          </FramePanel>
          <FramePanel className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">Dokumentasi</p>
            <div className="flex flex-wrap items-baseline gap-1 text-xl font-semibold tracking-tight tabular-nums md:text-2xl">
              {stats ? stats.documentationCount : loading ? <Skeleton className="h-7 w-10" /> : "—"}
              <span className="hidden text-xs font-medium text-muted-foreground md:inline">foto</span>
            </div>
            <p className="hidden text-xs text-muted-foreground md:block">Bukti kerja yang kamu unggah pada periode ini</p>
          </FramePanel>
        </div>
      </Frame>
      {error && <DataLoadError message="Ringkasan lembur belum dapat dimuat." />}
      {empty && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Belum ada aktivitas lembur pada periode ini.</p>
          <Button nativeButton={false} render={<Link href="/" />} variant="outline" size="sm">Kembali ke beranda</Button>
        </div>
      )}
    </div>
  );
}
