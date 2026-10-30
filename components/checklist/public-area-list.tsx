import Link from "next/link";
import {
  Building2,
  ChevronRight,
  ClipboardCheck,
  LogIn,
  MapPin,
} from "lucide-react";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { Badge, EmptyState } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ChecklistStatusBadge } from "@/components/checklist/checklist-badges";
import { PublicRefreshButton } from "@/components/checklist/public-refresh-button";
import { PublicShell } from "@/components/checklist/public-shell";
import type { ChecklistPublicLocation } from "@/lib/checklist-types";
import { formatDateHuman } from "@/lib/time";

export function PublicAreaList({
  qrName,
  token,
  locations,
  loggedIn = false,
}: {
  qrName: string;
  token: string;
  locations: ChecklistPublicLocation[];
  loggedIn?: boolean;
}) {
  return (
    <PublicShell>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Checklist area
        </p>
        <h1 className="break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {qrName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Pilih area untuk melihat hasil dan riwayat pemeriksaan.
        </p>
      </div>

      <Frame spacing="default">
        <FrameHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle><h2>Area publik</h2></FrameTitle>
            <FrameDescription className="text-xs">
              Area yang tersedia pada QR ini.
            </FrameDescription>
          </div>
          <Badge variant="outline" className="tabular-nums">
            {locations.length} area
          </Badge>
        </FrameHeader>

        <FramePanel>
          {locations.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Belum ada area publik"
              description="Belum ada area yang dipublikasikan untuk QR ini."
              action={<PublicRefreshButton />}
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {locations.map((location) => {
                const latest = location.latest;
                return (
                  <li key={location.id}>
                    <Link
                      href={`/p/${token}/area/${location.id}`}
                      className="flex min-w-0 items-center gap-3 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <IconTile
                          size="sm"
                          variant="outline"
                          className="text-muted-foreground"
                          aria-hidden="true"
                        >
                          <MapPin />
                        </IconTile>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <p className="line-clamp-2 break-words text-sm font-medium text-foreground">
                            {location.name}
                          </p>
                          {location.parentName && (
                            <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                              <Building2
                                className="size-4 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="truncate">
                                {location.parentName}
                              </span>
                            </p>
                          )}
                          {location.description && (
                            <p className="line-clamp-2 break-words text-xs text-muted-foreground">
                              {location.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            {latest ? (
                              <>
                                <ChecklistStatusBadge status={latest.status} />
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {latest.answeredCount}/{latest.totalItems} item
                                  diperiksa
                                </span>
                              </>
                            ) : (
                              <Badge variant="outline">Belum ada data</Badge>
                            )}
                          </div>
                          {latest && (
                            <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                              <span className="min-w-0 break-words">
                                {latest.periodLabel}
                              </span>
                              <span
                                aria-hidden="true"
                                className="size-1 shrink-0 rounded-full bg-muted-foreground/40"
                              />
                              <time
                                dateTime={latest.occurrenceDate}
                                className="whitespace-nowrap tabular-nums"
                              >
                                {formatDateHuman(
                                  `${latest.occurrenceDate}T12:00:00`,
                                  "d MMM yyyy",
                                )}
                              </time>
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-muted-foreground">
                        <span className="hidden sm:inline">Lihat area</span>
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <Frame spacing="default">
        <FramePanel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <ClipboardCheck
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm font-medium text-foreground">Akses petugas</p>
              <p className="text-xs text-muted-foreground">
                Tugas pemeriksaan hanya untuk petugas yang ditugaskan.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            className="self-start sm:self-auto"
            render={
              <Link
                href={
                  loggedIn
                    ? "/checklist"
                    : `/login?next=${encodeURIComponent(`/p/${token}`)}`
                }
              />
            }
          >
            {loggedIn ? (
              <ClipboardCheck aria-hidden="true" />
            ) : (
              <LogIn aria-hidden="true" />
            )}
            {loggedIn ? "Checklist saya" : "Masuk"}
          </Button>
        </FramePanel>
      </Frame>
    </PublicShell>
  );
}
