import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  FileBarChart2,
  RotateCcw,
  Timer,
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
import { FollowUpReportGrid } from "@/components/reports/follow-up-report-grid";
import {
  firstReportParam as first,
  reportRange,
  type ReportParams,
} from "@/components/reports/report-shell";
import { checklistReadOwner } from "@/lib/checklist-access";
import { getChecklistFollowUpReportData } from "@/lib/checklist-report";
import type { ChecklistReportFilters } from "@/lib/checklist-types";
import { pageRequest } from "@/lib/pagination";
import { formatDateHuman } from "@/lib/time";
import type { SessionUser } from "@/lib/types";

export async function FollowUpReportScreen({
  user,
  params,
}: {
  user: SessionUser;
  params: ReportParams;
}) {
  const { from, to } = reportRange("tindak-lanjut", params);
  const filters: ChecklistReportFilters = {
    from,
    to,
    locationId: first(params.locationId) || undefined,
    includeSubLocations: first(params.includeSub) !== "0",
    status: first(params.status) || undefined,
    search: first(params.search)?.trim() || undefined,
  };
  const printing = first(params.print) === "1";
  const ownerId = checklistReadOwner(user);
  const data = await getChecklistFollowUpReportData(
    ownerId,
    filters,
    printing ? undefined : pageRequest(first(params.page), first(params.size)),
  ).catch(() => null);
  if (!data)
    return <DataLoadError message="Data laporan tindak lanjut gagal dimuat." />;
  const periodLabel = `${formatDateHuman(`${from}T12:00:00`, "d MMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMM yyyy")}`;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total tindak lanjut"
          value={data.totals.total}
          icon={ClipboardCheck}
          helper={`${data.totals.open} belum selesai`}
          tone="primary"
        />
        <StatCard
          label="Belum selesai"
          value={data.totals.open}
          suffix="tindak lanjut"
          icon={Timer}
          helper={`${data.totals.inProgress} sedang diproses`}
          tone="info"
        />
        <StatCard
          label="Terlambat"
          value={data.totals.overdue}
          suffix="tindak lanjut"
          icon={TriangleAlert}
          helper="Melewati deadline"
          tone={data.totals.overdue > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Selesai"
          value={data.totals.done}
          suffix="tindak lanjut"
          icon={CheckCircle2}
          helper={`${data.totals.cancelled} dibatalkan`}
          tone="success"
        />
      </div>
      <Frame>
        <FrameHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle className="max-md:sr-only">
              Rincian tindak lanjut
            </FrameTitle>
            <FrameDescription className="text-xs">
              {data.totals.total} baris data dari pemeriksaan pada periode ini.
            </FrameDescription>
          </div>
          <Badge variant="outline">{periodLabel}</Badge>
        </FrameHeader>
        {data.items.length === 0 ? (
          <FramePanel>
            <EmptyState
              icon={FileBarChart2}
              title="Belum ada tindak lanjut"
              description="Tindak lanjut muncul dari temuan checklist. Ubah rentang tanggal atau filter untuk melihat data lain."
              action={
                <Button
                  nativeButton={false}
                  render={<Link href="/laporan?tab=tindak-lanjut" />}
                >
                  <RotateCcw aria-hidden="true" />
                  Ubah filter
                </Button>
              }
            />
          </FramePanel>
        ) : (
          <FramePanel className="p-0">
            <FollowUpReportGrid
              key={JSON.stringify(filters)}
              rows={data.items}
              total={data.total}
              pagination={
                data.pagination ?? {
                  pageIndex: 0,
                  pageSize: Math.max(10, data.total),
                }
              }
              printRows={printing ? data.items : undefined}
            />
          </FramePanel>
        )}
        <FrameFooter className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-1.5">
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            {data.totals.overdue} melewati deadline
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
            {data.totals.done} selesai · {data.totals.open} belum selesai
          </span>
        </FrameFooter>
      </Frame>
    </div>
  );
}
