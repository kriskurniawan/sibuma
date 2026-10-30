import Link from "next/link";
import {
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FolderTree,
  History,
  ListChecks,
  MapPin,
  TriangleAlert,
} from "lucide-react";
import { MobileSummary } from "@/components/mobile-summary";
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
import { PublicRefreshButton } from "@/components/checklist/public-refresh-button";
import { PublicSecondarySection } from "@/components/checklist/public-secondary-section";
import { PublicShell } from "@/components/checklist/public-shell";
import { PublicStaffAccess, type PublicStaffState } from "@/components/checklist/public-staff-access";
import type { ChecklistConditionOption, ChecklistPublicArea } from "@/lib/checklist-types";
import { cn } from "@/lib/utils";
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
  staff: PublicStaffState;
  conditions: ChecklistConditionOption[];
  backHref: string | null;
  detailHref: string;
  loginNext: string;
}) {
  const { location, latest, items, history, followUps, timeline, viewingHistory } = area;
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
    <PublicShell backHref={backHref}>
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

      <MobileSummary
        className="md:hidden"
        items={[
          { label: "Progres item", value: latest ? `${latest.answeredCount}/${latest.totalItems}` : "—", icon: ListChecks, tone: "primary" },
          { label: "Temuan", value: latest?.issueCount ?? 0, icon: TriangleAlert, tone: latest && latest.issueCount > 0 ? "warning" : "neutral" },
          { label: "Tindak lanjut terbuka", value: followUps.open, icon: ClipboardCheck, tone: followUps.open > 0 ? "warning" : "neutral" },
          { label: "Pembaruan", value: area.lastUpdated ? formatDateHuman(area.lastUpdated, "d MMM") : "—", icon: Clock3, tone: "info" },
        ]}
      />

      <div className="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-4">
        <StatCard label="Progres item" value={latest ? `${latest.answeredCount}/${latest.totalItems}` : "—"} icon={ListChecks} helper="Item sudah diperiksa" tone="primary" />
        <StatCard label="Temuan" value={latest?.issueCount ?? 0} icon={TriangleAlert} helper="Perlu perhatian atau tidak baik" tone={latest && latest.issueCount > 0 ? "warning" : "neutral"} />
        <StatCard label="Tindak lanjut" value={followUps.open} suffix="terbuka" icon={ClipboardCheck} helper={`${followUps.done} selesai`} tone={followUps.open > 0 ? "warning" : "neutral"} />
        <StatCard label="Pembaruan" value={area.lastUpdated ? formatDateHuman(area.lastUpdated, "d MMM") : "—"} icon={Clock3} helper={area.lastUpdated ? `Terakhir ${formatDateTime(area.lastUpdated, "HH:mm")} WIB` : "Belum ada pembaruan"} tone="info" />
      </div>

      <PublicStaffAccess staff={staff} loginNext={loginNext} />

      <Frame spacing="default">
        <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle><h2>Hasil checklist</h2></FrameTitle>
            <FrameDescription className="wrap-anywhere text-xs">
              {latest ? `${latest.templateName} · ${latest.periodLabel}` : "Item yang dipublikasikan"}
            </FrameDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {viewingHistory && (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={detailHref} />}>
                <History aria-hidden="true" />
                Hasil terbaru
              </Button>
            )}
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
                            {item.updatedAt && <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(item.updatedAt, "d MMM, HH:mm")} WIB</span>}
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

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <PublicSecondarySection title="Riwayat pemeriksaan" description={`${history.length} periode tersedia`}>
          {history.length === 0 ? (
            <EmptyState icon={History} title="Belum ada riwayat" description="Periode pemeriksaan akan tampil di sini." action={<PublicRefreshButton />} />
          ) : (
            <ul className="divide-y divide-border">
              {history.map((entry) => {
                const selected = latest?.inspectionId === entry.id;
                return (
                  <li key={entry.id}>
                    <Link
                      href={`${detailHref}?inspection=${entry.id}`}
                      aria-current={selected ? "page" : undefined}
                      className={cn("flex min-w-0 flex-col gap-2 py-3 transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", selected && "bg-muted dark:bg-muted/50")}
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <History className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <p className="text-sm font-medium text-foreground">{formatDateHuman(`${entry.occurrenceDate}T12:00:00`, "d MMMM yyyy")}</p>
                          <p className="wrap-anywhere text-xs text-muted-foreground">{entry.templateName} · {entry.periodLabel}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ChecklistStatusBadge status={entry.status} />
                        {selected && <span className="text-xs text-muted-foreground">Sedang ditampilkan</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </PublicSecondarySection>

        <PublicSecondarySection title="Linimasa pemeriksaan" description="Aktivitas tanpa identitas petugas">
          {timeline.length === 0 ? (
            <EmptyState icon={Clock3} title="Belum ada aktivitas" description="Aktivitas pemeriksaan akan tampil di sini." action={<PublicRefreshButton />} />
          ) : (
            <ul className="divide-y divide-border">
              {timeline.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex items-start gap-3 py-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="wrap-anywhere text-sm font-medium text-foreground">{entry.label}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatDateTime(entry.at, "d MMM yyyy, HH:mm")} WIB</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PublicSecondarySection>
      </div>
    </PublicShell>
  );
}
