import Link from "next/link";
import {
  AlertCircle,
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
import { Badge, EmptyState } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ChecklistStatusBadge } from "@/components/checklist/checklist-badges";
import { PublicShell } from "@/components/checklist/public-shell";
import type { ChecklistPublicLocation } from "@/lib/checklist-types";
import { formatDateHuman } from "@/lib/time";

export function PublicAreaList({
  qrName,
  token,
  locations,
}: {
  qrName: string;
  token: string;
  locations: ChecklistPublicLocation[];
}) {
  return (
    <PublicShell>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Checklist area
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {qrName}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Pilih area untuk melihat hasil pemeriksaan terakhir dan riwayatnya.
        </p>
      </div>

      <Frame>
        <FrameHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <FrameTitle>Area publik</FrameTitle>
            <FrameDescription className="text-xs">
              Hanya area yang diaktifkan pengelola yang ditampilkan di sini.
            </FrameDescription>
          </div>
          <Badge variant="outline" className="tabular-nums">
            {locations.length} area
          </Badge>
        </FrameHeader>

        <FramePanel className="p-0">
          {locations.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Belum ada area publik"
              description="Pengelola belum mempublikasikan area pada QR ini. Silakan hubungi petugas gedung."
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {locations.map((location) => {
                const latest = location.latest;
                return (
                  <li key={location.id}>
                    <Link
                      href={`/p/${token}/area/${location.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5"
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <MapPin className="size-4" aria-hidden="true" />
                        </span>
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-medium text-foreground">
                              {location.name}
                            </p>
                            {latest ? (
                              <ChecklistStatusBadge status={latest.status} />
                            ) : (
                              <Badge variant="outline">Belum ada data</Badge>
                            )}
                          </div>
                          {location.parentName && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="size-3" aria-hidden="true" />
                              {location.parentName}
                            </p>
                          )}
                          {location.description && (
                            <p className="max-w-xl text-xs text-muted-foreground">
                              {location.description}
                            </p>
                          )}
                          {latest && (
                            <p className="text-xs text-muted-foreground">
                              {latest.periodLabel} ·{" "}
                              {formatDateHuman(
                                `${latest.occurrenceDate}T12:00:00`,
                                "d MMM yyyy",
                              )}{" "}
                              · {latest.answeredCount}/{latest.totalItems} item
                              diperiksa
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        Lihat area
                        <ChevronRight className="size-3.5" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <ClipboardCheck
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              Petugas pemeriksa?
            </p>
            <p className="text-xs text-muted-foreground">
              Masuk untuk membuka tugas yang ditugaskan kepada Anda. Scan QR
              tidak memberi akses tanpa penugasan.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href={`/login?next=${encodeURIComponent(`/p/${token}`)}`} />}
        >
          <LogIn aria-hidden="true" />
          Masuk
        </Button>
      </div>

      {locations.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          Area publik dapat diaktifkan pada menu Template &amp; lokasi.
        </p>
      )}
    </PublicShell>
  );
}
