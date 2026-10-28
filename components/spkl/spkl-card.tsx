import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Camera,
  MapPin,
  UsersRound,
} from "lucide-react";
import { Badge, AvatarStack, SpklStatusBadge } from "@/components/ui";
import { Frame, FrameFooter, FrameHeader } from "@/components/reui/frame";
import { dayLabel, formatTime } from "@/lib/time";
import type { SpklListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SpklCard({
  item,
  context = "worker",
  className,
}: {
  item: SpklListItem;
  context?: "worker" | "supervisor";
  className?: string;
}) {
  const { spkl, status, workers, documentationCount } = item;
  const attendance = item.myAttendance;

  return (
    <Link
      href={`/spkl/${spkl.id}`}
      className={cn(
        "group flex min-w-0 flex-col focus-visible:outline-none",
        status === "dibatalkan" && "opacity-65",
        className,
      )}
    >
      <Frame
        spacing="sm"
        className="flex-1 gap-0 transition-colors group-hover:border-primary/40 group-focus-visible:border-primary"
      >
        <FrameHeader className="gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <SpklStatusBadge status={status} />
              {context === "worker" && attendance?.status === "berjalan" && (
                <Badge variant="warning-light" dot>
                  Sesi aktif
                </Badge>
              )}
              {context === "worker" && item.canCheckIn && !attendance && (
                <Badge variant="warning-light" dot>
                  {status === "terjadwal" ? "Absen dibuka" : "Belum absen"}
                </Badge>
              )}
              {context === "supervisor" &&
                status === "berlangsung" &&
                workers.length > 0 && (
                  <Badge variant="outline">{workers.length} pekerja</Badge>
                )}
            </div>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <ArrowUpRight className="size-3.5" />
            </span>
          </div>

          <p className="text-xs font-medium text-muted-foreground">
            {spkl.number}
          </p>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-foreground sm:text-base">
            {spkl.title}
          </h3>

          <div className="grid gap-1.5 text-xs font-medium text-muted-foreground sm:grid-cols-2">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" />
              {dayLabel(spkl.startAt)}, {formatTime(spkl.startAt)}–
              {formatTime(spkl.endAt)}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 sm:justify-end">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">
                {spkl.location.address || "Titik lokasi kerja"}
              </span>
            </span>
          </div>
        </FrameHeader>

        <FrameFooter className="mt-auto flex-row items-center justify-between gap-3 border-t border-border/70">
          <div className="flex min-w-0 items-center gap-2">
            <AvatarStack employees={workers} max={3} size="xs" />
            <span className="truncate text-xs font-medium text-muted-foreground">
              {context === "worker"
                ? `${workers
                    .filter((worker) => worker.id !== item.creator?.id)
                    .slice(0, 3)
                    .map((worker) => worker.name.split(" ")[0])
                    .join(", ")}${
                    workers.length > 3 ? ` +${workers.length - 3}` : ""
                  }`
                : `${workers.length} pekerja ditugaskan`}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Camera className="size-3.5" />
              {documentationCount}
            </span>
            {context === "supervisor" && (
              <span className="hidden items-center gap-1 sm:flex">
                <UsersRound className="size-3.5" />
                {workers.length}
              </span>
            )}
          </div>
        </FrameFooter>
      </Frame>
    </Link>
  );
}
