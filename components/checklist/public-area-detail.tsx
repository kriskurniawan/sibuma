import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FolderTree,
  History,
  ListChecks,
  MapPin,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { MobileSummary } from "@/components/mobile-summary";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert";
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
import {
  PublicHistoryList,
  type PublicHistoryListItem,
} from "@/components/checklist/public-history-list";
import { PublicRefreshButton } from "@/components/checklist/public-refresh-button";
import { PublicSecondarySection } from "@/components/checklist/public-secondary-section";
import { PublicShell } from "@/components/checklist/public-shell";
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline";
import { ManualWorkStatusBadge } from "@/components/pekerjaan/manual-work-badges";
import { EquipmentActivityBadge } from "@/components/checklist/equipment-badges";
import {
  findChecklistCondition,
  formatEquipmentHourMeter,
  formatEquipmentQuantity,
  type ChecklistConditionOption,
  type ChecklistConditionTone,
  type ChecklistPublicArea,
} from "@/lib/checklist-types";
import { cn } from "@/lib/utils";
import { currentTimeZoneLabel, formatDateHuman, formatDateTime } from "@/lib/time";

const CONDITION_TONE_CLASS: Record<ChecklistConditionTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground/40",
};

export function PublicAreaDetail({
  qrName,
  area,
  loggedIn,
  conditions,
  backHref,
  detailHref,
  equipmentHref,
  loginNext,
}: {
  qrName: string;
  area: ChecklistPublicArea;
  loggedIn: boolean;
  conditions: ChecklistConditionOption[];
  backHref: string | null;
  detailHref: string;
  /** Basis URL detail peralatan; QR langsung tidak memakai segmen area. */
  equipmentHref: string;
  loginNext: string;
}) {
  const { location, latest, items, history, followUps, timeline, viewingHistory } = area;
  const manualWorks = area.manualWorks;
  const equipment = area.equipment;
  const timelineItems = timeline.slice().reverse();
  const ongoingEntry =
    history.find((entry) => entry.status === "berlangsung") ?? null;
  const progressValue =
    latest && latest.totalItems > 0
      ? `${latest.answeredCount}/${latest.totalItems}`
      : "—";
  const progressHelper = latest
    ? latest.totalItems === 0
      ? "Belum ada item publik"
      : latest.status === "dilewati"
        ? "Pemeriksaan dilewati"
        : "Item publik sudah diisi"
    : "Belum ada pemeriksaan";
  const issueHelper = !latest
    ? "Belum ada pemeriksaan"
    : latest.totalItems === 0
      ? "Belum ada item publik"
      : "Item publik bermasalah";

  const conditionCounts = new Map<
    string,
    { label: string; tone: ChecklistConditionTone; count: number }
  >();
  for (const item of items) {
    if (!item.condition) continue;
    const option = findChecklistCondition(conditions, item.condition);
    const key = option?.id ?? item.condition;
    const current = conditionCounts.get(key);
    if (current) {
      current.count += 1;
    } else {
      conditionCounts.set(key, {
        label: option?.label ?? item.condition,
        tone: option?.tone ?? "neutral",
        count: 1,
      });
    }
  }
  const uncheckedCount = items.filter((item) => !item.condition).length;
  const conditionSummary = [
    ...conditionCounts.values(),
    ...(uncheckedCount > 0
      ? [
          {
            label: "Belum diperiksa",
            tone: "neutral" as ChecklistConditionTone,
            count: uncheckedCount,
          },
        ]
      : []),
  ];
  const historyItems: PublicHistoryListItem[] = history.map((entry) => ({
    id: entry.id,
    href: `${detailHref}?inspection=${entry.id}`,
    dateLabel: formatDateHuman(`${entry.occurrenceDate}T12:00:00`, "d MMMM yyyy"),
    meta: `${entry.templateName} · ${entry.periodLabel}`,
    counts:
      entry.totalItems === 0
        ? "Belum ada item publik"
        : `${entry.answeredCount}/${entry.totalItems} item publik · ${entry.issueCount} temuan`,
    status: entry.status,
    selected: latest?.inspectionId === entry.id,
  }));

  const numberedItems = items.map((item, index) => ({ item, number: index + 1 }));
  const itemBlocks: Array<{ groupPath: string; entries: typeof numberedItems }> = [];
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
    <PublicShell backHref={backHref} loggedIn={loggedIn} loginNext={loginNext}>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="wrap-anywhere text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {location.name}
          </h1>
          {latest && <ChecklistStatusBadge status={latest.status} />}
        </div>
        <p className="flex min-w-0 items-start gap-1 text-xs text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span className="wrap-anywhere">
            {location.parentName ? `${location.parentName} · ${qrName}` : qrName}
          </span>
        </p>
        {location.description && (
          <p className="max-w-2xl wrap-anywhere text-sm text-muted-foreground">{location.description}</p>
        )}
      </div>

      {viewingHistory && latest && latest.status !== "berlangsung" && (
        <Alert variant="info">
          <History aria-hidden="true" />
          <AlertTitle>Hasil pemeriksaan sebelumnya</AlertTitle>
          <AlertDescription>
            {formatDateHuman(`${latest.occurrenceDate}T12:00:00`, "d MMMM yyyy")} · {latest.templateName} · {latest.periodLabel}.{" "}
            {ongoingEntry
              ? "Ada pemeriksaan yang masih berlangsung."
              : "Hasil ini bukan kondisi terbaru."}
          </AlertDescription>
          <AlertAction className="flex-wrap">
            {ongoingEntry && (
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={`${detailHref}?inspection=${ongoingEntry.id}`} />}
              >
                Lihat yang berlangsung
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={detailHref} />}
            >
              Hasil terbaru
            </Button>
          </AlertAction>
        </Alert>
      )}

      {latest?.status === "berlangsung" && (
        <Alert variant="warning">
          <Clock3 aria-hidden="true" />
          <AlertTitle>Pemeriksaan masih berlangsung</AlertTitle>
          <AlertDescription>
            Hasil dapat berubah sampai pemeriksaan selesai.
          </AlertDescription>
          {viewingHistory && (
            <AlertAction>
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={detailHref} />}
              >
                Hasil terbaru
              </Button>
            </AlertAction>
          )}
        </Alert>
      )}

      {!viewingHistory && latest?.status !== "berlangsung" && ongoingEntry && (
        <Alert variant="warning">
          <Clock3 aria-hidden="true" />
          <AlertTitle>Ada pemeriksaan berlangsung</AlertTitle>
          <AlertDescription>
            {formatDateHuman(`${ongoingEntry.occurrenceDate}T12:00:00`, "d MMMM yyyy")} · {ongoingEntry.templateName} · {ongoingEntry.periodLabel}. Hasil yang ditampilkan adalah pemeriksaan terbaru yang sudah memiliki hasil.
          </AlertDescription>
          <AlertAction>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`${detailHref}?inspection=${ongoingEntry.id}`} />}
            >
              Lihat pemeriksaan
            </Button>
          </AlertAction>
        </Alert>
      )}

      <MobileSummary
        className="md:hidden"
        items={[
          { label: "Progres item", value: progressValue, icon: ListChecks, tone: "primary" },
          { label: "Temuan", value: latest?.issueCount ?? 0, icon: TriangleAlert, tone: latest && latest.issueCount > 0 ? "warning" : "neutral" },
          { label: "Tindak lanjut area", value: followUps.open, icon: ClipboardCheck, tone: followUps.open > 0 ? "warning" : "neutral" },
          { label: "Pembaruan item", value: area.lastUpdated ? formatDateHuman(area.lastUpdated, "d MMM") : "—", icon: Clock3, tone: "info" },
        ]}
      />

      <div className="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-4">
        <StatCard label="Progres item" value={progressValue} icon={ListChecks} helper={progressHelper} tone="primary" />
        <StatCard label="Temuan" value={latest?.issueCount ?? 0} icon={TriangleAlert} helper={issueHelper} tone={latest && latest.issueCount > 0 ? "warning" : "neutral"} />
        <StatCard label="Tindak lanjut area" value={followUps.open} suffix="terbuka" icon={ClipboardCheck} helper={`${followUps.done} selesai · semua periode`} tone={followUps.open > 0 ? "warning" : "neutral"} />
        <StatCard label="Pembaruan item" value={area.lastUpdated ? formatDateHuman(area.lastUpdated, "d MMM") : "—"} icon={Clock3} helper={area.lastUpdated ? `Pemeriksaan ini · ${formatDateTime(area.lastUpdated, "HH:mm")} ${currentTimeZoneLabel()}` : "Belum ada pembaruan item publik"} tone="info" />
      </div>

      <Frame spacing="default">
        <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle><h2>Hasil checklist</h2></FrameTitle>
            <FrameDescription className="wrap-anywhere text-xs">
              {latest ? `${latest.templateName} · ${latest.periodLabel}` : "Item yang dipublikasikan"}
            </FrameDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {latest && (
              <Badge variant="outline">{formatDateHuman(`${latest.occurrenceDate}T12:00:00`, "d MMM yyyy")}</Badge>
            )}
          </div>
        </FrameHeader>
        <FramePanel>
          {!latest ? (
            <EmptyState icon={ClipboardList} title="Belum ada pemeriksaan" description="Hasil akan tampil setelah petugas memulai pemeriksaan." action={<PublicRefreshButton />} />
          ) : items.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Belum ada item publik" description="Pengelola belum mempublikasikan item pemeriksaan ini." action={<PublicRefreshButton />} />
          ) : (
            <div className="flex min-w-0 flex-col gap-4">
              <section
                aria-label="Ringkasan kondisi item publik"
                className="flex min-w-0 flex-col gap-2 border-b border-border pb-4"
              >
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    Ringkasan kondisi item publik
                  </h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {items.length} item
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  {conditionSummary.map((entry, index) => (
                    <span
                      key={`${entry.label}-${index}`}
                      className={CONDITION_TONE_CLASS[entry.tone]}
                      style={{ width: `${(entry.count / items.length) * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  {conditionSummary.map((entry, index) => (
                    <li
                      key={`${entry.label}-${index}`}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          CONDITION_TONE_CLASS[entry.tone],
                        )}
                      />
                      <span className="font-medium text-foreground tabular-nums">
                        {entry.count}
                      </span>
                      <span className="text-muted-foreground">{entry.label}</span>
                    </li>
                  ))}
                </ul>
              </section>
              {itemBlocks.map((block, blockIndex) => (
                <section key={blockIndex} className="flex min-w-0 flex-col gap-2">
                  {block.groupPath && (
                    <div className="flex min-w-0 items-start gap-2">
                      <FolderTree className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <h3 className="min-w-0 flex-1 wrap-anywhere text-xs font-semibold text-foreground">{block.groupPath}</h3>
                      <Badge variant="outline" className="shrink-0">{block.entries.length} item</Badge>
                    </div>
                  )}
                  <ul className="divide-y divide-border">
                    {block.entries.map(({ item, number }) => (
                      <li key={`${number}-${item.prompt}`} className="flex min-w-0 items-start gap-2 py-3">
                        <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{String(number).padStart(2, "0")}</span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <p className="min-w-0 flex-1 wrap-anywhere text-sm font-medium text-foreground">{item.prompt}</p>
                          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:max-w-60 sm:justify-end">
                            {item.condition ? <ChecklistConditionBadge condition={item.condition} conditions={conditions} /> : <Badge variant="primary-light">Belum diperiksa</Badge>}
                            {item.updatedAt && <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(item.updatedAt, "d MMM, HH:mm")} {currentTimeZoneLabel()}</span>}
                          </div>
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

      {equipment.length > 0 && (
        <Frame spacing="default">
          <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <FrameTitle><h2>Peralatan &amp; perawatan</h2></FrameTitle>
              <FrameDescription className="wrap-anywhere text-xs">
                Riwayat terakhir per komponen. Identitas petugas tidak
                ditampilkan.
              </FrameDescription>
            </div>
            <Badge variant="outline">{equipment.length} peralatan</Badge>
          </FrameHeader>
          <FramePanel className="p-0">
            <ul className="divide-y divide-border">
              {equipment.map((item) => (
                <li
                  key={item.id}
                  className="flex min-w-0 flex-col gap-3 px-4 py-4 sm:px-5"
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <p className="min-w-0 wrap-anywhere text-sm font-medium text-foreground">
                          {item.name}
                        </p>
                        <Badge variant="outline">{item.code}</Badge>
                        {item.category && (
                          <span className="text-xs text-muted-foreground">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {item.maintenanceCount} catatan perawatan
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      nativeButton={false}
                      render={
                        <Link
                          href={`${equipmentHref}/${item.id}`}
                          aria-label={`Lihat riwayat ${item.name}`}
                        />
                      }
                    >
                      Lihat riwayat
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </div>

                  {item.summary.length > 0 ? (
                    <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-1.5">
                      {item.summary.map((entry) => {
                        const quantity = formatEquipmentQuantity(
                          entry.quantity,
                          entry.unit,
                        );
                        const hourMeter = formatEquipmentHourMeter(
                          entry.hourMeter,
                        );
                        return (
                          <li
                            key={entry.component}
                            className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs"
                          >
                            <span className="font-medium text-foreground">
                              {entry.component}
                            </span>
                            {quantity && (
                              <span className="text-muted-foreground">
                                {quantity}
                              </span>
                            )}
                            {hourMeter && (
                              <span className="text-muted-foreground tabular-nums">
                                {hourMeter}
                              </span>
                            )}
                            <span className="text-muted-foreground tabular-nums">
                              {formatDateHuman(
                                `${entry.performedDate}T12:00:00`,
                                "d MMM",
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Belum ada riwayat perawatan.
                    </p>
                  )}

                  {item.history.length > 0 && (
                    <ul className="flex min-w-0 flex-col gap-1.5 border-t border-border/70 pt-2">
                      {item.history.slice(0, 2).map((entry) => {
                        const quantity = formatEquipmentQuantity(
                          entry.quantity,
                          entry.unit,
                        );
                        return (
                          <li
                            key={entry.id}
                            className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground"
                          >
                            <EquipmentActivityBadge
                              activity={entry.activity}
                            />
                            <span className="font-medium text-foreground">
                              {entry.component}
                            </span>
                            {quantity && <span>{quantity}</span>}
                            <span className="tabular-nums">
                              {formatDateHuman(
                                `${entry.performedDate}T12:00:00`,
                                "d MMM yyyy",
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </FramePanel>
        </Frame>
      )}

      {manualWorks.length > 0 && (
        <Frame spacing="default">
          <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <FrameTitle><h2>Pekerjaan harian</h2></FrameTitle>
              <FrameDescription className="wrap-anywhere text-xs">
                Pekerjaan yang dibagikan pengelola area ini.
              </FrameDescription>
            </div>
            <Badge variant="outline">{manualWorks.length} pekerjaan</Badge>
          </FrameHeader>
          <FramePanel>
            <ul className="divide-y divide-border">
              {manualWorks.map((work) => {
                const schedule = work.targetDate
                  ? `${formatDateHuman(`${work.startDate}T12:00:00`, "d MMM")} – ${formatDateHuman(`${work.targetDate}T12:00:00`, "d MMM")}`
                  : `Mulai ${formatDateHuman(`${work.startDate}T12:00:00`, "d MMM")}`;
                return (
                  <li
                    key={work.id}
                    className="flex min-w-0 flex-col gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 wrap-anywhere text-sm font-medium text-foreground">
                        {work.title}
                      </p>
                      <ManualWorkStatusBadge status={work.status} />
                    </div>
                    {work.description && (
                      <p className="wrap-anywhere whitespace-pre-line text-sm text-muted-foreground">
                        {work.description}
                      </p>
                    )}
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                        {schedule}
                      </span>
                      {work.status === "selesai" && work.completedAt && (
                        <span className="tabular-nums">
                          Selesai {formatDateHuman(work.completedAt, "d MMM yyyy")}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </FramePanel>
        </Frame>
      )}

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-5">
        <PublicSecondarySection
          className="lg:col-span-2"
          title="Riwayat pemeriksaan"
          description={
            history.length === 0
              ? "Belum ada pemeriksaan"
              : `${history.length} pemeriksaan terakhir`
          }
        >
          {history.length === 0 ? (
            <EmptyState icon={History} title="Belum ada riwayat" description="Pemeriksaan yang sudah dimulai akan tampil di sini." action={<PublicRefreshButton />} />
          ) : (
            <PublicHistoryList items={historyItems} />
          )}
        </PublicSecondarySection>

        <PublicSecondarySection
          className="lg:col-span-3"
          title="Linimasa pemeriksaan"
          description="Aktivitas tanpa identitas petugas"
        >
          {timelineItems.length === 0 ? (
            <EmptyState icon={Clock3} title="Belum ada aktivitas" description="Aktivitas pemeriksaan akan tampil di sini." action={<PublicRefreshButton />} />
          ) : (
            <div
              role="region"
              aria-label="Linimasa pemeriksaan"
              tabIndex={0}
              className="min-w-0 overflow-x-auto overscroll-x-contain pb-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <Timeline
                value={timelineItems.length}
                orientation="horizontal"
                className="min-w-full"
              >
                {timelineItems.map((entry, index) => (
                  <TimelineItem
                    key={`${entry.at}-${index}`}
                    step={index + 1}
                    className="min-w-40 group-data-[orientation=horizontal]/timeline:mt-0"
                  >
                    <TimelineHeader>
                      <TimelineSeparator className="group-data-[orientation=horizontal]/timeline:top-8" />
                      <TimelineDate
                        dateTime={entry.at}
                        className="mb-10 whitespace-nowrap"
                      >
                        {formatDateHuman(entry.at, "d MMM yyyy")}
                      </TimelineDate>
                      <TimelineTitle className="wrap-anywhere">{entry.label}</TimelineTitle>
                      <TimelineIndicator className="group-data-[orientation=horizontal]/timeline:top-8" />
                    </TimelineHeader>
                    <TimelineContent className="text-xs tabular-nums">
                      {formatDateTime(entry.at, "HH:mm")} {currentTimeZoneLabel()}
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            </div>
          )}
        </PublicSecondarySection>
      </div>
    </PublicShell>
  );
}
