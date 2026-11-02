import Link from "next/link";
import type { ReactNode } from "react";
import { ClipboardCheck, ClipboardList, ScrollText, UsersRound } from "lucide-react";
import { QrScanButton } from "@/components/checklist/qr-scanner";
import { ManualWorkSummaryShell } from "@/components/dashboard/manual-work-summary";
import {
  DashboardFocusSkeleton,
  DashboardRowsSkeleton,
  DashboardStatsSkeleton,
  DashboardSummarySkeleton,
} from "@/components/dashboard/dashboard-skeletons";
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
import { isReadOnly } from "@/lib/access";
import { formatDateHuman, greeting } from "@/lib/time";
import type { SessionUser } from "@/lib/types";

export function DashboardHeader({ user }: { user: SessionUser }) {
  const organization = user.role === "super_admin";
  const supervisor = user.role === "atasan";

  return (
    <PageHeader
      eyebrow={organization ? "Organisasi" : formatDateHuman(new Date().toISOString(), "EEEE, d MMMM yyyy")}
      title={`${greeting()}, ${user.name.split(" ")[0]}.`}
      description={organization
        ? "Pantau tim, akun atasan, dan aktivitas operasional."
        : supervisor
          ? "Pantau checklist operasional, temuan, dan kesiapan tim hari ini."
          : "Checklist area kerjamu hari ini, lengkap dengan deadline dan tindak lanjutnya."}
      descriptionClassName="hidden sm:block"
      action={organization ? (
        <Button nativeButton={false} render={<Link href="/tim" />}>
          <UsersRound aria-hidden="true" />
          Kelola atasan
        </Button>
      ) : (
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <Button
            size="sm"
            variant={supervisor ? "default" : "outline"}
            nativeButton={false}
            render={<Link href="/checklist" />}
          >
            {supervisor ? <ClipboardCheck aria-hidden="true" /> : <ClipboardList aria-hidden="true" />}
            {supervisor ? "Buka checklist" : "Semua checklist"}
          </Button>
          <QrScanButton className="hidden md:inline-flex" />
        </div>
      )}
    />
  );
}

export function DashboardFocusSectionSkeleton() {
  return (
    <section aria-label="Fokus berikutnya" aria-busy="true">
      <Frame>
        <FrameHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Fokus berikutnya</span>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-56 max-w-full" />
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-4 w-48 max-w-full" />
            </div>
          </div>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4">
          <DashboardFocusSkeleton />
        </FramePanel>
      </Frame>
    </section>
  );
}

export function DashboardQueueSectionSkeleton() {
  return (
    <section
      aria-label="Antrean checklist"
      aria-busy="true"
      className="order-2 flex min-w-0 flex-col gap-3 sm:order-1 xl:row-span-2"
    >
      <Frame spacing="sm">
        <FrameHeader className="flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <FrameTitle>Antrean checklist</FrameTitle>
            <FrameDescription className="hidden text-xs sm:block">Pekerjaan aktif lainnya.</FrameDescription>
          </div>
          <span className="text-xs font-medium text-muted-foreground">Semua</span>
        </FrameHeader>
        <FramePanel className="flex flex-col justify-center">
          <DashboardRowsSkeleton kind="checklist" count={3} />
        </FramePanel>
      </Frame>
    </section>
  );
}

export function OperationalDashboardShell({
  user,
  focus,
  focusStatus = <Skeleton className="h-5 w-20 rounded-full" />,
  focusHeading = (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-56 max-w-full" />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="h-4 w-48 max-w-full" />
      </div>
    </div>
  ),
  focusBlock,
  summary,
  stats,
  overtime = <DashboardRowsSkeleton kind="overtime" count={1} />,
  checklists = <DashboardRowsSkeleton kind="checklist" count={3} />,
  queueBlock,
  followUps = <DashboardRowsSkeleton kind="follow-up" count={2} />,
  followUpDescription = <Skeleton className="h-3 w-40" />,
  manualWorks = <DashboardRowsSkeleton kind="manual-work" count={3} />,
  manualWorkDescription = <Skeleton className="h-4 w-40" />,
}: {
  user: SessionUser;
  focus?: ReactNode;
  focusStatus?: ReactNode;
  focusHeading?: ReactNode;
  /** Whole focus section; worker uses it to hide the card when no focus exists. */
  focusBlock?: ReactNode;
  summary?: ReactNode;
  stats?: ReactNode;
  overtime?: ReactNode;
  checklists?: ReactNode;
  /** Whole queue section; lets settled worker data adjust its mobile visibility. */
  queueBlock?: ReactNode;
  followUps?: ReactNode;
  followUpDescription?: ReactNode;
  manualWorks?: ReactNode;
  manualWorkDescription?: ReactNode;
}) {
  const supervisor = user.role === "atasan";
  const labels = supervisor
    ? ["Checklist aktif", "Terlambat", "Tindak lanjut", "Selesai bulan ini"]
    : ["Checklist aktif", "Terlambat", "Selesai bulan ini", "Tindak lanjut saya"];
  const focusContent = focus ?? <DashboardFocusSkeleton supervisor={supervisor} />;
  const summaryContent = summary ?? <DashboardSummarySkeleton labels={labels} />;
  const statsContent = stats ?? <DashboardStatsSkeleton labels={labels} />;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <DashboardHeader user={user} />
      {focusBlock ?? (supervisor ? (
        <Frame spacing="sm" className="sm:hidden">
          <FramePanel className="flex flex-col gap-3">{focusContent}</FramePanel>
        </Frame>
      ) : (
        <section aria-label="Fokus berikutnya">
          <Frame>
            <FrameHeader className="gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Fokus berikutnya</span>
                {focusStatus}
              </div>
              {focusHeading}
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4">{focusContent}</FramePanel>
          </Frame>
        </section>
      ))}
      <div className="sm:hidden">{summaryContent}</div>
      {supervisor && (
        <section aria-label="Ringkasan checklist" className="hidden grid-cols-2 gap-3 sm:grid xl:grid-cols-4">
          {statsContent}
        </section>
      )}
      <div className={supervisor
        ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr]"
        : "grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr]"}>
        <Frame spacing="sm" className="order-1 min-w-0 sm:order-3 xl:col-start-2 xl:row-start-2">
          <FrameHeader className="flex-row items-start justify-between gap-3">
            <FrameTitle>Jadwal lembur</FrameTitle>
            <Link
              href={supervisor ? "/lembur" : "/riwayat"}
              className="text-xs font-medium text-primary transition-colors hover:underline"
            >
              {supervisor ? isReadOnly(user) ? "Lihat" : "Kelola" : "Lembur"}
            </Link>
          </FrameHeader>
          <FramePanel className="flex flex-col gap-3">{overtime}</FramePanel>
        </Frame>
        {queueBlock ?? (
          <section className="order-2 flex min-w-0 flex-col gap-3 sm:order-1 xl:row-span-2">
            <Frame spacing="sm">
              <FrameHeader className="flex-row items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <FrameTitle>{supervisor ? "Checklist prioritas" : "Antrean checklist"}</FrameTitle>
                  <FrameDescription className="hidden text-xs sm:block">
                    {supervisor ? "Diurutkan berdasarkan deadline." : "Pekerjaan aktif lainnya."}
                  </FrameDescription>
                </div>
                <Link href="/checklist" className="text-xs font-medium text-primary transition-colors hover:underline">Semua</Link>
              </FrameHeader>
              <FramePanel className="flex flex-col justify-center">{checklists}</FramePanel>
            </Frame>
          </section>
        )}
        <Frame spacing="sm" className="order-3 min-w-0 sm:order-2 xl:col-start-2 xl:row-start-1">
          <FrameHeader className="flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>{supervisor ? "Tindak lanjut" : "Tindak lanjut saya"}</FrameTitle>
              <FrameDescription className="text-xs">
                {followUpDescription ?? (supervisor ? "Temuan dari checklist tim" : "Temuan yang ditugaskan kepadamu")}
              </FrameDescription>
            </div>
            <Link
              href={supervisor ? "/checklist/tindak-lanjut" : "/checklist/tindak-lanjut?mine=1"}
              className="text-xs font-medium text-primary transition-colors hover:underline"
            >Semua</Link>
          </FrameHeader>
          <FramePanel className="flex flex-col justify-center">{followUps}</FramePanel>
        </Frame>
      </div>
      <ManualWorkSummaryShell description={manualWorkDescription}>{manualWorks}</ManualWorkSummaryShell>
      {!supervisor && (
        <section aria-label="Ringkasan checklist saya" className="hidden grid-cols-2 gap-3 sm:grid xl:grid-cols-4">
          {statsContent}
        </section>
      )}
    </div>
  );
}

export function OrganizationDashboardShell({
  user,
  summary = <DashboardSummarySkeleton labels={["Atasan aktif", "Pekerja aktif", "SPKL hari ini", "Checklist terlambat"]} />,
  stats = <DashboardStatsSkeleton labels={["Atasan", "Pekerja", "SPKL hari ini", "Checklist terlambat"]} />,
  team = <DashboardRowsSkeleton kind="team" count={4} />,
  teamDescription = <Skeleton className="h-3 w-48" />,
  activity = <DashboardRowsSkeleton kind="activity" count={4} />,
}: {
  user: SessionUser;
  summary?: ReactNode;
  stats?: ReactNode;
  team?: ReactNode;
  teamDescription?: ReactNode;
  activity?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <DashboardHeader user={user} />
      <div className="sm:hidden">{summary}</div>
      <div className="hidden grid-cols-1 gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">{stats}</div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Frame>
          <FrameHeader className="flex flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Tim &amp; atasan</FrameTitle>
              <FrameDescription className="text-xs">{teamDescription}</FrameDescription>
            </div>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/tim" />}>Lihat semua</Button>
          </FrameHeader>
          <FramePanel>{team}</FramePanel>
        </Frame>
        <Frame>
          <FrameHeader className="flex flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Aktivitas terbaru</FrameTitle>
              <FrameDescription className="hidden text-xs sm:block">Jejak audit lintas tim</FrameDescription>
            </div>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/audit" />}>
              <ScrollText aria-hidden="true" />Log audit
            </Button>
          </FrameHeader>
          <FramePanel>{activity}</FramePanel>
        </Frame>
      </div>
      <Frame variant="ghost">
        <FramePanel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-foreground">Laporan lintas tim</p>
              <p className="hidden text-xs text-muted-foreground sm:block">Rekap lembur dan checklist seluruh tim.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/laporan?tab=lembur" />}>
              <ClipboardList aria-hidden="true" />Laporan lembur
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href="/laporan?tab=checklist" />}>
              <ClipboardCheck aria-hidden="true" />Laporan checklist
            </Button>
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
