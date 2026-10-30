import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  FileBarChart2,
  FileSpreadsheet,
  Hammer,
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
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ManualWorkReportGrid } from "@/components/reports/manual-work-report-grid";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { ReportPrintButton } from "@/components/reports/report-print-button";
import { isSuperAdmin } from "@/lib/access";
import {
  getManualWorkReportData,
  getManualWorkReportOptions,
} from "@/lib/manual-work-report";
import type { ManualWorkReportFilters } from "@/lib/manual-work-types";
import { pageRequest } from "@/lib/pagination";
import { getPhotoLimits } from "@/lib/photo-limits";
import { currentMonthRange, formatDateHuman } from "@/lib/time";
import type { SessionUser } from "@/lib/types";

type SearchParams = Record<string, string | string[] | undefined>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "aktif", label: "Masih aktif" },
  { value: "terlambat", label: "Terlambat" },
  { value: "terbuka", label: "Terbuka" },
  { value: "dikerjakan", label: "Dikerjakan" },
  { value: "selesai", label: "Selesai" },
  { value: "dibatalkan", label: "Dibatalkan" },
];

const SCOPE_OPTIONS = [
  { value: "1", label: "Termasuk sub-lokasi" },
  { value: "0", label: "Hanya area ini" },
];

export async function ManualWorkReportScreen({
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
  const ownerId = isSuperAdmin(user) ? null : user.id;
  const [data, options, photoLimits] = await Promise.all([
    getManualWorkReportData(
      ownerId,
      filters,
      printing
        ? undefined
        : pageRequest(first(params.page), first(params.size)),
    ),
    getManualWorkReportOptions(ownerId),
    getPhotoLimits(),
  ]);

  const exportParams = new URLSearchParams({ from, to });
  if (filters.locationId) exportParams.set("locationId", filters.locationId);
  exportParams.set(
    "includeSub",
    filters.includeSubLocations === false ? "0" : "1",
  );
  if (filters.status) exportParams.set("status", filters.status);
  if (filters.employeeId) exportParams.set("employeeId", filters.employeeId);
  if (filters.search) exportParams.set("search", filters.search);
  const pdfHref = `/api/reports/pekerjaan/export?${new URLSearchParams({ ...Object.fromEntries(exportParams), format: "pdf" }).toString()}`;

  const periodLabel = `${formatDateHuman(`${from}T12:00:00`, "d MMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMM yyyy")}`;
  const isFiltered = Boolean(
    filters.locationId ||
      filters.status ||
      filters.employeeId ||
      filters.search,
  );

  const locationOptions = [
    { value: "", label: "Semua area" },
    ...options.locations.map((location) => ({
      value: location.id,
      label: location.path,
    })),
  ];
  const employeeOptions = [
    { value: "", label: "Semua pekerja" },
    ...options.employees.map((employee) => ({
      value: employee.id,
      label: employee.name,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <PageHeader
          eyebrow={isSuperAdmin(user) ? "Rekap organisasi" : "Rekap pekerjaan"}
          title="Laporan pekerjaan harian."
          description={
            isSuperAdmin(user)
              ? "Tinjau pekerjaan harian seluruh tim berdasarkan tanggal mulai, termasuk pekerja yang terlibat dan dokumentasi foto. Unduh Excel untuk rekap, CSV untuk integrasi, atau PDF untuk arsip."
              : "Tinjau pekerjaan harian tim berdasarkan tanggal mulai, termasuk pekerja yang terlibat dan dokumentasi foto. Unduh Excel untuk rekap, CSV untuk integrasi, atau PDF untuk arsip."
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={`/api/reports/pekerjaan/export?${new URLSearchParams({ ...Object.fromEntries(exportParams), format: "xlsx" }).toString()}`}
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
                    href={`/api/reports/pekerjaan/export?${exportParams.toString()}`}
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
          Rekap pekerjaan harian {periodLabel}
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
              Berdasarkan tanggal mulai pekerjaan. Default bulan berjalan.
            </FrameDescription>
          </div>
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/laporan?tab=pekerjaan" />}
            >
              <RotateCcw aria-hidden="true" />
              Reset filter
            </Button>
          )}
        </FrameHeader>

        <FramePanel>
          <ReportFilterBar
            ariaLabel="Filter laporan pekerjaan harian"
            from={from}
            to={to}
            search={filters.search ?? ""}
            searchId="pekerjaan-search"
            searchPlaceholder="Judul, lokasi, pekerja…"
            searchClassName="sm:col-span-2 xl:col-span-4"
            selectFilters={[
              {
                key: "locationId",
                id: "pekerjaan-location",
                label: "Area",
                value: filters.locationId ?? "",
                placeholder: "Semua area",
                options: locationOptions,
                className: "xl:col-span-2",
              },
              {
                key: "includeSub",
                id: "pekerjaan-scope",
                label: "Cakupan area",
                value: filters.includeSubLocations === false ? "0" : "1",
                options: SCOPE_OPTIONS,
                className: "xl:col-span-2",
              },
              {
                key: "employeeId",
                id: "pekerjaan-employee",
                label: "Pekerja",
                value: filters.employeeId ?? "",
                placeholder: "Semua pekerja",
                options: employeeOptions,
                className: "xl:col-span-2",
              },
              {
                key: "status",
                id: "pekerjaan-status",
                label: "Status",
                value: filters.status ?? "",
                placeholder: "Semua status",
                options: STATUS_OPTIONS,
                className: "xl:col-span-2",
              },
            ]}
            summary={
              <p className="text-xs text-muted-foreground">
                {data.total} pekerjaan pada {periodLabel}.
              </p>
            }
          />
        </FramePanel>
      </Frame>

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
            <FrameTitle>Rincian pekerjaan harian</FrameTitle>
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
