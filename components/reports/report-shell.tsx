import Link from "next/link";
import type { ReactNode } from "react";
import { Download, FileSpreadsheet, LayoutList, RotateCcw } from "lucide-react";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ReportFilterBar,
  type ReportFilterSelect,
} from "@/components/reports/report-filter-bar";
import { ReportPrintButton } from "@/components/reports/report-print-button";
import { isSuperAdmin } from "@/lib/access";
import {
  currentOvertimePeriodLabel,
  currentOvertimePeriodRange,
} from "@/lib/active-overtime-period";
import {
  overtimePeriodLabel,
  overtimePeriodRange,
} from "@/lib/overtime-period";
import {
  currentMonthRange,
  currentTimeZoneLabel,
  formatDateHuman,
} from "@/lib/time";
import type { SessionUser } from "@/lib/types";

export type ReportTab = "checklist" | "tindak-lanjut" | "pekerjaan" | "lembur";
export type ReportParams = Record<string, string | string[] | undefined>;
export function firstReportParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
export function reportTab(params: ReportParams): ReportTab {
  const value = firstReportParam(params.tab);
  return value === "tindak-lanjut" ||
    value === "pekerjaan" ||
    value === "lembur"
    ? value
    : "checklist";
}
export function reportRange(
  tab: ReportTab,
  params: ReportParams,
  overtimePeriodStartDay?: number,
) {
  const fallback =
    tab === "lembur"
      ? overtimePeriodStartDay === undefined
        ? currentOvertimePeriodRange()
        : overtimePeriodRange(new Date(), overtimePeriodStartDay)
      : currentMonthRange();
  let from = firstReportParam(params.from) ?? fallback.from;
  let to = firstReportParam(params.to) ?? fallback.to;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) from = fallback.from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) to = fallback.to;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

const TITLES: Record<ReportTab, string> = {
  checklist: "Laporan checklist.",
  "tindak-lanjut": "Laporan tindak lanjut.",
  pekerjaan: "Laporan pekerjaan harian.",
  lembur: "Laporan lembur.",
};
const STATUS_OPTIONS: Record<
  Exclude<ReportTab, "lembur">,
  { value: string; label: string }[]
> = {
  checklist: [
    { value: "", label: "Semua status" },
    { value: "aktif", label: "Belum selesai" },
    { value: "terlambat", label: "Terlambat" },
    { value: "belum_dimulai", label: "Belum diisi" },
    { value: "berlangsung", label: "Berlangsung" },
    { value: "selesai", label: "Selesai" },
    { value: "dilewati", label: "Dilewati" },
  ],
  "tindak-lanjut": [
    { value: "", label: "Semua status" },
    { value: "aktif", label: "Belum selesai" },
    { value: "terlambat", label: "Terlambat" },
    { value: "terbuka", label: "Terbuka" },
    { value: "diproses", label: "Diproses" },
    { value: "tertunda", label: "Tertunda" },
    { value: "selesai", label: "Selesai" },
    { value: "dibatalkan", label: "Dibatalkan" },
  ],
  pekerjaan: [
    { value: "", label: "Semua status" },
    { value: "aktif", label: "Masih aktif" },
    { value: "terlambat", label: "Terlambat" },
    { value: "terbuka", label: "Terbuka" },
    { value: "dikerjakan", label: "Dikerjakan" },
    { value: "selesai", label: "Selesai" },
    { value: "dibatalkan", label: "Dibatalkan" },
  ],
};

export function ReportOptionSkeleton({ tab }: { tab: ReportTab }) {
  const widths =
    tab === "lembur"
      ? ["xl:w-44", "xl:w-56"]
      : tab === "tindak-lanjut"
        ? ["xl:w-44"]
        : ["xl:w-44", tab === "checklist" ? "xl:w-48" : "xl:w-44"];
  return (
    <div
      role="status"
      aria-label="Memuat pilihan filter"
      className="contents"
    >
      {widths.map((width, index) => (
        <Skeleton key={index} className={`h-8 w-full ${width}`} />
      ))}
    </div>
  );
}

/** Shared by the server page and its route fallback; no report query is awaited here. */
export function ReportShell({
  tab,
  user,
  params,
  optionFilters,
  printedAt,
  overtimePeriodStartDay,
  children,
}: {
  tab: ReportTab;
  user: SessionUser;
  params: ReportParams;
  optionFilters: ReactNode;
  printedAt?: string;
  overtimePeriodStartDay?: number;
  children: ReactNode;
}) {
  const { from, to } = reportRange(tab, params, overtimePeriodStartDay);
  const search = firstReportParam(params.search)?.trim() ?? "";
  const locationId = firstReportParam(params.locationId) ?? "";
  const periodLabel = `${formatDateHuman(`${from}T12:00:00`, "d MMM yyyy")} – ${formatDateHuman(`${to}T12:00:00`, "d MMM yyyy")}`;
  const exportParams = new URLSearchParams({ from, to });
  const filterKeys =
    tab === "lembur"
      ? ["employeeId", "spklId"]
      : tab === "checklist"
        ? ["locationId", "templateId", "status"]
        : tab === "pekerjaan"
          ? ["locationId", "employeeId", "status"]
          : ["locationId", "status"];
  for (const key of [...filterKeys, "search"]) {
    const value = key === "search" ? search : firstReportParam(params[key]);
    if (value) exportParams.set(key, value);
  }
  const dateFiltered =
    Boolean(firstReportParam(params.from)) ||
    Boolean(firstReportParam(params.to));
  const includeSubFiltered =
    Boolean(locationId) && firstReportParam(params.includeSub) === "0";
  const activeFilterCount =
    (dateFiltered ? 1 : 0) +
    filterKeys.reduce(
      (count, key) => count + (firstReportParam(params[key]) ? 1 : 0),
      0,
    ) +
    (includeSubFiltered ? 1 : 0);
  const hasFilters = Boolean(search) || activeFilterCount > 0;
  const resetHref = `/laporan?tab=${tab}`;
  if (tab !== "lembur")
    exportParams.set(
      "includeSub",
      firstReportParam(params.includeSub) === "0" ? "0" : "1",
    );
  if (tab === "tindak-lanjut") exportParams.set("kind", "tindak-lanjut");
  const endpoint =
    tab === "lembur"
      ? "/api/reports/export"
      : tab === "pekerjaan"
        ? "/api/reports/pekerjaan/export"
        : "/api/reports/checklist/export";
  const exportHref = (format?: string, kind?: string) => {
    const query = new URLSearchParams(exportParams);
    if (format) query.set("format", format);
    if (kind) query.set("kind", kind);
    return `${endpoint}?${query}`;
  };
  const staticFilters: ReportFilterSelect[] = [];
  if (tab !== "lembur") {
    if (locationId)
      staticFilters.push({
        key: "includeSub",
        id: `${tab}-scope`,
        label: "Cakupan area",
        value: firstReportParam(params.includeSub) === "0" ? "0" : "1",
        options: [
          { value: "1", label: "Termasuk sub-lokasi" },
          { value: "0", label: "Hanya area ini" },
        ],
        className: "sm:w-44",
      });
    staticFilters.push({
      key: "status",
      id: `${tab}-status`,
      label: "Status",
      value: firstReportParam(params.status) ?? "",
      placeholder: "Semua status",
      options: STATUS_OPTIONS[tab],
      className: "sm:w-40",
    });
  }
  const description =
    tab === "checklist"
      ? "Tinjau pemeriksaan berdasarkan periode jatuh tempo, termasuk checklist yang belum selesai. Unduh Excel berisi rekap dan rincian item, CSV untuk integrasi, atau PDF untuk arsip."
      : tab === "tindak-lanjut"
        ? "Pantau temuan yang belum selesai, deadline, dan PIC berdasarkan periode pemeriksaan. Unduh Excel untuk analisis, CSV untuk integrasi, atau PDF untuk arsip."
        : tab === "pekerjaan"
          ? `Tinjau pekerjaan harian ${isSuperAdmin(user) ? "seluruh tim" : "tim"} berdasarkan tanggal mulai, termasuk pekerja yang terlibat dan dokumentasi foto. Unduh Excel untuk rekap, CSV untuk integrasi, atau PDF untuk arsip.`
          : `Tinjau kehadiran, durasi, dokumentasi, dan koreksi ${isSuperAdmin(user) ? "seluruh tim" : "anggota tim"}. Unduh Excel untuk penggajian, CSV untuk integrasi, atau PDF untuk arsip.`;
  const defaultOvertimePeriodLabel =
    overtimePeriodStartDay === undefined
      ? currentOvertimePeriodLabel()
      : overtimePeriodLabel(
          overtimePeriodRange(new Date(), overtimePeriodStartDay),
        );
  const filterDescription =
    tab === "checklist"
      ? "Berdasarkan tanggal jatuh tempo (occurrence), bukan hanya waktu selesai. Default bulan berjalan."
      : tab === "tindak-lanjut"
        ? "Mengikuti periode pemeriksaan sumber. Default bulan berjalan."
        : tab === "pekerjaan"
          ? "Berdasarkan tanggal mulai pekerjaan. Default bulan berjalan."
          : `Default periode akumulasi lembur berjalan (${defaultOvertimePeriodLabel}). Semua tanggal dalam ${currentTimeZoneLabel()}.`;
  const searchLabel =
    tab === "checklist"
      ? "Cari laporan checklist"
      : tab === "tindak-lanjut"
        ? "Cari laporan tindak lanjut"
        : tab === "pekerjaan"
          ? "Cari laporan pekerjaan harian"
          : "Cari laporan lembur";
  const searchPlaceholder =
    tab === "checklist"
      ? "Template, area, kategori…"
      : tab === "tindak-lanjut"
        ? "Judul, area, template…"
        : tab === "pekerjaan"
          ? "Judul, lokasi, pekerja…"
          : "Nama pekerja, SPKL, atau nomor…";
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="no-print">
        <PageHeader
          mobileCompact
          eyebrow={
            tab === "checklist"
              ? "Rekap checklist"
              : tab === "tindak-lanjut"
                ? "Tindak lanjut"
                : isSuperAdmin(user)
                  ? "Rekap organisasi"
                  : tab === "lembur"
                    ? "Rekap tim"
                    : "Rekap pekerjaan"
          }
          title={TITLES[tab]}
          description={description}
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={exportHref(
                      "xlsx",
                      tab === "checklist" ? "laporan" : undefined,
                    )}
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
                    href={exportHref(
                      undefined,
                      tab === "checklist" ? "rekap" : undefined,
                    )}
                  />
                }
              >
                <Download aria-hidden="true" />
                {tab === "checklist" ? "CSV rekap" : "Unduh CSV"}
              </Button>
              {tab === "checklist" && (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={exportHref(undefined, "item")} />}
                >
                  <LayoutList aria-hidden="true" />
                  CSV item
                </Button>
              )}
              <ReportPrintButton
                href={exportHref(
                  "pdf",
                  tab === "checklist" ? "rekap" : undefined,
                )}
              />
            </div>
          }
        />
      </div>
      <div className="print-only">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          SIBUMA · Sistem Building Management
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {TITLES[tab].replace(/\.$/, "")} {periodLabel}
        </h1>
        <p className="text-xs font-medium text-muted-foreground">
          Atasan: {isSuperAdmin(user) ? "Super admin" : user.name} · Dicetak{" "}
          {printedAt ? formatDateHuman(printedAt, "d MMMM yyyy, HH:mm") : "—"}{" "}
          {currentTimeZoneLabel()}
        </p>
      </div>
      <Frame className="no-print">
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle className="max-md:sr-only">
              Periode &amp; filter
            </FrameTitle>
            <FrameDescription className="text-xs">
              {filterDescription}
            </FrameDescription>
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={resetHref} />}
            >
              <RotateCcw aria-hidden="true" />
              Reset filter
            </Button>
          )}
        </FrameHeader>
        <FramePanel>
          <ReportFilterBar
            ariaLabel={`Filter ${TITLES[tab].toLowerCase().replace(/\.$/, "")}`}
            from={from}
            to={to}
            search={search}
            searchId={`${tab}-search`}
            searchLabel={searchLabel}
            searchPlaceholder={searchPlaceholder}
            selectFilters={staticFilters}
            selectContent={optionFilters}
            summary={periodLabel}
            activeCount={activeFilterCount}
            resetHref={resetHref}
          />
        </FramePanel>
      </Frame>
      {children}
    </div>
  );
}
