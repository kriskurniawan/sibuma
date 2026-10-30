import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  ScrollText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { MobileSummary } from "@/components/mobile-summary";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import {
  Avatar,
  Badge,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { avatarUrl } from "@/lib/avatar-url";
import type { OrganizationOverview, SupervisorRow } from "@/lib/supervisor-queries";
import { formatDateTime, greeting } from "@/lib/time";
import type { AuditLog, SessionUser } from "@/lib/types";

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
};

export function OrganizationDashboard({
  user,
  overview,
  supervisors,
  logs,
}: {
  user: SessionUser;
  overview: OrganizationOverview;
  supervisors: SupervisorRow[];
  logs: AuditLog[];
}) {
  const firstName = user.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow="Organisasi"
        title={`${greeting()}, ${firstName}.`}
        description="Pantau tim, akun atasan, dan aktivitas operasional."
        descriptionClassName="hidden sm:block"
        action={
          <Button nativeButton={false} render={<Link href="/tim" />}>
            <UsersRound aria-hidden="true" />
            Kelola atasan
          </Button>
        }
      />

      <MobileSummary
        className="sm:hidden"
        items={[
          {
            label: "Atasan aktif",
            tone: "primary",
            icon: ShieldCheck,
            href: "/tim",
            ariaLabel: `Kelola atasan, ${overview.activeSupervisors} aktif`,
            value: (
              <>
                {overview.activeSupervisors}
                <span className="text-sm font-medium text-muted-foreground">
                  /{overview.supervisors}
                </span>
              </>
            ),
          },
          {
            label: "Pekerja aktif",
            tone: "primary",
            icon: UsersRound,
            value: (
              <>
                {overview.activeWorkers}
                <span className="text-sm font-medium text-muted-foreground">
                  /{overview.workers}
                </span>
              </>
            ),
          },
          {
            label: "SPKL hari ini",
            value: overview.todaySpkls,
            icon: CalendarClock,
            tone: "info",
          },
          {
            label: "Checklist terlambat",
            value: overview.overdueChecklists,
            icon: AlertTriangle,
            tone: overview.overdueChecklists > 0 ? "destructive" : "neutral",
          },
        ]}
      />

      <div className="hidden grid-cols-1 gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Atasan"
          value={overview.activeSupervisors}
          suffix={`dari ${overview.supervisors}`}
          icon={ShieldCheck}
          helper="Akun atasan aktif"
          tone="primary"
        />
        <StatCard
          label="Pekerja"
          value={overview.activeWorkers}
          suffix={`dari ${overview.workers}`}
          icon={UsersRound}
          helper={`${overview.activeDivisions} divisi aktif`}
          tone="primary"
        />
        <StatCard
          label="SPKL hari ini"
          value={overview.todaySpkls}
          icon={CalendarClock}
          helper={`${overview.runningSpkls} sedang berlangsung`}
          tone="info"
        />
        <StatCard
          label="Checklist terlambat"
          value={overview.overdueChecklists}
          icon={AlertTriangle}
          helper={`${overview.openChecklists} belum selesai`}
          tone={overview.overdueChecklists > 0 ? "destructive" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Frame>
          <FrameHeader className="flex flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Tim &amp; atasan</FrameTitle>
              <FrameDescription className="text-xs">
                {overview.divisions} divisi · {overview.openFollowUps} tindak lanjut terbuka
              </FrameDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/tim" />}
            >
              Lihat semua
            </Button>
          </FrameHeader>
          <FramePanel>
            {supervisors.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="Belum ada atasan"
                description="Tambahkan akun atasan agar tim dapat mulai bekerja."
                action={
                  <Button nativeButton={false} render={<Link href="/tim" />}>
                    Tambah atasan
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border/70">
                {supervisors.slice(0, 6).map((row) => (
                  <li key={row.employee.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar
                      name={row.employee.name}
                      seed={row.employee.id}
                      src={avatarUrl(row.employee.id, row.employee.avatarKey)}
                      size="sm"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {row.employee.name}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {row.activeTeamCount} anggota aktif · {row.divisionCount} divisi
                      </span>
                    </div>
                    <Badge
                      variant={row.employee.active ? "success-light" : "warning-light"}
                      dot={row.employee.active}
                    >
                      {row.employee.active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </FramePanel>
        </Frame>

        <Frame>
          <FrameHeader className="flex flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Aktivitas terbaru</FrameTitle>
              <FrameDescription className="hidden text-xs sm:block">
                Jejak audit lintas tim
              </FrameDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/audit" />}
            >
              <ScrollText aria-hidden="true" />
              Log audit
            </Button>
          </FrameHeader>
          <FramePanel>
            {logs.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="Belum ada aktivitas"
                description="Perubahan data akan tercatat otomatis di sini."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href="/audit" />}
                  >
                    Buka audit
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border/70">
                {logs.slice(0, 6).map((log) => (
                  <li key={log.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{OBJECT_LABEL[log.objectType]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{log.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      oleh {log.actorName}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </FramePanel>
        </Frame>
      </div>

      <Frame variant="ghost">
        <FramePanel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-foreground">
                Laporan lintas tim
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Rekap lembur dan checklist seluruh tim.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/laporan?tab=lembur" />}
            >
              <ClipboardList aria-hidden="true" />
              Laporan lembur
            </Button>
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/laporan?tab=checklist" />}
            >
              <ClipboardCheck aria-hidden="true" />
              Laporan checklist
            </Button>
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
