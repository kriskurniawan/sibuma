"use client";

import type { ReactNode } from "react";
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
import { DataLoadError } from "@/components/data-load-error";
import { MobileFab } from "@/components/mobile-fab";
import { useSessionUser } from "@/components/session-user-provider";
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
import { Skeleton } from "@/components/ui/skeleton";
import { isReadOnly } from "@/lib/access";
import type { SessionUser } from "@/lib/types";
import type {
  ManualWorkFilters,
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

export function ManualWorkListRow({
  row,
  photoLimit,
}: {
  row: ManualWorkRow;
  photoLimit: number;
}) {
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
            {row.photoCount}/{photoLimit} foto
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

export function ManualWorkSummary({
  totals,
  error = false,
}: {
  totals?: ManualWorkTotals;
  error?: boolean;
}) {
  const value = (key: keyof ManualWorkTotals) =>
    totals ? totals[key] : error ? "—" : <Skeleton className="h-7 w-12" />;

  return (
    <>
      <MobileSummary
        className="md:hidden"
        items={[
          {
            label: "Aktif",
            value: value("active"),
            icon: Hammer,
            tone: "primary",
            href: "/pekerjaan?status=aktif",
            ariaLabel: "Buka pekerjaan aktif",
          },
          {
            label: "Terlambat",
            value: value("overdue"),
            icon: AlertTriangle,
            tone: (totals?.overdue ?? 0) > 0 ? "destructive" : "neutral",
            href: "/pekerjaan?status=terlambat",
            ariaLabel: "Buka pekerjaan terlambat",
          },
          {
            label: "Belum mulai",
            value: value("notStarted"),
            icon: Clock3,
            tone: (totals?.notStarted ?? 0) > 0 ? "warning" : "neutral",
            href: "/pekerjaan?status=belum_mulai",
            ariaLabel: "Buka pekerjaan belum mulai",
          },
          {
            label: "Selesai bulan ini",
            value: value("completedThisMonth"),
            icon: CheckCircle2,
            tone: "success",
          },
        ]}
      />

      <div className="hidden grid-cols-2 gap-3 md:grid xl:grid-cols-4">
        <StatCard
          label="Pekerjaan aktif"
          value={value("active")}
          suffix="pekerjaan"
          icon={Hammer}
          helper="Terbuka atau sedang dikerjakan"
        />
        <StatCard
          label="Terlambat"
          value={value("overdue")}
          suffix="pekerjaan"
          icon={AlertTriangle}
          tone={(totals?.overdue ?? 0) > 0 ? "destructive" : "neutral"}
          helper="Melewati target selesai"
        />
        <StatCard
          label="Belum mulai"
          value={value("notStarted")}
          suffix="pekerjaan"
          icon={Clock3}
          tone={(totals?.notStarted ?? 0) > 0 ? "warning" : "neutral"}
          helper="Menunggu dikerjakan"
        />
        <StatCard
          label="Selesai bulan ini"
          value={value("completedThisMonth")}
          suffix="pekerjaan"
          icon={CheckCircle2}
          tone="success"
          helper="Dihitung dari waktu penyelesaian"
        />
      </div>
    </>
  );
}

export function ManualWorkPageShell({
  summary,
  children,
  user: snapshot,
}: {
  summary: ReactNode;
  children: ReactNode;
  /** Fresh page user; the layout snapshot is only a loading fallback. */
  user?: SessionUser;
}) {
  const sessionUser = useSessionUser();
  const user = snapshot ?? sessionUser;
  const canManage = !isReadOnly(user) && user.role !== "super_admin";
  const canAssign = user.role === "atasan";
  const label = canAssign ? "Buat pekerjaan" : "Catat pekerjaan";

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        mobileCompact
        eyebrow="Pekerjaan harian"
        title="Pekerjaan Harian"
        description={
          canAssign
            ? "Pekerjaan harian dengan dokumentasi foto dan video. Satu pekerjaan boleh berlangsung beberapa hari."
            : "Pekerjaan lintas divisi dengan dokumentasi foto dan video. Pekerjaan yang kamu catat langsung aktif."
        }
        action={canManage ? (
          <div className="hidden md:block">
            <Button size="sm" nativeButton={false} render={<Link href="/pekerjaan/baru" />}>
              <Plus aria-hidden="true" />
              {label}
            </Button>
          </div>
        ) : undefined}
      />
      {summary}
      {children}
      {canManage && (
        <MobileFab href="/pekerjaan/baru">
          <Plus aria-hidden="true" />
          {label}
        </MobileFab>
      )}
    </div>
  );
}

/** The same chrome wraps streamed data and the route loading fallback. */
export function ManualWorkListFrame({
  description,
  controls,
  children,
  footer,
}: {
  description: ReactNode;
  controls: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Frame>
      <FrameHeader className="flex flex-row flex-wrap items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <FrameTitle>Daftar pekerjaan</FrameTitle>
          <FrameDescription className="text-xs">{description}</FrameDescription>
        </div>
      </FrameHeader>
      <FramePanel>{controls}</FramePanel>
      {children}
      {footer}
    </Frame>
  );
}

export function ManualWorkListDescription({
  total,
  totals,
  filters,
}: {
  total: number;
  totals: ManualWorkTotals;
  filters: Required<ManualWorkFilters>;
}) {
  return filters.status === "semua"
    ? totals.active > 0
      ? `${total} pekerjaan, ${totals.active} aktif.`
      : `${total} pekerjaan.`
    : `${total} pekerjaan sesuai filter.`;
}

export function ManualWorkListContent({
  items,
  filters,
  photoLimit,
  user: snapshot,
}: {
  items: ManualWorkRow[];
  filters: Required<ManualWorkFilters>;
  photoLimit: number;
  /** Fresh page user; the layout snapshot is only a loading fallback. */
  user?: SessionUser;
}) {
  const sessionUser = useSessionUser();
  const user = snapshot ?? sessionUser;
  const readOnly = isReadOnly(user);
  const canManage = !readOnly && user.role !== "super_admin";
  const canAssign = user.role === "atasan";
  const filtered = filters.status !== "semua" || filters.search.length > 0 ||
    Boolean(filters.divisionId) || Boolean(filters.employeeId);

  return (
    <FramePanel className="p-0">
      {items.length === 0 ? (
        <EmptyState
          icon={filtered ? Hammer : ListChecks}
          title={filtered ? "Tidak ada pekerjaan yang cocok" : "Belum ada pekerjaan"}
          description={filtered
            ? "Ubah kata kunci atau filter status, divisi, dan pekerja untuk melihat pekerjaan lain."
            : canManage
              ? canAssign
                ? "Buat pekerjaan harian dengan dokumentasi foto dan video."
                : "Catat pekerjaan yang kamu dan tim kerjakan; catatan langsung aktif."
              : "Belum ada pekerjaan harian."}
          action={filtered ? (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/pekerjaan" />}>
              <RefreshCw aria-hidden="true" />
              Reset filter
            </Button>
          ) : canManage ? (
            <div className="max-md:hidden">
              <Button size="sm" nativeButton={false} render={<Link href="/pekerjaan/baru" />}>
                <Plus aria-hidden="true" />
                {canAssign ? "Buat pekerjaan" : "Catat pekerjaan"}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/pekerjaan" />}>
              <RefreshCw aria-hidden="true" />
              Muat ulang
            </Button>
          )}
        />
      ) : (
        <div className="divide-y divide-border/70">
          {items.map((row) => <ManualWorkListRow key={row.work.id} row={row} photoLimit={photoLimit} />)}
        </div>
      )}
    </FramePanel>
  );
}

export function ManualWorkListFooter({
  total,
  pagination,
}: {
  total: number;
  pagination?: PageRequest;
}) {
  return pagination && total > pagination.pageSize ? (
    <FrameFooter>
      <ManualWorkPagination page={pagination.pageIndex} pageSize={pagination.pageSize} total={total} />
    </FrameFooter>
  ) : null;
}

export function ManualWorkSummaryError() {
  return (
    <div className="flex flex-col gap-3">
      <ManualWorkSummary error />
      <DataLoadError message="Ringkasan pekerjaan gagal dimuat." />
    </div>
  );
}
