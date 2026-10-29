import Link from "next/link";
import {
  AlertTriangle,
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
import { MobileSummary } from "@/components/mobile-summary";
import { IconTile } from "@/components/reui/icon-tile";
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
        description="Checklist area kerjamu hari ini, lengkap dengan deadline dan tindak lanjutnya."
        descriptionClassName="hidden sm:block"
        action={
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/checklist" />}
            >
              <ClipboardList />
              Semua checklist
            </Button>
            <QrScanButton className="hidden md:inline-flex" />
          </div>
        }
      />

      {focus && (
        <section aria-label="Fokus berikutnya">
          <Frame>
            <FrameHeader className="gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Fokus berikutnya
                </span>
                {focus.overdue ? (
                  <ChecklistOverdueBadge />
                ) : (
                  <ChecklistStatusBadge status={focus.inspection.status} />
                )}
              </div>
              <FrameTitle>
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
                  Deadline{" "}
                  {formatDateTime(
                    focus.inspection.dueAt,
                    "EEEE, d MMM · HH:mm",
                  )}
                </span>
              </FrameDescription>
            </FrameHeader>

            <FramePanel className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium tabular-nums text-foreground">
                    {focus.answeredCount}/{focus.totalItems} item
                  </p>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
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

      <MobileSummary
        className="sm:hidden"
        items={[
          {
            label: "Checklist aktif",
            value: checklistTotals.todo,
            icon: ClipboardList,
            href: "/checklist?status=aktif",
            ariaLabel: `Buka ${checklistTotals.todo} checklist aktif`,
          },
          {
            label: "Terlambat",
            value: checklistTotals.overdue,
            icon: AlertTriangle,
            href: "/checklist?status=terlambat",
            ariaLabel: `Buka ${checklistTotals.overdue} checklist terlambat`,
          },
          {
            label: "Selesai bulan ini",
            value: checklistTotals.completedThisMonth,
            icon: CheckCircle2,
          },
          {
            label: "Tindak lanjut saya",
            value: myFollowUpTotal,
            icon: Wrench,
            href: "/checklist/tindak-lanjut?mine=1",
            ariaLabel: `Buka tindak lanjut saya, ${myFollowUpTotal} belum selesai`,
          },
        ]}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr]">
        <Frame
          spacing="sm"
          className="order-1 min-w-0 sm:order-3 xl:col-start-2 xl:row-start-2"
        >
          <FrameHeader className="flex-row items-start justify-between gap-3">
            <FrameTitle>Jadwal lembur</FrameTitle>
            <Link
              href="/riwayat"
              className="text-xs font-medium text-primary transition-colors hover:text-primary/70"
            >
              Riwayat
            </Link>
          </FrameHeader>
          <FramePanel className="flex flex-col gap-3">
            {overtime ? (
              <div className="relative flex items-start gap-3">
                <IconTile variant="soft" aria-hidden="true">
                  <CalendarDays />
                </IconTile>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={`/spkl/${overtime.spkl.id}`}
                    className="line-clamp-2 text-sm font-medium text-foreground after:absolute after:inset-0 transition-colors hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    {overtime.spkl.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatDateHuman(overtime.spkl.startAt, "d MMM, HH:mm")}–
                    {formatTime(overtime.spkl.endAt)} WIB
                  </p>
                  <div>
                    <SpklStatusBadge status={overtime.status} />
                  </div>
                </div>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
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

        <section
          className={`${focus && queue.length === 0 ? "hidden sm:flex" : "flex"} order-2 min-w-0 flex-col gap-3 sm:order-1 xl:row-span-2`}
        >
          {focus ? (
            <Frame spacing="sm">
              <FrameHeader className="flex-row items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <FrameTitle>Antrean checklist</FrameTitle>
                  <FrameDescription className="hidden text-xs sm:block">
                    Pekerjaan aktif lainnya.
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

        <Frame
          spacing="sm"
          className="order-3 min-w-0 sm:order-2 xl:col-start-2 xl:row-start-1"
        >
          <FrameHeader className="flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
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
      </div>

      <section
        aria-label="Ringkasan checklist saya"
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
