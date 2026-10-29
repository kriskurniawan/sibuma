import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Hammer,
  HardHat,
  ListChecks,
  MapPin,
  Plus,
  RefreshCw,
} from "lucide-react";
import { ManualWorkFilters } from "@/components/pekerjaan/manual-work-filters";
import { ManualWorkPagination } from "@/components/pekerjaan/manual-work-pagination";
import {
  ManualWorkOverdueBadge,
  ManualWorkSelfReportedBadge,
  ManualWorkStatusBadge,
} from "@/components/pekerjaan/manual-work-badges";
import { MobileSummary } from "@/components/mobile-summary";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Avatar, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { MANUAL_WORK_MAX_PHOTOS } from "@/lib/manual-work-types";
import type {
  ManualWorkFilterOptions,
  ManualWorkRow,
  ManualWorkTotals,
} from "@/lib/manual-work-types";
import type { PageRequest } from "@/lib/pagination";
import { formatDateHuman } from "@/lib/time";

function dateIso(value: string) {
  return `${value}T00:00:00+07:00`;
}

function rangeLabel(row: ManualWorkRow) {
  const start = formatDateHuman(dateIso(row.work.startDate), "d MMM");
  if (!row.work.targetDate || row.work.targetDate === row.work.startDate) {
    return `Mulai ${start}`;
  }
  return `${start} – ${formatDateHuman(dateIso(row.work.targetDate), "d MMM")}`;
}

export function ManualWorkListRow({ row }: { row: ManualWorkRow }) {
  const work = row.work;
  const firstAssignee = row.assignees[0];

  return (
    <Link
      href={`/pekerjaan/${work.id}`}
      className="group flex min-w-0 flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-2 text-sm font-medium text-foreground">
            {work.title}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{work.locationName || "Tanpa lokasi"}</span>
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ManualWorkStatusBadge status={work.status} />
          {row.overdue && <ManualWorkOverdueBadge />}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          {rangeLabel(row)}
        </span>
        {work.requiresDocumentation && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Camera className="size-3.5 shrink-0" aria-hidden="true" />
            {row.photoCount}/{MANUAL_WORK_MAX_PHOTOS} foto
          </span>
        )}
        {row.sourceFollowUp && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <ListChecks className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Tindak lanjut</span>
          </span>
        )}
        {work.safetyName && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <HardHat className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Petugas safety {work.safetyName}</span>
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {row.selfReported && <ManualWorkSelfReportedBadge />}
        {firstAssignee ? (
          <>
            <Avatar
              name={firstAssignee.name}
              seed={firstAssignee.id}
              size="xs"
            />
            <span className="truncate">
              {firstAssignee.name}
              {row.assignees.length > 1
                ? ` +${row.assignees.length - 1} pekerja`
                : ""}
            </span>
          </>
        ) : (
          <span>Belum ada pekerja</span>
        )}
      </div>
    </Link>
  );
}

export function ManualWorkListView({
  items,
  total,
  totals,
  pagination,
  filters,
  filterOptions,
  canManage,
  canAssign,
  readOnly,
}: {
  items: ManualWorkRow[];
  total: number;
  totals: ManualWorkTotals;
  pagination?: PageRequest;
  filters: {
    status: string;
    search: string;
    divisionId: string;
    employeeId: string;
  };
  filterOptions: ManualWorkFilterOptions;
  canManage: boolean;
  canAssign: boolean;
  readOnly: boolean;
}) {
  const filtered =
    filters.status !== "aktif" ||
    filters.search.length > 0 ||
    Boolean(filters.divisionId) ||
    Boolean(filters.employeeId);

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        eyebrow="Pekerjaan harian"
        title="Pekerjaan Harian"
        description={
          canAssign
            ? "Pekerjaan harian dengan dokumentasi foto. Satu pekerjaan boleh berlangsung beberapa hari."
            : "Pekerjaan yang kamu dan tim kerjakan. Catatan langsung aktif."
        }
        action={
          canManage ? (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/pekerjaan/baru" />}
            >
              <Plus aria-hidden="true" />
              {canAssign ? "Buat pekerjaan" : "Catat pekerjaan"}
            </Button>
          ) : undefined
        }
      />

      <MobileSummary
        className="md:hidden"
        items={[
          {
            label: "Aktif",
            value: totals.active,
            icon: Hammer,
            tone: "primary",
            href: "/pekerjaan?status=aktif",
            ariaLabel: `Buka ${totals.active} pekerjaan aktif`,
          },
          {
            label: "Terlambat",
            value: totals.overdue,
            icon: AlertTriangle,
            tone: totals.overdue > 0 ? "destructive" : "neutral",
            href: "/pekerjaan?status=terlambat",
            ariaLabel: `Buka ${totals.overdue} pekerjaan terlambat`,
          },
          {
            label: "Belum mulai",
            value: totals.notStarted,
            icon: Clock3,
            tone: totals.notStarted > 0 ? "warning" : "neutral",
            href: "/pekerjaan?status=belum_mulai",
            ariaLabel: `Buka ${totals.notStarted} pekerjaan belum mulai`,
          },
          {
            label: "Selesai bulan ini",
            value: totals.completedThisMonth,
            icon: CheckCircle2,
            tone: "success",
          },
        ]}
      />

      <div className="hidden grid-cols-2 gap-3 md:grid xl:grid-cols-4">
        <StatCard
          label="Pekerjaan aktif"
          value={totals.active}
          suffix="pekerjaan"
          icon={Hammer}
          helper="Terbuka atau sedang dikerjakan"
        />
        <StatCard
          label="Terlambat"
          value={totals.overdue}
          suffix="pekerjaan"
          icon={AlertTriangle}
          tone={totals.overdue > 0 ? "destructive" : "neutral"}
          helper="Melewati target selesai"
        />
        <StatCard
          label="Belum mulai"
          value={totals.notStarted}
          suffix="pekerjaan"
          icon={Clock3}
          tone={totals.notStarted > 0 ? "warning" : "neutral"}
          helper="Menunggu dikerjakan"
        />
        <StatCard
          label="Selesai bulan ini"
          value={totals.completedThisMonth}
          suffix="pekerjaan"
          icon={CheckCircle2}
          tone="success"
          helper="Dihitung dari waktu penyelesaian"
        />
      </div>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-end justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Daftar pekerjaan</FrameTitle>
            <FrameDescription className="hidden text-xs md:block">
              {total} pekerjaan sesuai filter.
            </FrameDescription>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums md:hidden">
            {total} hasil
          </span>
        </FrameHeader>

        <FramePanel>
          <ManualWorkFilters
            status={filters.status}
            search={filters.search}
            divisionId={filters.divisionId}
            employeeId={filters.employeeId}
            divisions={filterOptions.divisions}
            workers={filterOptions.workers}
          />
        </FramePanel>

        <FramePanel className="p-0">
          {items.length === 0 ? (
            <EmptyState
              icon={filtered ? Hammer : ListChecks}
              title={
                filtered ? "Tidak ada pekerjaan yang cocok" : "Belum ada pekerjaan"
              }
              description={
                filtered
                  ? "Ubah kata kunci atau filter status, divisi, dan pekerja untuk melihat pekerjaan lain."
                  : canManage
                    ? canAssign
                      ? "Buat pekerjaan harian dengan dokumentasi foto."
                      : "Catat pekerjaan yang kamu dan tim kerjakan; catatan langsung aktif."
                    : readOnly
                      ? "Belum ada pekerjaan harian untuk tim ini."
                      : "Penugasan baru akan muncul di sini."
              }
              action={
                filtered ? (
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/pekerjaan" />}
                  >
                    <RefreshCw aria-hidden="true" />
                    Reset filter
                  </Button>
                ) : canManage ? (
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href="/pekerjaan/baru" />}
                  >
                    <Plus aria-hidden="true" />
                    {canAssign ? "Buat pekerjaan" : "Catat pekerjaan"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/pekerjaan" />}
                  >
                    <RefreshCw aria-hidden="true" />
                    Muat ulang
                  </Button>
                )
              }
            />
          ) : (
            <div className="divide-y divide-border/70">
              {items.map((row) => (
                <ManualWorkListRow key={row.work.id} row={row} />
              ))}
            </div>
          )}
        </FramePanel>

        {pagination && total > pagination.pageSize && (
          <FrameFooter>
            <ManualWorkPagination
              page={pagination.pageIndex}
              pageSize={pagination.pageSize}
              total={total}
            />
          </FrameFooter>
        )}
      </Frame>
    </div>
  );
}
