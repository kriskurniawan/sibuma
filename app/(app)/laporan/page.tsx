import Link from "next/link";
import { pageRequest } from "@/lib/pagination";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  FileBarChart2,
  RotateCcw,
  Search,
  UsersRound,
} from "lucide-react";
import { ReportDataGrid } from "@/components/reports/report-data-grid";
import { ReportDateFilters } from "@/components/reports/report-date-filters";
import { ReportPrintButton } from "@/components/reports/report-print-button";
import { ChecklistReportScreen } from "@/components/reports/checklist-report-screen";
import { FollowUpReportScreen } from "@/components/reports/follow-up-report-screen";
import { isSuperAdmin } from "@/lib/access";
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
  PageHeader,
  ProgressBar,
  StatCard,
} from "@/components/ui";
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
import { getCurrentUser } from "@/lib/auth";
import {
  getReportData,
  getReportOptions,
  type ReportFilters,
} from "@/lib/queries";
import {
  currentMonthRange,
  durationLabel,
  formatDateHuman,
} from "@/lib/time";

export const metadata = {
  title: "Laporan & rekap",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "atasan" && !isSuperAdmin(user)) redirect("/riwayat");

  const params = await searchParams;
  const tab = first(params.tab);
  if (tab === "checklist") {
    return <ChecklistReportScreen user={user} params={params} />;
  }
  if (tab === "tindak-lanjut") {
    return <FollowUpReportScreen user={user} params={params} />;
  }

  const fallback = currentMonthRange();
  let from = first(params.from) ?? fallback.from;
  let to = first(params.to) ?? fallback.to;
  if (!DATE_PATTERN.test(from)) from = fallback.from;
  if (!DATE_PATTERN.test(to)) to = fallback.to;
  if (from > to) [from, to] = [to, from];

  const filters: ReportFilters = {
    from,
    to,
    employeeId: first(params.employeeId) || undefined,
    spklId: first(params.spklId) || undefined,
    search: first(params.search)?.trim() || undefined,
  };

  const printing = first(params.print) === "1";
  const ownerId = isSuperAdmin(user) ? null : user.id;
  const [data, options] = await Promise.all([
    getReportData(ownerId, filters, printing ? undefined : pageRequest(first(params.page), first(params.size))),
    getReportOptions(ownerId),
  ]);

  const exportParams = new URLSearchParams({ from, to });
  if (filters.employeeId) exportParams.set("employeeId", filters.employeeId);
  if (filters.spklId) exportParams.set("spklId", filters.spklId);
  if (filters.search) exportParams.set("search", filters.search);

  const periodLabel = `${formatDateHuman(`${from}T12:00:00`, "d MMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMM yyyy")}`;
  const isFiltered = Boolean(
    filters.employeeId || filters.spklId || filters.search,
  );
  const maxEmployeeMinutes = Math.max(
    1,
    ...data.summaries.map((summary) => summary.totalMinutes),
  );
  const attendanceRate =
    data.totals.sessions === 0
      ? 0
      : Math.round((data.totals.present / data.totals.sessions) * 100);

  const employeeItems: Record<string, string> = {
    "": "Semua pekerja",
    ...Object.fromEntries(
      options.employees.map((employee) => [employee.id, employee.name]),
    ),
  };
  const spklItems: Record<string, string> = {
    "": "Semua SPKL",
    ...Object.fromEntries(
      options.spkls.map((spkl) => [spkl.id, `${spkl.number} · ${spkl.title}`]),
    ),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <PageHeader
          eyebrow={isSuperAdmin(user) ? "Rekap organisasi" : "Rekap tim"}
          title="Laporan lembur."
          description={
            isSuperAdmin(user)
              ? "Tinjau kehadiran, durasi, dokumentasi, dan koreksi seluruh tim. Unduh CSV untuk penggajian atau cetak PDF untuk arsip."
              : "Tinjau kehadiran, durasi, dokumentasi, dan koreksi anggota tim. Unduh CSV untuk penggajian atau cetak PDF untuk arsip."
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={`/api/reports/export?${exportParams.toString()}`}
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
          Rekap lembur {periodLabel}
        </h1>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          Atasan: {isSuperAdmin(user) ? "Super admin" : user.name} · Dicetak{" "}
          {formatDateHuman(new Date().toISOString(), "d MMMM yyyy, HH:mm")} WIB
        </p>
      </div>

      <Frame className="no-print">
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Rentang &amp; filter</FrameTitle>
            <FrameDescription className="text-xs">
              Default bulan berjalan. Semua tanggal dalam WIB.
            </FrameDescription>
          </div>
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/laporan" />}
            >
              <RotateCcw aria-hidden="true" />
              Reset filter
            </Button>
          )}
        </FrameHeader>

        <FramePanel>
          <form
            method="get"
            aria-label="Filter laporan"
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
              <ReportDateFilters
                key={`${from}-${to}`}
                from={from}
                to={to}
              />
              <div className="flex flex-col gap-2 xl:col-span-2">
                <Label htmlFor="employeeId">Pekerja</Label>
                <Select
                  name="employeeId"
                  defaultValue={filters.employeeId ?? ""}
                  items={employeeItems}
                >
                  <SelectTrigger id="employeeId" className="w-full">
                    <SelectValue placeholder="Semua pekerja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Semua pekerja</SelectItem>
                    {options.employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 xl:col-span-3">
                <Label htmlFor="spklId">SPKL</Label>
                <Select
                  name="spklId"
                  defaultValue={filters.spklId ?? ""}
                  items={spklItems}
                >
                  <SelectTrigger id="spklId" className="w-full">
                    <SelectValue placeholder="Semua SPKL" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Semua SPKL</SelectItem>
                    {options.spkls.map((spkl) => (
                      <SelectItem key={spkl.id} value={spkl.id}>
                        {spkl.number} · {spkl.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-3">
                <Label htmlFor="search">Cari</Label>
                <InputGroup>
                  <InputGroupAddon>
                    <Search aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="search"
                    name="search"
                    defaultValue={filters.search ?? ""}
                    placeholder="Nama pekerja, SPKL, atau nomor…"
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
                {data.totals.sessions} sesi ditemukan pada {periodLabel}.
              </p>
            </div>
          </form>
        </FramePanel>
      </Frame>

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
                {printing ? "Ringkasan per pekerja" : "20 pekerja dengan durasi tertinggi · total mengikuti seluruh filter"}
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
                        tone={
                          summary.absentCount > 0 ? "warning" : "primary"
                        }
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
                <Button nativeButton={false} render={<Link href="/laporan" />}>
                  <RotateCcw aria-hidden="true" />
                  Ubah filter
                </Button>
              }
            />
          </FramePanel>
        ) : (
          <FramePanel className="p-0">
            <ReportDataGrid key={exportParams.toString()} rows={data.rows} total={data.totals.sessions}
              pagination={data.pagination ?? { pageIndex: 0, pageSize: Math.max(10, data.totals.sessions) }}
              printRows={printing ? data.rows : undefined} />
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
