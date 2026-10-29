import Link from "next/link";
import { CalendarClock, MapPin, Wrench } from "lucide-react";
import {
  ChecklistFollowUpBadge,
  ChecklistOverdueBadge,
  ChecklistPriorityBadge,
  ChecklistStatusBadge,
} from "@/components/checklist/checklist-badges";
import { Avatar, ProgressBar } from "@/components/ui";
import { formatDateHuman, formatDateTime } from "@/lib/time";
import type {
  ChecklistFollowUpRow,
  ChecklistInspectionRow,
  ChecklistPerson,
} from "@/lib/checklist-types";

function dateIso(date: string) {
  return `${date}T00:00:00+07:00`;
}

export function ChecklistAssigneeStack({
  people,
  max = 4,
}: {
  people: ChecklistPerson[];
  max?: number;
}) {
  if (people.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">Belum ada anggota</span>
    );
  }

  const visible = people.slice(0, max);
  const remaining = people.length - visible.length;

  return (
    <div
      className="flex items-center"
      title={people.map((person) => person.name).join(", ")}
    >
      {visible.map((person, index) => (
        <span
          key={person.id}
          className={index > 0 ? "-ml-2 rounded-full" : "rounded-full"}
        >
          <Avatar
            name={person.name}
            seed={person.id}
            size="xs"
            className="ring-2 ring-card"
          />
        </span>
      ))}
      {remaining > 0 && (
        <span className="-ml-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-card">
          +{remaining}
        </span>
      )}
    </div>
  );
}

export function ChecklistSummaryRow({ row }: { row: ChecklistInspectionRow }) {
  const item = row.inspection;
  const progress =
    row.totalItems === 0
      ? 0
      : Math.round((row.answeredCount / row.totalItems) * 100);

  return (
    <Link
      href={`/checklist/${item.id}`}
      className="group flex flex-col gap-2.5 rounded-md px-1 py-2.5 transition-colors hover:bg-muted/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
            {item.templateName}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {item.category} · {item.periodLabel}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ChecklistStatusBadge status={item.status} />
          {row.overdue && <ChecklistOverdueBadge />}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.locationName}</span>
        </span>
        <span className="flex items-center gap-1">
          <CalendarClock className="size-3.5" aria-hidden="true" />
          {formatDateTime(item.dueAt, "d MMM, HH:mm")}
        </span>
        {row.openFollowUps > 0 && (
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Wrench className="size-3.5" aria-hidden="true" />
            {row.openFollowUps} temuan
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium tabular-nums text-foreground">
              {row.answeredCount}/{row.totalItems} item
            </span>
            <span className="tabular-nums text-muted-foreground">
              {progress}%
            </span>
          </div>
          <ProgressBar
            value={row.answeredCount}
            max={row.totalItems}
            tone={
              row.totalItems > 0 && row.answeredCount === row.totalItems
                ? "success"
                : "primary"
            }
          />
        </div>
        <ChecklistAssigneeStack people={row.assignees} max={3} />
      </div>
    </Link>
  );
}

export function FollowUpSummaryRow({ row }: { row: ChecklistFollowUpRow }) {
  const followUp = row.followUp;

  return (
    <Link
      href={`/checklist/${row.inspection.id}`}
      className="group flex flex-col gap-2 rounded-md px-1 py-2.5 transition-colors hover:bg-muted/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
            {followUp.title}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {row.inspection.templateName} · {row.inspection.locationName}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ChecklistPriorityBadge priority={followUp.priority} />
          <ChecklistFollowUpBadge status={followUp.status} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarClock className="size-3.5" aria-hidden="true" />
          {followUp.dueDate
            ? formatDateHuman(dateIso(followUp.dueDate), "d MMM yyyy")
            : "Tanpa deadline"}
        </span>
        {row.overdue && <ChecklistOverdueBadge />}
        {row.pic && (
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar name={row.pic.name} seed={row.pic.id} size="xs" />
            <span className="truncate">{row.pic.name}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
