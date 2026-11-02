import Link from "next/link";
import { AlertTriangle, CalendarClock, ScrollText, ShieldCheck, UsersRound } from "lucide-react";
import { DashboardRegion, DashboardValue, type DashboardRequest } from "@/components/dashboard/dashboard-data";
import { OrganizationDashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardRowsSkeleton, DashboardStatsSkeleton, DashboardSummarySkeleton } from "@/components/dashboard/dashboard-skeletons";
import { MobileSummary } from "@/components/mobile-summary";
import { Avatar, Badge, EmptyState, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { avatarUrl } from "@/lib/avatar-url";
import type { OrganizationOverview, SupervisorRow } from "@/lib/supervisor-queries";
import { formatDateTime } from "@/lib/time";
import type { AuditLog, SessionUser } from "@/lib/types";

const STAT_LABELS = ["Atasan", "Pekerja", "SPKL hari ini", "Checklist terlambat"];
const SUMMARY_LABELS = ["Atasan aktif", "Pekerja aktif", "SPKL hari ini", "Checklist terlambat"];
const OBJECT_LABEL: Record<AuditLog["objectType"], string> = {
  spkl: "SPKL",
  absensi: "Absensi",
  karyawan: "Karyawan",
  divisi: "Divisi",
  kebijakan: "Kebijakan",
  autentikasi: "Autentikasi",
  checklist: "Checklist",
  tindak_lanjut: "Tindak lanjut",
  pekerjaan: "Pekerjaan harian",
  dokumen: "Dokumen kerja",
  catatan: "Catatan",
};

export function OrganizationDashboard({
  user,
  overview,
  supervisors,
  logs,
}: {
  user: SessionUser;
  overview: DashboardRequest<OrganizationOverview>;
  supervisors: DashboardRequest<SupervisorRow[]>;
  logs: DashboardRequest<AuditLog[]>;
}) {
  return (
    <OrganizationDashboardShell
      user={user}
      summary={
        <DashboardRegion data={overview} fallback={<DashboardSummarySkeleton labels={SUMMARY_LABELS} />} message="Ringkasan organisasi belum dapat dimuat.">
          {(data) => <OrganizationSummary overview={data} />}
        </DashboardRegion>
      }
      stats={
        <DashboardRegion data={overview} fallback={<DashboardStatsSkeleton labels={STAT_LABELS} />} message="Statistik organisasi belum dapat dimuat.">
          {(data) => <OrganizationStats overview={data} />}
        </DashboardRegion>
      }
      teamDescription={
        <DashboardValue data={overview} fallback={<Skeleton className="h-3 w-48" />}>
          {(data) => `${data.divisions} divisi · ${data.openFollowUps} tindak lanjut terbuka`}
        </DashboardValue>
      }
      team={
        <DashboardRegion data={supervisors} fallback={<DashboardRowsSkeleton kind="team" count={4} />} message="Tim dan atasan belum dapat dimuat.">
          {(data) => <OrganizationTeam supervisors={data} />}
        </DashboardRegion>
      }
      activity={
        <DashboardRegion data={logs} fallback={<DashboardRowsSkeleton kind="activity" count={4} />} message="Aktivitas terbaru belum dapat dimuat.">
          {(data) => <OrganizationActivity logs={data} />}
        </DashboardRegion>
      }
    />
  );
}

function OrganizationSummary({ overview }: { overview: OrganizationOverview }) {
  return <MobileSummary items={[
    { label: "Atasan aktif", tone: "primary", icon: ShieldCheck, href: "/tim", ariaLabel: `Kelola atasan, ${overview.activeSupervisors} aktif`, value: <>{overview.activeSupervisors}<span className="text-sm font-medium text-muted-foreground">/{overview.supervisors}</span></> },
    { label: "Pekerja aktif", tone: "primary", icon: UsersRound, value: <>{overview.activeWorkers}<span className="text-sm font-medium text-muted-foreground">/{overview.workers}</span></> },
    { label: "SPKL hari ini", value: overview.todaySpkls, icon: CalendarClock, tone: "info" },
    { label: "Checklist terlambat", value: overview.overdueChecklists, icon: AlertTriangle, tone: overview.overdueChecklists > 0 ? "destructive" : "neutral" },
  ]} />;
}

function OrganizationStats({ overview }: { overview: OrganizationOverview }) {
  return <>
    <StatCard label="Atasan" value={overview.activeSupervisors} suffix={`dari ${overview.supervisors}`} icon={ShieldCheck} helper="Akun atasan aktif" tone="primary" />
    <StatCard label="Pekerja" value={overview.activeWorkers} suffix={`dari ${overview.workers}`} icon={UsersRound} helper={`${overview.activeDivisions} divisi aktif`} tone="primary" />
    <StatCard label="SPKL hari ini" value={overview.todaySpkls} icon={CalendarClock} helper={`${overview.runningSpkls} sedang berlangsung`} tone="info" />
    <StatCard label="Checklist terlambat" value={overview.overdueChecklists} icon={AlertTriangle} helper={`${overview.openChecklists} belum selesai`} tone={overview.overdueChecklists > 0 ? "destructive" : "neutral"} />
  </>;
}

function OrganizationTeam({ supervisors }: { supervisors: SupervisorRow[] }) {
  return supervisors.length === 0 ? (
    <EmptyState icon={ShieldCheck} title="Belum ada atasan" description="Tambahkan akun atasan agar tim dapat mulai bekerja." action={
      <Button nativeButton={false} render={<Link href="/tim" />}>Tambah atasan</Button>
    } />
  ) : (
    <ul className="divide-y divide-border/70">
      {supervisors.slice(0, 6).map((row) => (
        <li key={row.employee.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <Avatar name={row.employee.name} seed={row.employee.id} src={avatarUrl(row.employee.id, row.employee.avatarKey)} size="sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">{row.employee.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{row.activeTeamCount} anggota aktif · {row.divisionCount} divisi</span>
          </div>
          <Badge variant={row.employee.active ? "success-light" : "warning-light"} dot={row.employee.active}>{row.employee.active ? "Aktif" : "Nonaktif"}</Badge>
        </li>
      ))}
    </ul>
  );
}

function OrganizationActivity({ logs }: { logs: AuditLog[] }) {
  return logs.length === 0 ? (
    <EmptyState icon={ScrollText} title="Belum ada aktivitas" description="Perubahan data akan tercatat otomatis di sini." action={
      <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/audit" />}>Buka audit</Button>
    } />
  ) : (
    <ul className="divide-y divide-border/70">
      {logs.slice(0, 6).map((log) => (
        <li key={log.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{OBJECT_LABEL[log.objectType]}</Badge>
            <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
          </div>
          <p className="text-sm text-foreground">{log.summary}</p>
          <p className="text-xs text-muted-foreground">oleh {log.actorName}</p>
        </li>
      ))}
    </ul>
  );
}
