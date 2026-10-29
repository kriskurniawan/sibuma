import Link from "next/link";
import {
  CalendarDays,
  Camera,
  ChevronRight,
  Hammer,
  HardHat,
  Plus,
} from "lucide-react";
import {
  ManualWorkOverdueBadge,
  ManualWorkSelfReportedBadge,
  ManualWorkStatusBadge,
} from "@/components/pekerjaan/manual-work-badges";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui";
import type {
  ManualWorkRow,
  ManualWorkTotals,
} from "@/lib/manual-work-types";
import { formatDateHuman } from "@/lib/time";

function dateIso(value: string) {
  return `${value}T00:00:00+07:00`;
}

export function ManualWorkSummary({
  items,
  totals,
  canManage,
  canAssign,
  readOnly,
}: {
  items: ManualWorkRow[];
  totals: ManualWorkTotals;
  canManage: boolean;
  canAssign: boolean;
  readOnly: boolean;
}) {
  return (
    <Frame spacing="sm">
      <FrameHeader className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <FrameTitle>Pekerjaan harian</FrameTitle>
          <FrameDescription>
            {totals.active > 0
              ? `${totals.active} aktif${totals.overdue > 0 ? ` · ${totals.overdue} terlambat` : ""}`
              : "Pekerjaan harian tim"}
          </FrameDescription>
        </div>
        <Link
          href="/pekerjaan"
          className="shrink-0 text-xs font-medium text-primary transition-colors hover:underline"
        >
          Semua
        </Link>
      </FrameHeader>
      <FramePanel className="flex flex-col justify-center">
        {items.length > 0 ? (
          <div className="flex flex-col divide-y divide-border/70">
            {items.map((row) => {
              const work = row.work;
              const first = row.assignees[0];
              return (
                <Link
                  key={work.id}
                  href={`/pekerjaan/${work.id}`}
                  className="group flex min-w-0 items-start gap-3 py-2.5 first:pt-0 last:pb-0 transition-colors hover:text-primary focus-visible:outline-none"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Hammer className="size-4" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="line-clamp-2 text-sm font-medium text-foreground group-hover:text-primary">
                      {work.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <CalendarDays
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {work.targetDate
                          ? formatDateHuman(
                              dateIso(work.targetDate),
                              "d MMM",
                            )
                          : "Tanpa target"}
                      </span>
                      {work.requiresDocumentation && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Camera
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          {row.photoCount}
                        </span>
                      )}
                      {first && <span className="truncate">{first.name}</span>}
                      {work.safetyName && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <HardHat
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="truncate">
                            Petugas safety {work.safetyName}
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <ManualWorkStatusBadge status={work.status} />
                      {row.overdue && <ManualWorkOverdueBadge />}
                      {row.selfReported && <ManualWorkSelfReportedBadge />}
                    </span>
                  </span>
                  <ChevronRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Hammer}
            title="Tidak ada pekerjaan aktif"
            description={
              canManage
                ? canAssign
                  ? "Buat pekerjaan harian dengan dokumentasi foto."
                  : "Catat pekerjaan yang kamu dan tim kerjakan; catatan langsung aktif."
                : readOnly
                  ? "Belum ada pekerjaan aktif untuk tim ini."
                  : "Penugasan baru akan muncul di sini."
            }
            action={
              canManage ? (
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/pekerjaan/baru" />}
                >
                  <Plus aria-hidden="true" />
                  {canAssign ? "Buat pekerjaan" : "Catat pekerjaan"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/pekerjaan" />}
                >
                  Lihat semua
                </Button>
              )
            }
          />
        )}
      </FramePanel>
    </Frame>
  );
}
