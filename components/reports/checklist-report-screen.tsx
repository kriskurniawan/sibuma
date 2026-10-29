import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileBarChart2,
  FileSpreadsheet,
  LayoutList,
  RotateCcw,
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
import {
  Badge,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ChecklistReportGrid } from "@/components/reports/checklist-report-grid";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { ReportPrintButton } from "@/components/reports/report-print-button";
import { isSuperAdmin } from "@/lib/access";
import {
  getChecklistReportData,
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
  { value: "belum_dimulai", label: "Belum dimulai" },
  { value: "berlangsung", label: "Berlangsung" },
  { value: "selesai", label: "Selesai" },
  { value: "dilewati", label: "Dilewati" },
];

const SCOPE_OPTIONS = [
  { value: "1", label: "Termasuk sub-lokasi" },
  { value: "0", label: "Hanya area ini" },
];

export async function ChecklistReportScreen({
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
    templateId: first(params.templateId) || undefined,
    status: first(params.status) || undefined,
    search: first(params.search)?.trim() || undefined,
  };

  const printing = first(params.print) === "1";
  const ownerId = isSuperAdmin(user) ? null : user.id;
  const [data, options] = await Promise.all([
    getChecklistReportData(
      ownerId,
      filters,
      printing
        ? undefined
        : pageRequest(first(params.page), first(params.size)),
    ),
    getChecklistReportOptions(ownerId),
  ]);

  const exportParams = new URLSearchParams({ from, to });
  if (filters.locationId) exportParams.set("locationId", filters.locationId);
  exportParams.set("includeSub", filters.includeSubLocations === false ? "0" : "1");
  if (filters.templateId) exportParams.set("templateId", filters.templateId);
  if (filters.status) exportParams.set("status", filters.status);
  if (filters.search) exportParams.set("search", filters.search);
  const pdfHref = `/api/reports/checklist/export?${new URLSearchParams({ ...Object.fromEntries(exportParams), kind: "rekap", format: "pdf" }).toString()}`;

  const periodLabel = `${formatDateHuman(`${from}T12:00:00`, "d MMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMM yyyy")}`;
  const isFiltered = Boolean(
    filters.locationId || filters.templateId || filters.status || filters.search,
  );

  const locationOptions = [
    { value: "", label: "Semua area" },
    ...options.locations.map((location) => ({
      value: location.id,
      label: location.path,
    })),
  ];
  const templateOptions = [
    { value: "", label: "Semua template" },
    ...options.templates.map((template) => ({
      value: template.id,
      label: template.name,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <PageHeader
          eyebrow="Rekap checklist"
          title="Laporan checklist."
          description="Tinjau pemeriksaan berdasarkan periode jatuh tempo, termasuk checklist yang belum selesai. Unduh Excel berisi rekap dan rincian item, CSV untuk integrasi, atau PDF untuk arsip."
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={`/api/reports/checklist/export?${new URLSearchParams({ ...Object.fromEntries(exportParams), kind: "laporan", format: "xlsx" }).toString()}`}
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
                    href={`/api/reports/checklist/export?${new URLSearchParams({ ...Object.fromEntries(exportParams), kind: "rekap" }).toString()}`}
                  />
                }
              >
                <Download aria-hidden="true" />
                CSV rekap
              </Button>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={`/api/reports/checklist/export?${new URLSearchParams({ ...Object.fromEntries(exportParams), kind: "item" }).toString()}`}
                  />
                }
              >
                <LayoutList aria-hidden="true" />
                CSV item
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
          Rekap checklist {periodLabel}
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
              Berdasarkan tanggal jatuh tempo (occurrence), bukan hanya waktu
              selesai. Default bulan berjalan.
            </FrameDescription>
          </div>
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/laporan?tab=checklist" />}
            >
              <RotateCcw aria-hidden="true" />
              Reset filter
            </Button>
          )}
        </FrameHeader>

        <FramePanel>
          <ReportFilterBar
            ariaLabel="Filter laporan checklist"
            from={from}
            to={to}
            search={filters.search ?? ""}
            searchId="checklist-search"
            searchPlaceholder="Template, area, kategori…"
            searchClassName="sm:col-span-2 xl:col-span-4"
            selectFilters={[
              {
                key: "locationId",
                id: "checklist-location",
                label: "Area",
                value: filters.locationId ?? "",
                placeholder: "Semua area",
                options: locationOptions,
                className: "xl:col-span-2",
              },
              {
                key: "includeSub",
                id: "checklist-scope",
                label: "Cakupan area",
                value: filters.includeSubLocations === false ? "0" : "1",
                options: SCOPE_OPTIONS,
                className: "xl:col-span-2",
              },
              {
                key: "templateId",
                id: "checklist-template",
                label: "Template",
                value: filters.templateId ?? "",
                placeholder: "Semua template",
                options: templateOptions,
                className: "xl:col-span-2",
              },
              {
                key: "status",
                id: "checklist-status",
                label: "Status",
                value: filters.status ?? "",
                placeholder: "Semua status",
                options: STATUS_OPTIONS,
                className: "xl:col-span-2",
              },
            ]}
            summary={
              <p className="text-xs text-muted-foreground">
                {data.total} pemeriksaan pada {periodLabel}.
              </p>
            }
          />
        </FramePanel>
      </Frame>

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
            <FrameTitle>Rincian pemeriksaan</FrameTitle>
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
              key={exportParams.toString()}
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
            {data.totals.completed} selesai · {data.totals.pending} belum selesai
          </span>
        </FrameFooter>
      </Frame>
    </div>
  );
}
