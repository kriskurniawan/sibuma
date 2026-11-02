import Link from "next/link";
import {
  CalendarDays,
  Camera,
  ChevronRight,
  MapPin,
  TimerReset,
  UsersRound,
} from "lucide-react";
import {
  AttendanceBadge,
  Avatar,
  SpklStatusBadge,
} from "@/components/ui";
import { Frame, FramePanel } from "@/components/reui/frame";
import {
  currentTimeZoneLabel,
  durationLabel,
  formatDateHuman,
  formatTime,
} from "@/lib/time";
import type { SpklListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function SpklCardContent({
  item,
  context,
}: {
  item: SpklListItem;
  context: "worker" | "supervisor";
}) {
  const { spkl, status, workers, documentationCount, creator } = item;
  const attendance = item.myAttendance;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="line-clamp-2 text-sm font-semibold tracking-tight text-foreground">
            {spkl.title}
          </h3>
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {spkl.location.address || "Titik lokasi kerja"}
            </span>
          </span>
        </div>
        {attendance ? (
          <AttendanceBadge
            status={attendance.status}
            checkOutAt={attendance.checkOutAt}
          />
        ) : (
          <SpklStatusBadge status={status} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
          {formatDateHuman(spkl.startAt, "d MMM yyyy")}
        </span>
        <span className="tabular-nums">
          {formatTime(spkl.startAt)}–{formatTime(spkl.endAt)}{" "}
          {currentTimeZoneLabel()}
        </span>
        {attendance && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <TimerReset className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Durasi </span>
            {attendance.status === "ditutup_otomatis" &&
            !attendance.checkOutAt
              ? "Belum pulang"
              : durationLabel(attendance.durationMinutes)}
          </span>
        )}
        <span className="text-xs tabular-nums">{spkl.number}</span>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-3">
        {creator ? (
          <span className="inline-flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Avatar name={creator.name} seed={creator.id} size="xs" />
            <span className="truncate">
              <span className="sr-only">PIC </span>
              {creator.name}
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Tanpa PIC</span>
        )}
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
          {context !== "worker" && (
            <span className="inline-flex items-center gap-1">
              <UsersRound className="size-4" aria-hidden="true" />
              {workers.length}
              <span className="sr-only"> pekerja</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Camera className="size-4" aria-hidden="true" />
            {documentationCount}
            <span className="sr-only"> foto</span>
          </span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      </div>
    </>
  );
}

export function SpklCard({
  item,
  context = "worker",
  className,
}: {
  item: SpklListItem;
  context?: "worker" | "supervisor";
  className?: string;
}) {
  return (
    <Link
      href={`/spkl/${item.spkl.id}`}
      className={cn(
        "group flex min-w-0 flex-col focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        item.status === "dibatalkan" && "opacity-65",
        className,
      )}
    >
      <Frame spacing="default" className="flex-1">
        <FramePanel className="flex min-w-0 flex-col gap-2 transition-colors group-hover:bg-muted/40">
          <SpklCardContent item={item} context={context} />
        </FramePanel>
      </Frame>
    </Link>
  );
}

export function SpklListRow({
  item,
  context = "worker",
  className,
}: {
  item: SpklListItem;
  context?: "worker" | "supervisor";
  className?: string;
}) {
  return (
    <Link
      href={`/spkl/${item.spkl.id}`}
      className={cn(
        "group flex min-w-0 flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
        item.status === "dibatalkan" && "opacity-65",
        className,
      )}
    >
      <SpklCardContent item={item} context={context} />
    </Link>
  );
}
