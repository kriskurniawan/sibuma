import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileBarChart2,
  FileSpreadsheet,
  RotateCcw,
  Timer,
  TriangleAlert,
} from "lucide-react";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { FollowUpReportGrid } from "@/components/reports/follow-up-report-grid";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { ReportPrintButton } from "@/components/reports/report-print-button";
import { isSuperAdmin } from "@/lib/access";
import {
  getChecklistFollowUpReportData,
  getChecklistReportOptions,
} from "@/lib/checklist-report";
import type { ChecklistReportFilters } from "@/lib/checklist-types";
import { pageRequest } from "@/lib/pagination";
import { currentMonthRange, formatDateHuman } from "@/lib/time";
import type { SessionUser } from "@/lib/types";

type SearchParams = Record<string, string | string[] | undefined>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "aktif", label: "Belum selesai" },
  { value: "terlambat", label: "Terlambat" },
  { value: "terbuka", label: "Terbuka" },
  { value: "diproses", label: "Diproses" },
  { value: "tertunda", label: "Tertunda" },
  { value: "selesai", label: "Selesai" },
  { value: "dibatalkan", label: "Dibatalkan" },
];

const SCOPE_OPTIONS = [
  { value: "1", label: "Termasuk sub-lokasi" },
  { value: "0", label: "Hanya area ini" },
];

export async function FollowUpReportScreen({
  user,
  params,
}: {
  user: SessionUser;
  params: SearchParams;
}) {
  const fallback = currentMonthRange();
  let from = first(params.from) ?? fallback.from;
  let to = first(params.to) ?? fallback.to;
  if (!DATE_PATTERN.test(from)) from = fallback.from;
  if (!DATE_PATTERN.test(to)) to = fallback.to;
  if (from > to) [from, to] = [to, from];

  const filters: ChecklistReportFilters = {
    from,
    to,
    locationId: first(params.locationId) || undefined,
    includeSubLocations: first(params.includeSub) !== "0",
    status: first(params.status) || undefined,
    search: first(params.search)?.trim() || undefined,
  };

  const printing = first(params.print) === "1";
  const ownerId = isSuperAdmin(user) ? null : user.id;
  const [data, options] = await Promise.all([
    getChecklistFollowUpReportData(
      ownerId,
      filters,
      printing
        ? undefined
        : pageRequest(first(params.page), first(params.size)),
    ),
    getChecklistReportOptions(ownerId),
  ]);

  const exportParams = new URLSearchParams({ from, to, kind: "tindak-lanjut" });
  if (filters.locationId) exportParams.set("locationId", filters.locationId);
  exportParams.set("includeSub", filters.includeSubLocations === false ? "0" : "1");
  if (filters.status) exportParams.set("status", filters.status);
  if (filters.search) exportParams.set("search", filters.search);
  const pdfHref = `/api/reports/checklist/export?${new URLSearchParams({ ...Object.fromEntries(exportParams), format: "pdf" }).toString()}`;

  const periodLabel = `${formatDateHuman(`${from}T12:00:00`, "d MMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMM yyyy")}`;
  const isFiltered = Boolean(
    filters.locationId || filters.status || filters.search,
  );

  const locationOptions = [
    { value: "", label: "Semua area" },
    ...options.locations.map((location) => ({
      value: location.id,
      label: location.path,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <PageHeader
          eyebrow="Tindak lanjut"
          title="Laporan tindak lanjut."
          description="Pantau temuan yang belum selesai, deadline, dan PIC berdasarkan periode pemeriksaan. Unduh Excel untuk analisis, CSV untuk integrasi, atau PDF untuk arsip."
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={`/api/reports/checklist/export?${new URLSearchParams({ ...Object.fromEntries(exportParams), format: "xlsx" }).toString()}`}
                  />
                }
              >
                <FileSpreadsheet aria-hidden="true" />
                Unduh Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={`/api/reports/checklist/export?${exportParams.toString()}`}
                  />
                }
              >
                <Download aria-hidden="true" />
                Unduh CSV
              </Button>
              <ReportPrintButton href={pdfHref} />
            </div>
          }
        />
      </div>

      <div className="print-only">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          SIBUMA · Sistem Building Management
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Rekap tindak lanjut {periodLabel}
        </h1>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          Atasan: {isSuperAdmin(user) ? "Super admin" : user.name} · Dicetak{" "}
          {formatDateHuman(new Date().toISOString(), "d MMMM yyyy, HH:mm")} WIB
        </p>
      </div>

      <Frame className="no-print">
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Periode &amp; filter</FrameTitle>
            <FrameDescription className="text-xs">
              Mengikuti periode pemeriksaan sumber. Default bulan berjalan.
            </FrameDescription>
          </div>
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/laporan?tab=tindak-lanjut" />}
            >
              <RotateCcw aria-hidden="true" />
              Reset filter
            </Button>
          )}
        </FrameHeader>

        <FramePanel>
          <ReportFilterBar
            ariaLabel="Filter laporan tindak lanjut"
            from={from}
            to={to}
            search={filters.search ?? ""}
            searchId="follow-up-search"
            searchPlaceholder="Judul, area, template…"
            searchClassName="sm:col-span-2 xl:col-span-2"
            selectFilters={[
              {
                key: "locationId",
                id: "follow-up-location",
                label: "Area",
                value: filters.locationId ?? "",
                placeholder: "Semua area",
                options: locationOptions,
                className: "xl:col-span-2",
              },
              {
                key: "includeSub",
                id: "follow-up-scope",
                label: "Cakupan area",
                value: filters.includeSubLocations === false ? "0" : "1",
                options: SCOPE_OPTIONS,
                className: "xl:col-span-2",
              },
              {
                key: "status",
                id: "follow-up-status",
                label: "Status",
                value: filters.status ?? "",
                placeholder: "Semua status",
                options: STATUS_OPTIONS,
                className: "xl:col-span-2",
              },
            ]}
            summary={
              <p className="text-xs text-muted-foreground">
                {data.total} tindak lanjut pada {periodLabel}.
              </p>
            }
          />
        </FramePanel>
      </Frame>

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
            <FrameTitle>Rincian tindak lanjut</FrameTitle>
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
              key={exportParams.toString()}
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
