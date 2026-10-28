import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileBarChart2,
  RotateCcw,
  Search,
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FollowUpReportGrid } from "@/components/reports/follow-up-report-grid";
import { ReportDateFilters } from "@/components/reports/report-date-filters";
import { ReportPrintButton } from "@/components/reports/report-print-button";
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

const STATUS_ITEMS: Record<string, string> = {
  "": "Semua status",
  aktif: "Belum selesai",
  terlambat: "Terlambat",
  terbuka: "Terbuka",
  diproses: "Diproses",
  tertunda: "Tertunda",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

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
    status: first(params.status) || undefined,
    search: first(params.search)?.trim() || undefined,
  };

  const printing = first(params.print) === "1";
  const [data, options] = await Promise.all([
    getChecklistFollowUpReportData(
      user.id,
      filters,
      printing
        ? undefined
        : pageRequest(first(params.page), first(params.size)),
    ),
    getChecklistReportOptions(user.id),
  ]);

  const exportParams = new URLSearchParams({ from, to, kind: "tindak-lanjut" });
  if (filters.locationId) exportParams.set("locationId", filters.locationId);
  if (filters.status) exportParams.set("status", filters.status);
  if (filters.search) exportParams.set("search", filters.search);

  const periodLabel = `${formatDateHuman(`${from}T12:00:00`, "d MMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMM yyyy")}`;
  const isFiltered = Boolean(
    filters.locationId || filters.status || filters.search,
  );

  const locationItems: Record<string, string> = {
    "": "Semua area",
    ...Object.fromEntries(
      options.locations.map((location) => [location.id, location.name]),
    ),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <PageHeader
          eyebrow="Tindak lanjut"
          title="Laporan tindak lanjut."
          description="Pantau temuan yang belum selesai, tenggat, dan PIC berdasarkan periode pemeriksaan. Unduh CSV atau cetak untuk arsip."
          action={
            <div className="flex flex-wrap gap-2">
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
              <ReportPrintButton />
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
          Atasan: {user.name} · Dicetak{" "}
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
          <form
            method="get"
            aria-label="Filter laporan tindak lanjut"
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="tab" value="tindak-lanjut" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
              <ReportDateFilters key={`${from}-${to}`} from={from} to={to} />
              <div className="flex flex-col gap-2 xl:col-span-3">
                <Label htmlFor="follow-up-location">Area</Label>
                <Select
                  name="locationId"
                  defaultValue={filters.locationId ?? ""}
                  items={locationItems}
                >
                  <SelectTrigger id="follow-up-location" className="w-full">
                    <SelectValue placeholder="Semua area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Semua area</SelectItem>
                    {options.locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 xl:col-span-2">
                <Label htmlFor="follow-up-status">Status</Label>
                <Select
                  name="status"
                  defaultValue={filters.status ?? ""}
                  items={STATUS_ITEMS}
                >
                  <SelectTrigger id="follow-up-status" className="w-full">
                    <SelectValue placeholder="Semua status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Semua status</SelectItem>
                    <SelectItem value="aktif">Belum selesai</SelectItem>
                    <SelectItem value="terlambat">Terlambat</SelectItem>
                    <SelectItem value="terbuka">Terbuka</SelectItem>
                    <SelectItem value="diproses">Diproses</SelectItem>
                    <SelectItem value="tertunda">Tertunda</SelectItem>
                    <SelectItem value="selesai">Selesai</SelectItem>
                    <SelectItem value="dibatalkan">Dibatalkan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-3">
                <Label htmlFor="follow-up-search">Cari</Label>
                <InputGroup>
                  <InputGroupAddon>
                    <Search aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="follow-up-search"
                    name="search"
                    defaultValue={filters.search ?? ""}
                    placeholder="Judul, area, template…"
                  />
                </InputGroup>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">
                <BarChart3 aria-hidden="true" />
                Terapkan filter
              </Button>
              <p className="text-xs text-muted-foreground">
                {data.total} tindak lanjut pada {periodLabel}.
              </p>
            </div>
          </form>
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
          helper="Melewati tenggat"
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
            {data.totals.overdue} melewati tenggat
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
