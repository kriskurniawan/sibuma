import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FolderTree,
  History,
  ListChecks,
  LogIn,
  MapPin,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Badge, EmptyState, StatCard } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  ChecklistConditionBadge,
  ChecklistStatusBadge,
} from "@/components/checklist/checklist-badges";
import { PublicShell } from "@/components/checklist/public-shell";
import {
  CHECKLIST_STATUS_LABEL,
  type ChecklistConditionOption,
  type ChecklistPublicArea,
  type ChecklistPublicStaffTask,
} from "@/lib/checklist-types";
import { formatDateHuman, formatDateTime } from "@/lib/time";

export function PublicAreaDetail({
  qrName,
  area,
  staff,
  conditions,
  backHref,
  detailHref,
  loginNext,
}: {
  qrName: string;
  area: ChecklistPublicArea;
  staff: {
    loggedIn: boolean;
    name: string | null;
    canFill: boolean;
    tasks: ChecklistPublicStaffTask[];
  };
  conditions: ChecklistConditionOption[];
  backHref: string | null;
  detailHref: string;
  loginNext: string;
}) {
  const {
    location,
    latest,
    items,
    history,
    followUps,
    timeline,
    viewingHistory,
  } = area;

  const numberedItems = items.map((item, index) => ({
    item,
    number: index + 1,
  }));
  const itemBlocks: Array<{
    groupPath: string;
    entries: typeof numberedItems;
  }> = [];
  for (const entry of numberedItems) {
    const groupPath = entry.item.groupPath?.trim() ?? "";
    const last = itemBlocks.at(-1);
    if (last && last.groupPath === groupPath) {
      last.entries.push(entry);
    } else {
      itemBlocks.push({ groupPath, entries: [entry] });
    }
  }

  return (
    <PublicShell>
      {backHref && (
        <div>
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<Link href={backHref} />}
          >
            <ArrowLeft aria-hidden="true" />
            Semua area
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Checklist area
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {location.name}
          </h1>
          {latest && <ChecklistStatusBadge status={latest.status} />}
        </div>
        {location.parentName && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden="true" />
            {location.parentName} · {qrName}
          </p>
        )}
        {location.description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {location.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Progres item"
          value={
            latest ? `${latest.answeredCount}/${latest.totalItems}` : "—"
          }
          icon={ListChecks}
          helper="Item sudah diperiksa"
          tone="primary"
        />
        <StatCard
          label="Temuan"
          value={latest?.issueCount ?? 0}
          icon={TriangleAlert}
          helper="Perlu perhatian atau tidak baik"
          tone={latest && latest.issueCount > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Tindak lanjut"
          value={followUps.open}
          suffix="terbuka"
          icon={ClipboardCheck}
          helper={`${followUps.done} selesai`}
          tone={followUps.open > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Pembaruan"
          value={
            area.lastUpdated
              ? formatDateHuman(area.lastUpdated, "d MMM")
              : "—"
          }
          icon={Clock3}
          helper={
            area.lastUpdated
              ? `Terakhir ${formatDateTime(area.lastUpdated, "HH:mm")} WIB`
              : "Belum ada pembaruan"
          }
          tone="info"
        />
      </div>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Item yang dipublikasikan</FrameTitle>
            <FrameDescription className="text-xs">
              {latest
                ? `${latest.templateName} · ${latest.periodLabel}`
                : "Hasil pemeriksaan terbaru area ini"}
            </FrameDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {viewingHistory && (
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={detailHref} />}
              >
                <History aria-hidden="true" className="size-3.5" />
                Hasil terbaru
              </Button>
            )}
            {latest && (
              <Badge variant="outline">
                {formatDateHuman(
                  `${latest.occurrenceDate}T12:00:00`,
                  "d MMM yyyy",
                )}
              </Badge>
            )}
          </div>
        </FrameHeader>

        <FramePanel className="p-0">
          {!latest ? (
            <EmptyState
              icon={ClipboardList}
              title="Belum ada pemeriksaan"
              description="Hasil checklist akan tampil di sini setelah petugas memulai pemeriksaan."
            />
          ) : items.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
              Pengelola belum mempublikasikan item untuk pengunjung pada
              pemeriksaan ini.
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {itemBlocks.map((block, blockIndex) => (
                <section key={blockIndex}>
                  {block.groupPath && (
                    <div className="flex flex-wrap items-center gap-2 bg-muted/40 px-4 py-2.5 sm:px-5">
                      <FolderTree
                        className="size-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="text-xs font-semibold text-foreground">
                        {block.groupPath}
                      </p>
                      <Badge variant="outline">
                        {block.entries.length} item
                      </Badge>
                    </div>
                  )}
                  <ul className="divide-y divide-border/70">
                    {block.entries.map(({ item, number }) => (
                      <li
                        key={`${number}-${item.prompt}`}
                        className={
                          block.groupPath
                            ? "flex flex-col gap-2 border-l-2 border-border/70 py-3 pl-8 pr-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pl-12 sm:pr-5"
                            : "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5"
                        }
                      >
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span className="mt-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                            {String(number).padStart(2, "0")}
                          </span>
                          <p className="text-sm font-medium text-foreground">
                            {item.prompt}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 sm:pl-0">
                          {item.condition ? (
                            <ChecklistConditionBadge
                              condition={item.condition}
                              conditions={conditions}
                            />
                          ) : (
                            <Badge variant="outline">Belum diperiksa</Badge>
                          )}
                          {item.updatedAt && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatDateTime(item.updatedAt, "d MMM, HH:mm")}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </FramePanel>
      </Frame>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Frame>
          <FrameHeader>
            <div className="flex flex-col gap-0.5">
              <FrameTitle>Riwayat pemeriksaan</FrameTitle>
              <FrameDescription className="text-xs">
                Pilih periode untuk melihat item yang dipublikasikan.
              </FrameDescription>
            </div>
          </FrameHeader>
          <FramePanel className="p-0">
            {history.length === 0 ? (
              <div className="px-4 py-5 text-sm text-muted-foreground sm:px-5">
                Belum ada riwayat pemeriksaan.
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {history.map((entry) => {
                  const isSelected = latest?.inspectionId === entry.id;
                  return (
                    <li key={entry.id}>
                      <Link
                        href={`${detailHref}?inspection=${entry.id}`}
                        aria-current={isSelected ? "page" : undefined}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
                      >
                        <div className="flex min-w-0 items-start gap-2.5">
                          <History
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <div className="flex flex-col gap-0.5">
                            <p className="text-sm font-medium text-foreground">
                              {formatDateHuman(
                                `${entry.occurrenceDate}T12:00:00`,
                                "d MMMM yyyy",
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {entry.templateName} · {entry.periodLabel}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isSelected && (
                            <Badge variant="info-light">Ditampilkan</Badge>
                          )}
                          <ChecklistStatusBadge status={entry.status} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </FramePanel>
        </Frame>
          {timeline.length > 0 && (
            <Frame>
              <FrameHeader>
                <div className="flex flex-col gap-0.5">
                  <FrameTitle>Linimasa pemeriksaan</FrameTitle>
                  <FrameDescription className="text-xs">
                    Tanpa nama petugas dan tanpa catatan internal.
                  </FrameDescription>
                </div>
              </FrameHeader>
              <FramePanel className="p-0">
                <ul className="divide-y divide-border/70">
                  {timeline.map((entry, index) => (
                    <li
                      key={`${entry.at}-${index}`}
                      className="flex items-start gap-3 px-4 py-3 sm:px-5"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="text-sm font-medium text-foreground">
                          {entry.label}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatDateTime(entry.at, "d MMM yyyy, HH:mm")} WIB
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </FramePanel>
            </Frame>
          )}
      </div>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Akses petugas</FrameTitle>
            <FrameDescription className="text-xs">
              Hanya petugas yang ditugaskan pada area ini yang dapat mengisi.
            </FrameDescription>
          </div>
          <Badge variant="outline">
            <ShieldCheck aria-hidden="true" />
            Wajib masuk
          </Badge>
        </FrameHeader>
        <FramePanel>
          {!staff.loggedIn ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <ClipboardCheck
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    Masuk untuk membuka tugas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Scan QR tidak memberi izin akses. Sistem memeriksa penugasan
                    Anda setelah masuk.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={`/login?next=${encodeURIComponent(loginNext)}`}
                  />
                }
              >
                <LogIn aria-hidden="true" />
                Masuk sebagai petugas
              </Button>
            </div>
          ) : staff.tasks.length > 0 ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Masuk sebagai{" "}
                <span className="font-medium text-foreground">
                  {staff.name}
                </span>
                . Ada {staff.tasks.length} tugas terbuka untuk area ini.
              </p>
              <ul className="flex flex-col divide-y divide-border/70 rounded-lg border border-border/70">
                {staff.tasks.map((task) => (
                  <li
                    key={task.inspectionId}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {task.templateName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {task.periodLabel} ·{" "}
                        {formatDateHuman(
                          `${task.occurrenceDate}T12:00:00`,
                          "d MMM yyyy",
                        )}{" "}
                        · {CHECKLIST_STATUS_LABEL[task.status]}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock
                          className="size-3 shrink-0"
                          aria-hidden="true"
                        />
                        Deadline {formatDateTime(task.dueAt, "d MMM yyyy, HH:mm")}{" "}
                        WIB
                      </p>
                    </div>
                    <Button
                      size="sm"
                      nativeButton={false}
                      render={
                        <Link href={`/checklist/${task.inspectionId}`} />
                      }
                    >
                      <ClipboardList aria-hidden="true" />
                      Isi checklist
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Masuk sebagai{" "}
                <span className="font-medium text-foreground">
                  {staff.name}
                </span>
                . Tidak ada tugas aktif yang ditugaskan kepada Anda di area ini.
              </p>
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href="/checklist" />}
              >
                <ClipboardCheck aria-hidden="true" />
                Buka checklist saya
              </Button>
            </div>
          )}
        </FramePanel>
      </Frame>
    </PublicShell>
  );
}
