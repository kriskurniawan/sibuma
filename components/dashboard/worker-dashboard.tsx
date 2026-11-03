import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, CalendarDays, CheckCircle2, ClipboardCheck, ClipboardList, MapPin, Wrench } from "lucide-react";
import { ChecklistAssigneeStack, ChecklistSummaryRow, FollowUpSummaryRow } from "@/components/dashboard/checklist-summary";
import { ManualWorkSummaryContent, manualWorkDescription } from "@/components/dashboard/manual-work-summary";
import { DashboardFocusSectionSkeleton, DashboardQueueSectionSkeleton, OperationalDashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardRegion, DashboardValue, type DashboardChecklists, type DashboardFollowUps, type DashboardManualWorks, type DashboardRequest } from "@/components/dashboard/dashboard-data";
import {
  DashboardRowsSkeleton,
  DashboardStatsSkeleton,
  DashboardSummarySkeleton,
} from "@/components/dashboard/dashboard-skeletons";
import { DataLoadError } from "@/components/data-load-error";
import { MobileSummary } from "@/components/mobile-summary";
import { IconTile } from "@/components/reui/icon-tile";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { ChecklistStatusBadge } from "@/components/checklist/checklist-badges";
import { Badge, EmptyState, ProgressBar, SpklStatusBadge, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkerOverview } from "@/lib/queries";
import { isReadOnly } from "@/lib/access";
import type { SessionUser } from "@/lib/types";
import { checklistHasOpened } from "@/lib/checklist-schedule";
import { currentTimeZoneLabel, formatDateHuman, formatDateTime, formatTime } from "@/lib/time";

/** Fokus dan antrean hanya memuat checklist hari ini yang belum lewat deadline. */
function dashboardChecklistRows(data: DashboardChecklists) {
  return data.items.filter((row) => !row.overdue && !row.locked);
}

function checklistFocus(data: DashboardChecklists) {
  const rows = dashboardChecklistRows(data);
  return rows.find((row) => row.inspection.status === "berlangsung") ?? rows[0] ?? null;
}

export function WorkerDashboard({
  user,
  overview,
  checklists,
  followUps,
  manualWorks,
}: {
  user: SessionUser;
  overview: DashboardRequest<WorkerOverview>;
  checklists: DashboardRequest<DashboardChecklists>;
  followUps: DashboardRequest<DashboardFollowUps>;
  manualWorks: DashboardRequest<DashboardManualWorks>;
}) {
  const readOnly = isReadOnly(user);
  return (
    <OperationalDashboardShell
      user={user}
      focusBlock={
        <Suspense fallback={<DashboardFocusSectionSkeleton />}>
          <WorkerFocusBlock data={checklists} />
        </Suspense>
      }
      summary={
        <DashboardRegion data={checklists} fallback={<DashboardSummarySkeleton />} message="Ringkasan checklist belum dapat dimuat.">
          {(data) => <WorkerSummary data={data} followUps={followUps} />}
        </DashboardRegion>
      }
      stats={
        <>
          <DashboardRegion data={checklists} fallback={<DashboardStatsSkeleton labels={["Checklist aktif", "Terlambat", "Selesai bulan ini"]} />} message="Statistik checklist belum dapat dimuat.">
            {(data) => <WorkerStats data={data} />}
          </DashboardRegion>
          <DashboardRegion data={followUps} fallback={<DashboardStatsSkeleton labels={["Tindak lanjut"]} />} message="Statistik tindak lanjut belum dapat dimuat.">
            {(data) => <StatCard label="Tindak lanjut" value={data.total} suffix="temuan" icon={Wrench} tone={data.total > 0 ? "warning" : "neutral"} />}
          </DashboardRegion>
        </>
      }
      overtime={
        <DashboardRegion data={overview} fallback={<DashboardRowsSkeleton kind="overtime" count={1} />} message="Jadwal lembur belum dapat dimuat.">
          {(data) => <WorkerOvertime overview={data} />}
        </DashboardRegion>
      }
      queueBlock={
        <Suspense fallback={<DashboardQueueSectionSkeleton />}>
          <WorkerQueueBlock data={checklists} />
        </Suspense>
      }
      followUps={
        <DashboardRegion data={followUps} fallback={<DashboardRowsSkeleton kind="follow-up" count={2} />} message="Tindak lanjut belum dapat dimuat.">
          {(data) => <WorkerFollowUps data={data} />}
        </DashboardRegion>
      }
      manualWorkDescription={
        <DashboardValue data={manualWorks} fallback={<Skeleton className="h-4 w-40" />}>
          {(data) => manualWorkDescription(data.totals)}
        </DashboardValue>
      }
      manualWorks={
        <DashboardRegion data={manualWorks} fallback={<DashboardRowsSkeleton kind="manual-work" count={3} />} message="Pekerjaan harian belum dapat dimuat.">
          {(data) => <ManualWorkSummaryContent items={data.items} canManage={!readOnly} canAssign={false} readOnly={readOnly} />}
        </DashboardRegion>
      }
    />
  );
}

/** Fokus berikutnya hanya menampilkan checklist hari ini yang masih bisa diisi. */
async function WorkerFocusBlock({ data }: { data: DashboardRequest<DashboardChecklists> }) {
  const result = await data;
  if (!result.ok) return null;
  const focus = checklistFocus(result.data);
  if (!focus) return null;
  return (
    <section aria-label="Fokus berikutnya">
      <Frame>
        <FrameHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Fokus berikutnya</span>
            <ChecklistStatusBadge status={focus.inspection.status} />
          </div>
          <WorkerFocusHeading data={result.data} />
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4">
          <WorkerFocus data={result.data} />
        </FramePanel>
      </Frame>
    </section>
  );
}

/** Queue visibility depends on settled data: a lone focus hides the empty extra panel on mobile. */
async function WorkerQueueBlock({ data }: { data: DashboardRequest<DashboardChecklists> }) {
  const result = await data;
  const rows = result.ok ? dashboardChecklistRows(result.data) : [];
  const focus = result.ok ? checklistFocus(result.data) : null;
  const queue = focus ? rows.filter((row) => row.inspection.id !== focus.inspection.id) : [];
  const sectionClass = focus && queue.length === 0 ? "hidden sm:flex" : "flex";
  return (
    <section aria-label="Antrean checklist" className={`${sectionClass} order-2 min-w-0 flex-col gap-3 sm:order-1 xl:row-span-2`}>
      <Frame spacing="sm">
        {focus && (
          <FrameHeader className="flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <FrameTitle>Antrean checklist</FrameTitle>
              <FrameDescription className="hidden text-xs sm:block">Pekerjaan aktif lainnya.</FrameDescription>
            </div>
            {rows.length > 1 && (
              <Link href="/checklist" className="text-xs font-medium text-primary transition-colors hover:underline">Semua</Link>
            )}
          </FrameHeader>
        )}
        <FramePanel className="flex flex-col justify-center">
          {result.ok ? <WorkerChecklists data={result.data} /> : <DataLoadError message="Antrean checklist belum dapat dimuat." />}
        </FramePanel>
      </Frame>
    </section>
  );
}

function WorkerFocusHeading({ data }: { data: DashboardChecklists }) {
  const focus = checklistFocus(data);
  if (!focus) return null;
  return <>
    <FrameTitle>
      <Link href={`/checklist/${focus.inspection.id}`} className="transition-colors hover:text-primary hover:underline">{focus.inspection.templateName}</Link>
    </FrameTitle>
    <FrameDescription className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      <span className="flex min-w-0 items-center gap-1.5"><MapPin className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{focus.inspection.locationName}</span></span>
      <span className="flex items-center gap-1.5"><CalendarClock className="size-3.5" aria-hidden="true" />Deadline {formatDateTime(focus.inspection.dueAt, "EEEE, d MMM · HH:mm")}</span>
    </FrameDescription>
  </>;
}

function WorkerFocus({ data }: { data: DashboardChecklists }) {
  const focus = checklistFocus(data);
  if (!focus) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Tidak ada checklist untuk hari ini"
        description={
          data.totals.overdue > 0
            ? "Checklist yang terlambat atau terkunci tidak ditampilkan di fokus ini."
            : "Checklist baru muncul otomatis sesuai jadwal area kerjamu."
        }
        action={<ChecklistsButton overdue={data.totals.overdue > 0} />}
      />
    );
  }
  const progress = focus.totalItems > 0 ? Math.round((focus.answeredCount / focus.totalItems) * 100) : 0;
  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium tabular-nums text-foreground">{focus.answeredCount}/{focus.totalItems} item</p>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{progress}%</span>
        </div>
        <ProgressBar value={focus.answeredCount} max={focus.totalItems} tone={focus.totalItems > 0 && focus.answeredCount === focus.totalItems ? "success" : "primary"} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <ChecklistAssigneeStack people={focus.assignees} max={4} />
          <span className="truncate text-xs text-muted-foreground">
            {focus.assignees.length > 0 ? `${focus.assignees.length} anggota` : "Tanpa anggota"}{focus.openFollowUps > 0 ? ` · ${focus.openFollowUps} temuan` : ""}
          </span>
        </div>
        <Button size="lg" className="w-full sm:w-auto" nativeButton={false} render={<Link href={`/checklist/${focus.inspection.id}`} />}>
          {focus.answeredCount > 0
            ? "Lanjutkan checklist"
            : checklistHasOpened(focus.inspection.opensAt)
              ? "Mulai checklist"
              : "Lihat checklist"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </>
  );
}

function WorkerSummary({ data: { totals }, followUps }: { data: DashboardChecklists; followUps: DashboardRequest<DashboardFollowUps> }) {
  return (
    <DashboardValue data={followUps} fallback={<WorkerSummaryItems totals={totals} />} unavailable={<WorkerSummaryItems totals={totals} unavailable />}>
      {(data) => <WorkerSummaryItems totals={totals} followUpTotal={data.total} />}
    </DashboardValue>
  );
}

function WorkerSummaryItems({ totals, followUpTotal, unavailable = false }: {
  totals: DashboardChecklists["totals"];
  followUpTotal?: number;
  unavailable?: boolean;
}) {
  return <MobileSummary items={[
    { label: "Checklist aktif", value: totals.todayTodo, icon: ClipboardList, tone: "primary", href: "/checklist?status=aktif", ariaLabel: `Buka ${totals.todayTodo} checklist aktif hari ini` },
    { label: "Terlambat", value: totals.overdue, icon: AlertTriangle, tone: totals.overdue > 0 ? "destructive" : "neutral", href: "/checklist?status=terlambat", ariaLabel: `Buka ${totals.overdue} checklist terlambat` },
    { label: "Selesai bulan ini", value: totals.completedThisMonth, icon: CheckCircle2, tone: "success" },
    { label: "Tindak lanjut", value: followUpTotal ?? (unavailable ? "—" : <Skeleton className="h-7 w-12" />), icon: Wrench, tone: followUpTotal && followUpTotal > 0 ? "warning" : "neutral", href: "/checklist/tindak-lanjut?mine=1", ariaLabel: followUpTotal === undefined ? "Buka tindak lanjut" : `Buka tindak lanjut, ${followUpTotal} belum selesai` },
  ]} />;
}

function WorkerStats({ data: { totals } }: { data: DashboardChecklists }) {
  return <>
    <StatCard label="Checklist aktif" value={totals.todayTodo} suffix="checklist" icon={ClipboardList} helper={totals.overdue > 0 ? <Badge variant="warning-light">{totals.overdue} terlambat</Badge> : <Badge variant="success-light">Sesuai jadwal</Badge>} />
    <StatCard label="Terlambat" value={totals.overdue} suffix="checklist" icon={CalendarClock} tone={totals.overdue > 0 ? "destructive" : "neutral"} helper={totals.overdue > 0 ? "Minta atasan membuka kunci" : "Tidak ada keterlambatan"} />
    <StatCard label="Selesai bulan ini" value={totals.completedThisMonth} suffix="checklist" icon={CheckCircle2} tone="success" helper="Sejak awal bulan" />
  </>;
}

function WorkerOvertime({ overview }: { overview: WorkerOverview }) {
  const overtime = overview.activeItem ?? overview.nextItem;
  return overtime ? (
    <div className="relative flex items-start gap-3">
      <IconTile variant="soft" aria-hidden="true"><CalendarDays /></IconTile>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={`/spkl/${overtime.spkl.id}`} className="line-clamp-2 text-sm font-medium text-foreground after:absolute after:inset-0 transition-colors hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring">{overtime.spkl.title}</Link>
        <p className="text-xs text-muted-foreground">{formatDateHuman(overtime.spkl.startAt, "d MMM, HH:mm")}–{formatTime(overtime.spkl.endAt)} {currentTimeZoneLabel()}</p>
        <div><SpklStatusBadge status={overtime.status} /></div>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </div>
  ) : (
    <EmptyState icon={CalendarDays} title="Tidak ada jadwal lembur" description="Penugasan baru dari atasan akan muncul di sini." action={
      <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/riwayat" />}>Lihat lembur</Button>
    } />
  );
}

function ChecklistsButton({ overdue = false }: { overdue?: boolean }) {
  return (
    <Button
      size="sm"
      variant="outline"
      nativeButton={false}
      render={<Link href={overdue ? "/checklist?status=terlambat" : "/checklist"} />}
    >
      {overdue ? "Lihat checklist terlambat" : "Buka semua checklist"}
    </Button>
  );
}

function WorkerChecklists({ data }: { data: DashboardChecklists }) {
  const rows = dashboardChecklistRows(data);
  const focus = checklistFocus(data);
  const queue = focus ? rows.filter((row) => row.inspection.id !== focus.inspection.id) : [];
  return queue.length > 0 ? queue.map((row, index) => (
    <div key={row.inspection.id}>{index > 0 && <Separator />}<ChecklistSummaryRow row={row} /></div>
  )) : (
    <EmptyState
      icon={focus ? ClipboardCheck : ClipboardList}
      title={focus ? "Tidak ada checklist lain hari ini" : "Tidak ada checklist untuk hari ini"}
      description={
        focus
          ? "Checklist lain yang belum selesai tetap bisa dibuka dari halaman Checklist."
          : data.totals.overdue > 0
            ? "Checklist yang terlambat atau terkunci tidak ditampilkan di antrean ini."
            : "Checklist baru muncul otomatis sesuai jadwal area kerjamu."
      }
      action={<ChecklistsButton overdue={!focus && data.totals.overdue > 0} />}
    />
  );
}

function WorkerFollowUps({ data }: { data: DashboardFollowUps }) {
  return data.items.length > 0 ? data.items.map((row, index) => (
    <div key={row.followUp.id}>{index > 0 && <Separator />}<FollowUpSummaryRow row={row} /></div>
  )) : (
    <EmptyState
      icon={CheckCircle2}
      title="Tidak ada tindak lanjut"
      description="Temuan baru yang ditugaskan akan muncul di sini."
      action={<Button size="sm" variant="outline" nativeButton={false} render={<Link href="/checklist/tindak-lanjut" />}>Buka tindak lanjut</Button>}
    />
  );
}
