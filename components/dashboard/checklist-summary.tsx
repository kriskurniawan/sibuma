import Link from "next/link";
import { CalendarClock, ChevronRight, MapPin } from "lucide-react";
import {
  ChecklistFollowUpBadge,
  ChecklistOverdueBadge,
  ChecklistStatusBadge,
} from "@/components/checklist/checklist-badges";
import { Avatar, ProgressBar } from "@/components/ui";
import { formatDateHuman, formatDateTime } from "@/lib/time";
import {
  CHECKLIST_PRIORITY_LABEL,
  type ChecklistFollowUpRow,
  type ChecklistInspectionRow,
  type ChecklistPerson,
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
  const assignee = row.assignees[0];

  return (
    <Link
      href={`/checklist/${item.id}`}
      className="group flex min-w-0 flex-col gap-2 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-2 text-sm font-medium text-foreground">
            {item.templateName}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.locationName}</span>
          </span>
        </div>
        <ChecklistStatusBadge status={item.status} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Deadline </span>
          {formatDateTime(item.dueAt, "d MMM, HH:mm")}
        </span>
        {row.overdue && <ChecklistOverdueBadge />}
        {row.openFollowUps > 0 && (
          <span className="font-medium text-foreground tabular-nums">
            {row.openFollowUps} temuan
          </span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {row.answeredCount}/{row.totalItems}
            <span className="sr-only"> item terisi</span>
          </span>
          {row.totalItems > 0 && (
            <ProgressBar
              value={row.answeredCount}
              max={row.totalItems}
              tone={row.answeredCount === row.totalItems ? "success" : "primary"}
            />
          )}
        </div>
        <span className="inline-flex min-w-0 max-w-36 items-center gap-2 text-xs text-muted-foreground">
          {assignee ? (
            <>
              <Avatar name={assignee.name} seed={assignee.id} size="xs" />
              <span className="truncate">
                {assignee.name.split(" ")[0]}
                {row.assignees.length > 1 ? ` +${row.assignees.length - 1}` : ""}
              </span>
            </>
          ) : (
            "Tanpa anggota"
          )}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
    </Link>
  );
}

export function FollowUpSummaryRow({ row }: { row: ChecklistFollowUpRow }) {
  const followUp = row.followUp;

  return (
    <Link
      href={`/checklist/${row.inspection.id}`}
      className="group flex min-w-0 flex-col gap-2 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-2 text-sm font-medium text-foreground">
            {followUp.title}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{row.inspection.locationName}</span>
          </span>
        </div>
        <ChecklistFollowUpBadge status={followUp.status} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Deadline </span>
          {followUp.dueDate
            ? formatDateHuman(dateIso(followUp.dueDate), "d MMM yyyy")
            : "Tanpa deadline"}
        </span>
        {row.overdue && <ChecklistOverdueBadge />}
        <span>
          <span className="sr-only">Prioritas </span>
          {CHECKLIST_PRIORITY_LABEL[followUp.priority]}
        </span>
        {followUp.safetyName && (
          <span className="truncate">Petugas safety {followUp.safetyName}</span>
        )}
      </div>

      <div className="flex min-w-0 items-center justify-between gap-3">
        {row.pic ? (
          <span className="inline-flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Avatar name={row.pic.name} seed={row.pic.id} size="xs" />
            <span className="truncate">{row.pic.name}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Tanpa PIC</span>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
    </Link>
  );
}
