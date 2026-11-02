import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  FileBarChart2,
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
import { ChecklistReportGrid } from "@/components/reports/checklist-report-grid";
import {
  firstReportParam as first,
  reportRange,
  type ReportParams,
} from "@/components/reports/report-shell";
import { checklistReadOwner } from "@/lib/checklist-access";
import { getChecklistReportData } from "@/lib/checklist-report";
import type { ChecklistReportFilters } from "@/lib/checklist-types";
import { pageRequest } from "@/lib/pagination";
import { formatDateHuman } from "@/lib/time";
import type { SessionUser } from "@/lib/types";

/** Only report data suspends. The page owns the shared header and filter shell. */
export async function ChecklistReportScreen({
  user,
  params,
}: {
  user: SessionUser;
  params: ReportParams;
}) {
  const { from, to } = reportRange("checklist", params);
  const filters: ChecklistReportFilters = {
    from,
    to,
    locationId: first(params.locationId) || undefined,
    includeSubLocations: first(params.includeSub) !== "0",
    templateId: first(params.templateId) || undefined,
    status: first(params.status) || undefined,
    search: first(params.search)?.trim() || undefined,
  };
  const printing = first(params.print) === "1";
  const ownerId = checklistReadOwner(user);
  const data = await getChecklistReportData(
    ownerId,
    filters,
    printing ? undefined : pageRequest(first(params.page), first(params.size)),
  ).catch(() => null);
  if (!data)
    return <DataLoadError message="Data laporan checklist gagal dimuat." />;
  const periodLabel = `${formatDateHuman(`${from}T12:00:00`, "d MMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMM yyyy")}`;
  const gridKey = JSON.stringify(filters);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total pemeriksaan"
          value={data.totals.total}
          icon={ClipboardCheck}
          helper={`${data.totals.pending} belum selesai · ${data.totals.overdue} terlambat`}
          tone="primary"
        />
        <StatCard
          label="Selesai"
          value={data.totals.completed}
          suffix="pemeriksaan"
          icon={CheckCircle2}
          helper={`${data.totals.onTime} tepat waktu · ${data.totals.late} terlambat`}
          tone="success"
        />
        <StatCard
          label="Temuan"
          value={data.totals.findings}
          suffix="item"
          icon={TriangleAlert}
          helper="Perlu perhatian atau tidak baik"
          tone={data.totals.findings > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Tindak lanjut"
          value={data.totals.openFollowUps}
          suffix="terbuka"
          icon={FileBarChart2}
          helper="Belum selesai atau dibatalkan"
          tone={data.totals.openFollowUps > 0 ? "warning" : "success"}
        />
      </div>
      <Frame>
        <FrameHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle className="max-md:sr-only">
              Rincian pemeriksaan
            </FrameTitle>
            <FrameDescription className="text-xs">
              {data.totals.total} baris data berdasarkan periode jatuh tempo.
            </FrameDescription>
          </div>
          <Badge variant="outline">{periodLabel}</Badge>
        </FrameHeader>
        {data.rows.length === 0 ? (
          <FramePanel>
            <EmptyState
              icon={FileBarChart2}
              title="Belum ada checklist pada periode ini"
              description="Ubah rentang tanggal atau filter. Checklist yang belum selesai tetap dihitung pada periode jatuh temponya."
              action={
                <Button
                  nativeButton={false}
                  render={<Link href="/laporan?tab=checklist" />}
                >
                  <RotateCcw aria-hidden="true" />
                  Ubah filter
                </Button>
              }
            />
          </FramePanel>
        ) : (
          <FramePanel className="p-0">
            <ChecklistReportGrid
              key={gridKey}
              rows={data.rows}
              total={data.total}
              pagination={
                data.pagination ?? {
                  pageIndex: 0,
                  pageSize: Math.max(10, data.total),
                }
              }
              printRows={printing ? data.rows : undefined}
            />
          </FramePanel>
        )}
        <FrameFooter className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-1.5">
            <ClipboardCheck className="size-3.5 shrink-0" aria-hidden="true" />
            {data.totals.total} pemeriksaan · {data.totals.findings} temuan
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
            {data.totals.completed} selesai · {data.totals.pending} belum
            selesai
          </span>
        </FrameFooter>
      </Frame>
    </div>
  );
}
