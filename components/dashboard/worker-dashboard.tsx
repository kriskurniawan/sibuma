import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  MapPin,
  Wrench,
} from "lucide-react";
import {
  ChecklistAssigneeStack,
  ChecklistSummaryRow,
  FollowUpSummaryRow,
} from "@/components/dashboard/checklist-summary";
import { QrScanButton } from "@/components/checklist/qr-scanner";
import {
  ChecklistOverdueBadge,
  ChecklistStatusBadge,
} from "@/components/checklist/checklist-badges";
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
  ProgressBar,
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
import type { WorkerOverview } from "@/lib/queries";
import type { SessionUser } from "@/lib/types";
import {
  formatDateHuman,
  formatDateTime,
  formatTime,
  greeting,
} from "@/lib/time";

export function WorkerDashboard({
  user,
  overview,
  checklists,
  checklistTotals,
  followUps,
  myFollowUpTotal,
}: {
  user: SessionUser;
  overview: WorkerOverview;
  checklists: ChecklistInspectionRow[];
  checklistTotals: ChecklistTotals;
  followUps: ChecklistFollowUpRow[];
  myFollowUpTotal: number;
}) {
  const firstName = user.name.split(" ")[0];
  const focus =
    checklists.find((row) => row.overdue) ??
    checklists.find((row) => row.inspection.status === "berlangsung") ??
    checklists[0] ??
    null;
  const queue = focus
    ? checklists.filter((row) => row.inspection.id !== focus.inspection.id)
    : [];
  const progress =
    focus && focus.totalItems > 0
      ? Math.round((focus.answeredCount / focus.totalItems) * 100)
      : 0;
  const overtime = overview.activeItem ?? overview.nextItem;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow={formatDateHuman(new Date().toISOString(), "EEEE, d MMMM yyyy")}
        title={`${greeting()}, ${firstName}.`}
        description="Checklist area kerjamu hari ini, lengkap dengan tenggat dan tindak lanjutnya."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/checklist" />}
            >
              <ClipboardList />
              Semua checklist
            </Button>
            <QrScanButton />
          </div>
        }
      />

      {focus && (
        <section aria-label="Checklist berikutnya">
          <Frame>
            <FrameHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <ChecklistStatusBadge status={focus.inspection.status} />
                {focus.overdue && <ChecklistOverdueBadge />}
                <span className="text-xs font-medium text-muted-foreground">
                  {focus.inspection.category} · {focus.inspection.periodLabel}
                </span>
              </div>
              <FrameTitle className="max-w-2xl text-lg font-semibold tracking-tight sm:text-xl">
                <Link
                  href={`/checklist/${focus.inspection.id}`}
                  className="transition-colors hover:text-primary/70"
                >
                  {focus.inspection.templateName}
                </Link>
              </FrameTitle>
              <FrameDescription className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                <span className="flex min-w-0 items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {focus.inspection.locationName}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  Tenggat{" "}
                  {formatDateTime(
                    focus.inspection.dueAt,
                    "EEEE, d MMM · HH:mm",
                  )}
                </span>
              </FrameDescription>
            </FrameHeader>

            <FramePanel className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-end justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Progres pengisian
                    </p>
                    <p className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
                      {focus.answeredCount}
                      <span className="text-base font-normal text-muted-foreground">
                        /{focus.totalItems}
                      </span>
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-muted-foreground">
                    {progress}%
                  </span>
                </div>
                <ProgressBar
                  value={focus.answeredCount}
                  max={focus.totalItems}
                  tone={
                    focus.totalItems > 0 &&
                    focus.answeredCount === focus.totalItems
                      ? "success"
                      : "primary"
                  }
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ChecklistAssigneeStack people={focus.assignees} max={4} />
                  <span className="truncate text-xs text-muted-foreground">
                    {focus.assignees.length > 0
                      ? `${focus.assignees.length} anggota`
                      : "Tanpa anggota"}
                    {focus.openFollowUps > 0
                      ? ` · ${focus.openFollowUps} temuan`
                      : ""}
                  </span>
                </div>
                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  nativeButton={false}
                  render={<Link href={`/checklist/${focus.inspection.id}`} />}
                >
                  {focus.answeredCount > 0
                    ? "Lanjutkan checklist"
                    : "Mulai checklist"}
                  <ArrowRight />
                </Button>
              </div>
            </FramePanel>
          </Frame>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-3">
          {focus ? (
            <Frame spacing="sm">
              <FrameHeader className="flex-row items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <FrameTitle>Antrean checklist</FrameTitle>
                  <FrameDescription className="text-xs">
                    Checklist aktif lain yang menunggu dikerjakan.
                  </FrameDescription>
                </div>
                {checklists.length > 1 && (
                  <Link
                    href="/checklist"
                    className="text-xs font-medium text-primary transition-colors hover:text-primary/70"
                  >
                    Semua
                  </Link>
                )}
              </FrameHeader>
              <FramePanel className="flex flex-col justify-center">
                {queue.length > 0 ? (
                  queue.map((row, index) => (
                    <div key={row.inspection.id}>
                      {index > 0 && <Separator />}
                      <ChecklistSummaryRow row={row} />
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={ClipboardCheck}
                    title="Tidak ada checklist lain"
                    description="Semua checklist aktifmu sudah tampil di atas."
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href="/checklist?status=selesai" />}
                      >
                        Lihat checklist selesai
                      </Button>
                    }
                  />
                )}
              </FramePanel>
            </Frame>
          ) : (
            <Frame>
              <FramePanel>
                <EmptyState
                  icon={ClipboardList}
                  title="Tidak ada checklist aktif"
                  description="Checklist baru muncul otomatis sesuai jadwal area kerjamu."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href="/checklist?status=selesai" />}
                    >
                      Lihat checklist selesai
                    </Button>
                  }
                />
              </FramePanel>
            </Frame>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <Frame spacing="sm">
            <FrameHeader className="flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <FrameTitle>Tindak lanjut saya</FrameTitle>
                <FrameDescription className="text-xs">
                  {myFollowUpTotal > 0
                    ? `${myFollowUpTotal} temuan terbuka`
                    : "Temuan yang ditugaskan kepadamu"}
                </FrameDescription>
              </div>
              <Link
                href="/checklist/tindak-lanjut?mine=1"
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
                  title="Tidak ada tindak lanjut"
                  description="Temuan baru yang ditugaskan akan muncul di sini."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href="/checklist?status=selesai" />}
                    >
                      Lihat checklist selesai
                    </Button>
                  }
                />
              )}
            </FramePanel>
          </Frame>

          <Frame spacing="sm">
            <FrameHeader className="flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <FrameTitle>Jadwal lembur</FrameTitle>
                <FrameDescription className="text-xs">
                  Sesi aktif atau jadwal berikutnya.
                </FrameDescription>
              </div>
              <Link
                href="/riwayat"
                className="text-xs font-medium text-primary transition-colors hover:text-primary/70"
              >
                Riwayat
              </Link>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              {overtime ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link
                      href={`/spkl/${overtime.spkl.id}`}
                      className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {overtime.spkl.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDateHuman(overtime.spkl.startAt, "d MMM")} ·{" "}
                      {formatTime(overtime.spkl.startAt)}–
                      {formatTime(overtime.spkl.endAt)} WIB
                    </p>
                  </div>
                  <SpklStatusBadge
                    status={overtime.status}
                    className="shrink-0"
                  />
                </div>
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="Tidak ada jadwal lembur"
                  description="Penugasan baru dari atasan akan muncul di sini."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href="/riwayat" />}
                    >
                      Lihat riwayat
                    </Button>
                  }
                />
              )}
            </FramePanel>
          </Frame>
        </aside>
      </div>

      <section
        aria-label="Ringkasan checklist saya"
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
              <Badge variant="success-light">Sesuai tenggat</Badge>
            )
          }
        />
        <StatCard
          label="Terlambat"
          value={checklistTotals.overdue}
          suffix="checklist"
          icon={CalendarClock}
          tone="warning"
          helper={
            checklistTotals.overdue > 0
              ? "Selesaikan secepatnya"
              : "Tidak ada keterlambatan"
          }
        />
        <StatCard
          label="Selesai bulan ini"
          value={checklistTotals.completedThisMonth}
          suffix="checklist"
          icon={CheckCircle2}
          tone="success"
          helper="Sejak awal bulan"
        />
        <StatCard
          label="Tindak lanjut saya"
          value={myFollowUpTotal}
          suffix="temuan"
          icon={Wrench}
          tone="info"
          helper={
            myFollowUpTotal > 0
              ? "Ditugaskan kepadamu"
              : "Tidak ada tugas terbuka"
          }
        />
      </section>
    </div>
  );
}
