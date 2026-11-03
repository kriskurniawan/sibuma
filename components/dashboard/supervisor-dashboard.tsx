import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, ClipboardList, Plus, Wrench } from "lucide-react";
import { ChecklistSummaryRow, FollowUpSummaryRow } from "@/components/dashboard/checklist-summary";
import { ManualWorkSummaryContent, manualWorkDescription } from "@/components/dashboard/manual-work-summary";
import { OperationalDashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardRegion, DashboardValue, type DashboardChecklists, type DashboardFollowUps, type DashboardManualWorks, type DashboardRequest } from "@/components/dashboard/dashboard-data";
import { DashboardFocusSkeleton, DashboardRowsSkeleton, DashboardStatsSkeleton, DashboardSummarySkeleton } from "@/components/dashboard/dashboard-skeletons";
import { MobileSummary } from "@/components/mobile-summary";
import { IconTile } from "@/components/reui/icon-tile";
import { Badge, EmptyState, SpklStatusBadge, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { SupervisorOverview } from "@/lib/queries";
import { isReadOnly } from "@/lib/access";
import type { SessionUser } from "@/lib/types";
import { currentTimeZoneLabel, formatDateHuman, formatTime } from "@/lib/time";

const STAT_LABELS = ["Checklist aktif", "Terlambat", "Tindak lanjut", "Selesai bulan ini"];

/** Beranda atasan juga fokus ke checklist hari ini; item terkunci tidak dipajang. */
function supervisorChecklistRows(data: DashboardChecklists) {
  return data.items.filter((row) => !row.overdue && !row.locked);
}

export function SupervisorDashboard({
  user,
  overview,
  checklists,
  followUps,
  manualWorks,
}: {
  user: SessionUser;
  overview: DashboardRequest<SupervisorOverview>;
  checklists: DashboardRequest<DashboardChecklists>;
  followUps: DashboardRequest<DashboardFollowUps>;
  manualWorks: DashboardRequest<DashboardManualWorks>;
}) {
  const readOnly = isReadOnly(user);

  return (
    <OperationalDashboardShell
      user={user}
      focus={
        <DashboardRegion data={checklists} fallback={<DashboardFocusSkeleton supervisor />} message="Fokus checklist belum dapat dimuat.">
          {(data) => <SupervisorFocus data={data} />}
        </DashboardRegion>
      }
      summary={
        <DashboardRegion data={checklists} fallback={<DashboardSummarySkeleton labels={STAT_LABELS} />} message="Ringkasan checklist belum dapat dimuat.">
          {(data) => <SupervisorSummary data={data} />}
        </DashboardRegion>
      }
      stats={
        <DashboardRegion data={checklists} fallback={<DashboardStatsSkeleton labels={STAT_LABELS} />} message="Statistik checklist belum dapat dimuat.">
          {(data) => <SupervisorStats data={data} overview={overview} />}
        </DashboardRegion>
      }
      overtime={
        <DashboardRegion data={overview} fallback={<DashboardRowsSkeleton kind="overtime" count={1} />} message="Jadwal lembur belum dapat dimuat.">
          {(data) => <SupervisorOvertime overview={data} readOnly={readOnly} />}
        </DashboardRegion>
      }
      checklists={
        <DashboardRegion data={checklists} fallback={<DashboardRowsSkeleton kind="checklist" count={3} />} message="Checklist prioritas belum dapat dimuat.">
          {(data) => <SupervisorChecklists data={data} readOnly={readOnly} />}
        </DashboardRegion>
      }
      followUpDescription={
        <DashboardValue data={followUps} fallback={<Skeleton className="h-3 w-40" />}>
          {(data) => data.total > 0 ? `${data.total} temuan terbuka` : "Temuan dari checklist tim"}
        </DashboardValue>
      }
      followUps={
        <DashboardRegion data={followUps} fallback={<DashboardRowsSkeleton kind="follow-up" count={2} />} message="Tindak lanjut belum dapat dimuat.">
          {(data) => <SupervisorFollowUps data={data} />}
        </DashboardRegion>
      }
      manualWorkDescription={
        <DashboardValue data={manualWorks} fallback={<Skeleton className="h-4 w-40" />}>
          {(data) => manualWorkDescription(data.totals)}
        </DashboardValue>
      }
      manualWorks={
        <DashboardRegion data={manualWorks} fallback={<DashboardRowsSkeleton kind="manual-work" count={3} />} message="Pekerjaan harian belum dapat dimuat.">
          {(data) => <ManualWorkSummaryContent items={data.items} canManage={!readOnly} canAssign={!readOnly} readOnly={readOnly} />}
        </DashboardRegion>
      }
    />
  );
}

function SupervisorFocus({ data }: { data: DashboardChecklists }) {
  const focus = supervisorChecklistRows(data)[0];
  const overdue = data.totals.overdue;
  return (
    <>
      <div className="flex items-start gap-3">
        <IconTile variant="soft" aria-hidden="true"><ClipboardCheck /></IconTile>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-xs font-medium text-muted-foreground">Perlu perhatian</p>
          <p className="text-sm font-semibold text-foreground">
            {overdue > 0 ? `${overdue} checklist terlambat` : focus ? "Checklist berikutnya" : "Tidak ada checklist aktif"}
          </p>
          {focus && <p className="line-clamp-2 text-xs text-muted-foreground">{focus.inspection.templateName}</p>}
        </div>
      </div>
      <Button nativeButton={false} render={<Link href={overdue > 0 ? "/checklist?status=terlambat" : focus ? `/checklist/${focus.inspection.id}` : "/checklist"} />}>
        {overdue > 0 ? "Tinjau keterlambatan" : "Buka checklist"}<ArrowRight aria-hidden="true" />
      </Button>
    </>
  );
}

function SupervisorSummary({ data: { totals } }: { data: DashboardChecklists }) {
  return (
    <MobileSummary items={[
      { label: "Checklist aktif", value: totals.todayTodo, icon: ClipboardList, tone: "primary", href: "/checklist?status=aktif", ariaLabel: `Buka ${totals.todayTodo} checklist aktif hari ini` },
      { label: "Terlambat", value: totals.overdue, icon: AlertTriangle, tone: totals.overdue > 0 ? "destructive" : "neutral", href: "/checklist?status=terlambat", ariaLabel: `Buka ${totals.overdue} checklist terlambat` },
      { label: "Tindak lanjut", value: totals.openFollowUps, icon: Wrench, tone: totals.openFollowUps > 0 ? "warning" : "neutral", href: "/checklist/tindak-lanjut", ariaLabel: `Buka tindak lanjut, ${totals.openFollowUps} belum selesai` },
      { label: "Selesai bulan ini", value: totals.completedThisMonth, icon: CheckCircle2, tone: "success" },
    ]} />
  );
}

function SupervisorStats({ data: { totals }, overview }: { data: DashboardChecklists; overview: DashboardRequest<SupervisorOverview> }) {
  return (
    <>
      <StatCard label="Checklist aktif" value={totals.todayTodo} suffix="checklist" icon={ClipboardList} helper={totals.overdue > 0 ? <Badge variant="warning-light">{totals.overdue} terlambat</Badge> : <Badge variant="success-light">Sesuai jadwal</Badge>} />
      <StatCard label="Terlambat" value={totals.overdue} suffix="checklist" icon={AlertTriangle} tone={totals.overdue > 0 ? "destructive" : "neutral"} helper={totals.overdue > 0 ? "Buka kunci atau tindak lanjuti" : "Tidak ada keterlambatan"} />
      <StatCard label="Tindak lanjut" value={totals.openFollowUps} suffix="temuan" icon={Wrench} tone={totals.openFollowUps > 0 ? "warning" : "neutral"} helper={totals.openFollowUps > 0 ? "Temuan dari checklist tim" : "Tidak ada temuan terbuka"} />
      <StatCard label="Selesai bulan ini" value={totals.completedThisMonth} suffix="checklist" icon={CheckCircle2} tone="success" helper={
        <DashboardValue data={overview} fallback={<Skeleton className="h-3 w-28" />} unavailable="Jumlah pekerja belum tersedia">
          {(data) => `${data.stats.teamCount} pekerja aktif`}
        </DashboardValue>
      } />
    </>
  );
}

function SupervisorOvertime({ overview, readOnly }: { overview: SupervisorOverview; readOnly: boolean }) {
  const nextSession = overview.upcoming[0];
  if (overview.activeSpkls.length > 0) {
    return (
      <>
        {overview.activeSpkls.slice(0, 2).map((spotlight) => {
          const complete = spotlight.expected > 0 && spotlight.checkedIn === spotlight.expected;
          return (
            <div key={spotlight.spkl.id} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Link href={`/spkl/${spotlight.spkl.id}`} className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary">{spotlight.spkl.title}</Link>
                <p className="text-xs text-muted-foreground">{formatTime(spotlight.spkl.startAt)}–{formatTime(spotlight.spkl.endAt)} {currentTimeZoneLabel()} · {spotlight.checkedIn}/{spotlight.expected} hadir</p>
              </div>
              <Badge variant={complete ? "success-light" : "warning-light"} className="shrink-0 self-start">{complete ? "Lengkap" : "Belum lengkap"}</Badge>
            </div>
          );
        })}
        {overview.stats.needsAttention > 0 && <p className="text-xs text-muted-foreground">{overview.stats.needsAttention} pekerja belum melakukan absen masuk.</p>}
      </>
    );
  }
  if (nextSession) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={`/spkl/${nextSession.spkl.id}`} className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary">{nextSession.spkl.title}</Link>
          <p className="text-xs text-muted-foreground">{formatDateHuman(nextSession.spkl.startAt, "d MMM, HH:mm")}–{formatTime(nextSession.spkl.endAt)} · {nextSession.workerCount} pekerja</p>
        </div>
        <SpklStatusBadge status="terjadwal" className="shrink-0 self-start" />
      </div>
    );
  }
  return (
    <EmptyState icon={CalendarDays} title="Tidak ada lembur" description="Belum ada sesi aktif atau terjadwal." action={
      <Button size="sm" variant="outline" nativeButton={false} render={<Link href={readOnly ? "/lembur" : "/spkl/baru"} />}>
        {!readOnly && <Plus aria-hidden="true" />}{readOnly ? "Lihat lembur" : "Buat SPKL"}
      </Button>
    } />
  );
}

function SupervisorChecklists({ data, readOnly }: { data: DashboardChecklists; readOnly: boolean }) {
  const rows = supervisorChecklistRows(data);
  const overdue = data.totals.overdue > 0;
  return rows.length > 0 ? rows.map((row, index) => (
    <div key={row.inspection.id}>{index > 0 && <Separator />}<ChecklistSummaryRow row={row} /></div>
  )) : (
    <EmptyState
      icon={ClipboardList}
      title="Tidak ada checklist untuk hari ini"
      description={
        overdue
          ? "Checklist yang terlambat atau terkunci tidak ditampilkan di antrean ini."
          : "Semua checklist hari ini sudah selesai atau belum ada jadwal untuk hari ini."
      }
      action={
        overdue ? (
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/checklist?status=terlambat" />}>Lihat checklist terlambat</Button>
        ) : (
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={readOnly ? "/checklist" : "/checklist/jadwal"} />}>
            {readOnly ? "Lihat checklist" : "Atur jadwal"}
          </Button>
        )
      }
    />
  );
}

function SupervisorFollowUps({ data }: { data: DashboardFollowUps }) {
  return data.items.length > 0 ? data.items.map((row, index) => (
    <div key={row.followUp.id}>{index > 0 && <Separator />}<FollowUpSummaryRow row={row} /></div>
  )) : (
    <EmptyState icon={CheckCircle2} title="Tidak ada temuan terbuka" description="Temuan baru dari checklist akan muncul di sini." action={
      <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/checklist" />}>Lihat checklist</Button>
    } />
  );
}
