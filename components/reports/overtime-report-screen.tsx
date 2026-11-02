import Link from "next/link";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock3,
  FileBarChart2,
  RotateCcw,
  UsersRound,
} from "lucide-react";
import { DataLoadError } from "@/components/data-load-error";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import {
  Avatar,
  Badge,
  EmptyState,
  ProgressBar,
  StatCard,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ReportDataGrid } from "@/components/reports/report-data-grid";
import {
  firstReportParam as first,
  reportRange,
  type ReportParams,
} from "@/components/reports/report-shell";
import { readOwnerId } from "@/lib/access";
import { getReportData, type ReportFilters } from "@/lib/queries";
import { pageRequest } from "@/lib/pagination";
import { durationLabel, formatDateHuman } from "@/lib/time";
import type { SessionUser } from "@/lib/types";

export async function OvertimeReportScreen({
  user,
  params,
}: {
  user: SessionUser;
  params: ReportParams;
}) {
  const { from, to } = reportRange("lembur", params);
  const filters: ReportFilters = {
    from,
    to,
    employeeId: first(params.employeeId) || undefined,
    spklId: first(params.spklId) || undefined,
    search: first(params.search)?.trim() || undefined,
  };
  const printing = first(params.print) === "1";
  const ownerId = readOwnerId(user);
  const data = await getReportData(
    ownerId,
    filters,
    printing ? undefined : pageRequest(first(params.page), first(params.size)),
  ).catch(() => null);
  if (!data)
    return <DataLoadError message="Data laporan lembur gagal dimuat." />;
  const periodLabel = `${formatDateHuman(`${from}T12:00:00`, "d MMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMM yyyy")}`;
  const maxEmployeeMinutes = Math.max(
    1,
    ...data.summaries.map((summary) => summary.totalMinutes),
  );
  const attendanceRate =
    data.totals.sessions === 0
      ? 0
      : Math.round((data.totals.present / data.totals.sessions) * 100);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total sesi"
          value={data.totals.sessions}
          icon={UsersRound}
          helper={`${data.totals.employees} pekerja`}
          tone="primary"
        />
        <StatCard
          label="Total jam"
          value={durationLabel(data.totals.minutes)}
          icon={Clock3}
          helper="Setelah pembulatan kebijakan"
          tone="primary"
        />
        <StatCard
          label="Dokumentasi"
          value={data.totals.documentation}
          suffix="foto"
          icon={Camera}
          helper="Bukti kerja terlampir"
          tone="info"
        />
        <StatCard
          label="Tingkat kehadiran"
          value={`${attendanceRate}%`}
          icon={CheckCircle2}
          helper={`${data.totals.present} hadir · ${data.totals.absent} tidak hadir`}
          tone="success"
        />
      </div>
      {data.rows.length > 0 && (
        <Frame>
          <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Beban lembur tim</FrameTitle>
              <FrameDescription className="text-xs">
                {printing
                  ? "Ringkasan per pekerja"
                  : "20 pekerja dengan durasi tertinggi · total mengikuti seluruh filter"}
              </FrameDescription>
            </div>
            <Badge variant="outline">{periodLabel}</Badge>
          </FrameHeader>
          <FramePanel>
            <div className="flex flex-col divide-y divide-border/70">
              {data.summaries.map((summary) => (
                <div
                  key={summary.employee.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <Avatar
                    name={summary.employee.name}
                    seed={summary.employee.id}
                    size="sm"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="min-w-0 truncate text-sm font-medium text-foreground">
                        {summary.employee.name}
                      </p>
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {durationLabel(summary.totalMinutes)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <ProgressBar
                        value={summary.totalMinutes}
                        max={maxEmployeeMinutes}
                        tone={summary.absentCount > 0 ? "warning" : "primary"}
                        className="flex-1"
                      />
                      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                        {summary.presentCount}/{summary.sessionCount} hadir ·{" "}
                        {summary.documentationCount} foto
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FramePanel>
        </Frame>
      )}
      <Frame className="print:break-inside-auto print:[&_[data-slot=frame-panel]]:break-inside-auto">
        <FrameHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Rincian absensi</FrameTitle>
              <FrameDescription className="text-xs">
                {data.totals.sessions} baris data
              </FrameDescription>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              Koreksi ditandai dan tercatat di audit log
            </p>
          </div>
        </FrameHeader>
        {data.rows.length === 0 ? (
          <FramePanel>
            <EmptyState
              icon={FileBarChart2}
              title="Belum ada data pada periode ini"
              description="Ubah rentang tanggal atau filter pekerja. Sesudah SPKL berakhir, ketidakhadiran otomatis dicatat sebagai data laporan."
              action={
                <Button
                  nativeButton={false}
                  render={<Link href="/laporan?tab=lembur" />}
                >
                  <RotateCcw aria-hidden="true" />
                  Ubah filter
                </Button>
              }
            />
          </FramePanel>
        ) : (
          <FramePanel className="p-0">
            <ReportDataGrid
              key={JSON.stringify(filters)}
              rows={data.rows}
              total={data.totals.sessions}
              pagination={
                data.pagination ?? {
                  pageIndex: 0,
                  pageSize: Math.max(10, data.totals.sessions),
                }
              }
              printRows={printing ? data.rows : undefined}
            />
          </FramePanel>
        )}
        <FrameFooter className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-1.5">
            <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
            Durasi memakai pembulatan kebijakan
          </span>
          <span className="flex items-center gap-1.5">
            <UsersRound className="size-3.5 shrink-0" aria-hidden="true" />
            {data.totals.employees} pekerja · {data.totals.sessions} sesi
          </span>
        </FrameFooter>
      </Frame>
    </div>
  );
}
