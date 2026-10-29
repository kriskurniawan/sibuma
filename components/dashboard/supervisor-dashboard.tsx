import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
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
import { ManualWorkSummary } from "@/components/dashboard/manual-work-summary";
import { QrScanButton } from "@/components/checklist/qr-scanner";
import { MobileSummary } from "@/components/mobile-summary";
import { IconTile } from "@/components/reui/icon-tile";
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
import type {
  ManualWorkRow,
  ManualWorkTotals,
} from "@/lib/manual-work-types";
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
  manualWorks,
  manualWorkTotals,
}: {
  user: SessionUser;
  overview: SupervisorOverview;
  checklists: ChecklistInspectionRow[];
  checklistTotals: ChecklistTotals;
  followUps: ChecklistFollowUpRow[];
  openFollowUpTotal: number;
  manualWorks: ManualWorkRow[];
  manualWorkTotals: ManualWorkTotals;
}) {
  const firstName = user.name.split(" ")[0];
  const readOnly = isReadOnly(user);
  const nextSession = overview.upcoming[0];
  const focus = checklists[0];

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow={formatDateHuman(new Date().toISOString(), "EEEE, d MMMM yyyy")}
        title={`${greeting()}, ${firstName}.`}
        description="Pantau checklist operasional, temuan, dan kesiapan tim hari ini."
        descriptionClassName="hidden sm:block"
        action={
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
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

      <Frame spacing="sm" className="sm:hidden">
        <FramePanel className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <IconTile variant="soft" aria-hidden="true">
              <ClipboardCheck />
            </IconTile>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-xs font-medium text-muted-foreground">
                Perlu perhatian
              </p>
              <p className="text-sm font-semibold text-foreground">
                {checklistTotals.overdue > 0
                  ? `${checklistTotals.overdue} checklist terlambat`
                  : focus
                    ? "Checklist berikutnya"
                    : "Tidak ada checklist aktif"}
              </p>
              {focus && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {focus.inspection.templateName}
                </p>
              )}
            </div>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link
                href={
                  checklistTotals.overdue > 0
                    ? "/checklist?status=terlambat"
                    : focus
                      ? `/checklist/${focus.inspection.id}`
                      : "/checklist"
                }
              />
            }
          >
            {checklistTotals.overdue > 0 ? "Tinjau keterlambatan" : "Buka checklist"}
            <ArrowRight />
          </Button>
        </FramePanel>
      </Frame>

      <MobileSummary
        className="sm:hidden"
        items={[
          {
            label: "Checklist aktif",
            value: checklistTotals.todo,
            icon: ClipboardList,
            tone: "primary",
            href: "/checklist?status=aktif",
            ariaLabel: `Buka ${checklistTotals.todo} checklist aktif`,
          },
          {
            label: "Terlambat",
            value: checklistTotals.overdue,
            icon: AlertTriangle,
            tone: checklistTotals.overdue > 0 ? "destructive" : "neutral",
            href: "/checklist?status=terlambat",
            ariaLabel: `Buka ${checklistTotals.overdue} checklist terlambat`,
          },
          {
            label: "Tindak lanjut",
            value: checklistTotals.openFollowUps,
            icon: Wrench,
            tone: checklistTotals.openFollowUps > 0 ? "warning" : "neutral",
            href: "/checklist/tindak-lanjut",
            ariaLabel: `Buka tindak lanjut, ${checklistTotals.openFollowUps} belum selesai`,
          },
          {
            label: "Selesai bulan ini",
            value: checklistTotals.completedThisMonth,
            icon: CheckCircle2,
            tone: "success",
          },
        ]}
      />

      <section
        aria-label="Ringkasan checklist"
        className="hidden grid-cols-2 gap-3 sm:grid xl:grid-cols-4"
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
          tone={checklistTotals.overdue > 0 ? "destructive" : "neutral"}
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
          tone={checklistTotals.openFollowUps > 0 ? "warning" : "neutral"}
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

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr]">
        <Frame
          spacing="sm"
          className="order-1 min-w-0 sm:order-3 xl:col-start-2 xl:row-start-2"
        >
          <FrameHeader className="flex-row items-start justify-between gap-3">
            <FrameTitle>Jadwal lembur</FrameTitle>
            <Link
              href="/lembur"
              className="text-xs font-medium text-primary transition-colors hover:underline"
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
                      className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
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
                        className="shrink-0 self-start"
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
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
                  className="shrink-0 self-start"
                />
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Tidak ada lembur"
                description="Belum ada sesi aktif atau terjadwal."
                action={
                  readOnly ? (
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href="/lembur" />}
                    >
                      Lihat lembur
                    </Button>
                  ) : (
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

        <section className="order-2 flex min-w-0 flex-col gap-3 sm:order-1 xl:row-span-2">
          <Frame spacing="sm">
            <FrameHeader className="flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <FrameTitle>Checklist prioritas</FrameTitle>
                <FrameDescription className="hidden text-xs sm:block">
                  Diurutkan berdasarkan deadline.
                </FrameDescription>
              </div>
              <Link
                href="/checklist"
                className="text-xs font-medium text-primary transition-colors hover:underline"
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

        <Frame
          spacing="sm"
          className="order-3 min-w-0 sm:order-2 xl:col-start-2 xl:row-start-1"
        >
          <FrameHeader className="flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Tindak lanjut</FrameTitle>
              <FrameDescription className="text-xs">
                {openFollowUpTotal > 0
                  ? `${openFollowUpTotal} temuan terbuka`
                  : "Temuan dari checklist tim"}
              </FrameDescription>
            </div>
            <Link
              href="/checklist/tindak-lanjut"
              className="text-xs font-medium text-primary transition-colors hover:underline"
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
      </div>

      <ManualWorkSummary
        items={manualWorks}
        totals={manualWorkTotals}
        canManage={!readOnly}
        canAssign={!readOnly}
        readOnly={readOnly}
      />
    </div>
  );
}
