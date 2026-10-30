import Link from "next/link";
import { CalendarClock, ClipboardCheck, ClipboardList, LogIn } from "lucide-react";
import { ChecklistStatusBadge } from "@/components/checklist/checklist-badges";
import { Frame, FramePanel } from "@/components/reui/frame";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import type { ChecklistPublicStaffTask } from "@/lib/checklist-types";
import { formatDateHuman, formatDateTime } from "@/lib/time";

export interface PublicStaffState {
  loggedIn: boolean;
  name: string | null;
  canFill: boolean;
  tasks: ChecklistPublicStaffTask[];
}

export function PublicStaffAccess({
  staff,
  loginNext,
}: {
  staff: PublicStaffState;
  loginNext: string;
}) {
  return (
    <Frame spacing="default">
      <FramePanel className="flex min-w-0 flex-col gap-3">
        {!staff.loggedIn ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-foreground">Akses petugas</h2>
              <p className="text-xs text-muted-foreground">Masuk untuk melihat tugas Anda.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/login?next=${encodeURIComponent(loginNext)}`} />}
            >
              <LogIn aria-hidden="true" />
              Masuk petugas
            </Button>
          </div>
        ) : staff.tasks.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Tugas Anda</h2>
              <Badge variant="info-light">{staff.tasks.length} tugas aktif</Badge>
            </div>
            <ul className="flex flex-col gap-3">
              {staff.tasks.map((task) => (
                <li key={task.inspectionId} className="flex min-w-0 flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="wrap-anywhere text-sm font-medium text-foreground">{task.templateName}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {task.periodLabel} · {formatDateHuman(`${task.occurrenceDate}T12:00:00`, "d MMM yyyy")}
                      </span>
                      <ChecklistStatusBadge status={task.status} />
                    </div>
                    <p className="flex items-start gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
                      Batas {formatDateTime(task.dueAt, "d MMM yyyy, HH:mm")} WIB
                    </p>
                  </div>
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/checklist/${task.inspectionId}`} />}
                  >
                    <ClipboardList aria-hidden="true" />
                    Isi checklist
                  </Button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-foreground">Akses petugas</h2>
              <p className="text-xs text-muted-foreground">Tidak ada tugas aktif untuk Anda di area ini.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/checklist" />}
            >
              <ClipboardCheck aria-hidden="true" />
              Checklist saya
            </Button>
          </div>
        )}
      </FramePanel>
    </Frame>
  );
}
