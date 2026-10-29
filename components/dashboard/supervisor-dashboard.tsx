import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Plus,
  Wrench,
} from "lucide-react";
import {
  ChecklistSummaryRow,
  FollowUpSummaryRow,
} from "@/components/dashboard/checklist-summary";
import { QrScanButton } from "@/components/checklist/qr-scanner";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import {
  Badge,
  EmptyState,
  PageHeader,
  SpklStatusBadge,
  StatCard,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type {
  ChecklistFollowUpRow,
  ChecklistInspectionRow,
  ChecklistTotals,
} from "@/lib/checklist-types";
import type { SupervisorOverview } from "@/lib/queries";
import { isReadOnly } from "@/lib/access";
import type { SessionUser } from "@/lib/types";
import { formatDateHuman, formatTime, greeting } from "@/lib/time";

export function SupervisorDashboard({
  user,
  overview,
  checklists,
  checklistTotals,
  followUps,
  openFollowUpTotal,
}: {
  user: SessionUser;
  overview: SupervisorOverview;
  checklists: ChecklistInspectionRow[];
  checklistTotals: ChecklistTotals;
  followUps: ChecklistFollowUpRow[];
  openFollowUpTotal: number;
}) {
  const firstName = user.name.split(" ")[0];
  const readOnly = isReadOnly(user);
  const nextSession = overview.upcoming[0];

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow={formatDateHuman(new Date().toISOString(), "EEEE, d MMMM yyyy")}
        title={`${greeting()}, ${firstName}.`}
        description="Pantau checklist operasional, temuan, dan kesiapan tim hari ini."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/checklist" />}
            >
              <ClipboardCheck />
              Buka checklist
            </Button>
            <QrScanButton className="hidden md:inline-flex" />
          </div>
        }
      />

      <section
        aria-label="Ringkasan checklist"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <StatCard
          label="Checklist aktif"
          value={checklistTotals.todo}
          suffix="checklist"
          icon={ClipboardList}
          helper={
            checklistTotals.overdue > 0 ? (
              <Badge variant="warning-light">
                {checklistTotals.overdue} terlambat
              </Badge>
            ) : (
              <Badge variant="success-light">Sesuai deadline</Badge>
            )
          }
        />
        <StatCard
          label="Terlambat"
          value={checklistTotals.overdue}
          suffix="checklist"
          icon={AlertTriangle}
          tone="warning"
          helper={
            checklistTotals.overdue > 0
              ? "Perlu diselesaikan segera"
              : "Tidak ada keterlambatan"
          }
        />
        <StatCard
          label="Tindak lanjut"
          value={checklistTotals.openFollowUps}
          suffix="temuan"
          icon={Wrench}
          tone="info"
          helper={
            checklistTotals.openFollowUps > 0
              ? "Temuan dari checklist tim"
              : "Tidak ada temuan terbuka"
          }
        />
        <StatCard
          label="Selesai bulan ini"
          value={checklistTotals.completedThisMonth}
          suffix="checklist"
          icon={CheckCircle2}
          tone="success"
          helper={`${overview.stats.teamCount} pekerja aktif`}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-3">
          <Frame spacing="sm">
            <FrameHeader className="flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <FrameTitle>Checklist prioritas</FrameTitle>
                <FrameDescription className="text-xs">
                  Paling dekat deadline dan perlu diselesaikan tim.
                </FrameDescription>
              </div>
              <Link
                href="/checklist"
                className="text-xs font-medium text-primary transition-colors hover:text-primary/70"
              >
                Semua
              </Link>
            </FrameHeader>
            <FramePanel className="flex flex-col justify-center">
              {checklists.length > 0 ? (
                checklists.map((row, index) => (
                  <div key={row.inspection.id}>
                    {index > 0 && <Separator />}
                    <ChecklistSummaryRow row={row} />
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={ClipboardList}
                  title="Tidak ada checklist aktif"
                  description="Checklist baru muncul otomatis sesuai jadwal yang dibuat."
                  action={
                    readOnly ? (
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href="/checklist" />}
                      >
                        Lihat checklist
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href="/checklist/jadwal" />}
                      >
                        Atur jadwal
                      </Button>
                    )
                  }
                />
              )}
            </FramePanel>
          </Frame>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <Frame spacing="sm">
            <FrameHeader className="flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <FrameTitle>Tindak lanjut</FrameTitle>
                <FrameDescription className="text-xs">
                  {openFollowUpTotal > 0
                    ? `${openFollowUpTotal} temuan terbuka`
                    : "Temuan dari checklist tim"}
                </FrameDescription>
              </div>
              <Link
                href="/checklist/tindak-lanjut"
                className="text-xs font-medium text-primary transition-colors hover:text-primary/70"
              >
                Semua
              </Link>
            </FrameHeader>
            <FramePanel className="flex flex-col justify-center">
              {followUps.length > 0 ? (
                followUps.map((row, index) => (
                  <div key={row.followUp.id}>
                    {index > 0 && <Separator />}
                    <FollowUpSummaryRow row={row} />
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="Tidak ada temuan terbuka"
                  description="Temuan baru dari checklist akan muncul di sini."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href="/checklist" />}
                    >
                      Lihat checklist
                    </Button>
                  }
                />
              )}
            </FramePanel>
          </Frame>

          <Frame spacing="sm">
            <FrameHeader className="flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <FrameTitle>Lembur hari ini</FrameTitle>
                <FrameDescription className="text-xs">
                  Sesi aktif dan jadwal terdekat.
                </FrameDescription>
              </div>
              <Link
                href="/lembur"
                className="text-xs font-medium text-primary transition-colors hover:text-primary/70"
              >
                {readOnly ? "Lihat" : "Kelola"}
              </Link>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              {overview.activeSpkls.length > 0 ? (
                <>
                  {overview.activeSpkls.slice(0, 2).map((spotlight) => {
                    const complete =
                      spotlight.expected > 0 &&
                      spotlight.checkedIn === spotlight.expected;
                    return (
                      <div
                        key={spotlight.spkl.id}
                        className="flex items-start justify-between gap-3"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <Link
                            href={`/spkl/${spotlight.spkl.id}`}
                            className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                          >
                            {spotlight.spkl.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(spotlight.spkl.startAt)}–
                            {formatTime(spotlight.spkl.endAt)} WIB ·{" "}
                            {spotlight.checkedIn}/{spotlight.expected} hadir
                          </p>
                        </div>
                        <Badge
                          variant={complete ? "success-light" : "warning-light"}
                          className="shrink-0"
                        >
                          {complete ? "Lengkap" : "Belum lengkap"}
                        </Badge>
                      </div>
                    );
                  })}
                  {overview.stats.needsAttention > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {overview.stats.needsAttention} pekerja belum melakukan
                      absen masuk.
                    </p>
                  )}
                </>
              ) : nextSession ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link
                      href={`/spkl/${nextSession.spkl.id}`}
                      className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {nextSession.spkl.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDateHuman(nextSession.spkl.startAt, "d MMM, HH:mm")}
                      –{formatTime(nextSession.spkl.endAt)} ·{" "}
                      {nextSession.workerCount} pekerja
                    </p>
                  </div>
                  <SpklStatusBadge
                    status="terjadwal"
                    className="shrink-0"
                  />
                </div>
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="Tidak ada lembur"
                  description="Belum ada sesi aktif atau terjadwal."
                  action={
                    readOnly ? undefined : (
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href="/spkl/baru" />}
                      >
                        <Plus />
                        Buat SPKL
                      </Button>
                    )
                  }
                />
              )}
            </FramePanel>
          </Frame>
        </aside>
      </div>
    </div>
  );
}
