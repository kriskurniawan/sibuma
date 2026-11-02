import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  Clock3,
  FileBarChart2,
  Hammer,
  RotateCcw,
  TriangleAlert,
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
import { Badge, EmptyState, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ManualWorkReportGrid } from "@/components/reports/manual-work-report-grid";
import {
  firstReportParam as first,
  reportRange,
  type ReportParams,
} from "@/components/reports/report-shell";
import { readOwnerId } from "@/lib/access";
import { getManualWorkReportData } from "@/lib/manual-work-report";
import type { ManualWorkReportFilters } from "@/lib/manual-work-types";
import { pageRequest } from "@/lib/pagination";
import { getPhotoLimits } from "@/lib/photo-limits";
import { formatDateHuman } from "@/lib/time";
import type { SessionUser } from "@/lib/types";

export async function ManualWorkReportScreen({
  user,
  params,
}: {
  user: SessionUser;
  params: ReportParams;
}) {
  const { from, to } = reportRange("pekerjaan", params);
  const filters: ManualWorkReportFilters = {
    from,
    to,
    locationId: first(params.locationId) || undefined,
    includeSubLocations: first(params.includeSub) !== "0",
    status: first(params.status) || undefined,
    employeeId: first(params.employeeId) || undefined,
    search: first(params.search)?.trim() || undefined,
  };
  const printing = first(params.print) === "1";
  const ownerId = readOwnerId(user);
  const result = await Promise.all([
    getManualWorkReportData(
      ownerId,
      filters,
      printing
        ? undefined
        : pageRequest(first(params.page), first(params.size)),
    ),
    getPhotoLimits(),
  ]).catch(() => null);
  if (!result)
    return (
      <DataLoadError message="Data laporan pekerjaan harian gagal dimuat." />
    );
  const [data, photoLimits] = result;
  const periodLabel = `${formatDateHuman(`${from}T12:00:00`, "d MMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMM yyyy")}`;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total pekerjaan"
          value={data.totals.total}
          suffix="pekerjaan"
          icon={Hammer}
          helper={`${data.totals.completed} selesai · ${data.totals.cancelled} dibatalkan`}
          tone="primary"
        />
        <StatCard
          label="Masih aktif"
          value={data.totals.active}
          suffix="pekerjaan"
          icon={Clock3}
          helper={`${data.totals.notStarted} belum mulai · ${data.totals.inProgress} dikerjakan`}
          tone="info"
        />
        <StatCard
          label="Terlambat"
          value={data.totals.overdue}
          suffix="pekerjaan"
          icon={TriangleAlert}
          helper="Melewati target selesai"
          tone={data.totals.overdue > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Dokumentasi"
          value={data.totals.photos}
          suffix="foto"
          icon={Camera}
          helper={`${data.totals.workers} pekerja terlibat`}
          tone="info"
        />
      </div>
      <Frame>
        <FrameHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle className="max-md:sr-only">
              Rincian pekerjaan harian
            </FrameTitle>
            <FrameDescription className="text-xs">
              {data.totals.total} baris data berdasarkan tanggal mulai.
            </FrameDescription>
          </div>
          <Badge variant="outline">{periodLabel}</Badge>
        </FrameHeader>
        {data.rows.length === 0 ? (
          <FramePanel>
            <EmptyState
              icon={FileBarChart2}
              title="Belum ada pekerjaan harian pada periode ini"
              description="Ubah rentang tanggal atau filter. Pekerjaan dihitung berdasarkan tanggal mulai, termasuk yang berlangsung beberapa hari."
              action={
                <Button
                  nativeButton={false}
                  render={<Link href="/laporan?tab=pekerjaan" />}
                >
                  <RotateCcw aria-hidden="true" />
                  Ubah filter
                </Button>
              }
            />
          </FramePanel>
        ) : (
          <FramePanel className="p-0">
            <ManualWorkReportGrid
              key={JSON.stringify(filters)}
              rows={data.rows}
              total={data.total}
              pagination={
                data.pagination ?? {
                  pageIndex: 0,
                  pageSize: Math.max(10, data.total),
                }
              }
              printRows={printing ? data.rows : undefined}
              photoLimit={photoLimits.workPhotos}
            />
          </FramePanel>
        )}
        <FrameFooter className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-1.5">
            <Hammer className="size-3.5 shrink-0" aria-hidden="true" />
            {data.totals.active} aktif · {data.totals.overdue} terlambat
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
            {data.totals.completed} selesai · {data.totals.photos} foto
          </span>
        </FrameFooter>
      </Frame>
    </div>
  );
}
