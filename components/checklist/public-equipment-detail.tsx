import {
  CalendarDays,
  History,
  MapPin,
  Wrench,
} from "lucide-react";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Badge, EmptyState } from "@/components/ui";
import { EquipmentActivityBadge } from "@/components/checklist/equipment-badges";
import { PublicRefreshButton } from "@/components/checklist/public-refresh-button";
import { PublicShell } from "@/components/checklist/public-shell";
import {
  formatEquipmentHourMeter,
  formatEquipmentQuantity,
  type ChecklistPublicEquipmentDetail,
} from "@/lib/checklist-types";
import { formatDateHuman } from "@/lib/time";

export function PublicEquipmentDetail({
  detail,
  qrName,
  loggedIn,
  backHref,
  loginNext,
}: {
  detail: ChecklistPublicEquipmentDetail;
  qrName: string;
  loggedIn: boolean;
  backHref: string;
  loginNext: string;
}) {
  const equipment = detail.equipment;

  return (
    <PublicShell
      backHref={backHref}
      backLabel="Area"
      loggedIn={loggedIn}
      loginNext={loginNext}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="wrap-anywhere text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {equipment.name}
          </h1>
          <Badge variant="outline">{equipment.code}</Badge>
        </div>
        <p className="flex min-w-0 items-start gap-1 text-xs text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span className="wrap-anywhere">
            {equipment.category ? `${equipment.category} · ` : ""}
            {equipment.locationName} · {qrName}
          </span>
        </p>
      </div>

      <Frame spacing="default">
        <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle><h2>Ringkasan komponen</h2></FrameTitle>
            <FrameDescription className="wrap-anywhere text-xs">
              Catatan terakhir per komponen atau bahan.
            </FrameDescription>
          </div>
          <Badge variant="outline">{detail.summary.length} komponen</Badge>
        </FrameHeader>
        <FramePanel>
          {detail.summary.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="Belum ada perawatan"
              description="Riwayat penggantian, pengisian, perbaikan, atau servis akan tampil di sini."
              action={<PublicRefreshButton />}
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {detail.summary.map((entry) => {
                const quantity = formatEquipmentQuantity(
                  entry.quantity,
                  entry.unit,
                );
                const hourMeter = formatEquipmentHourMeter(entry.hourMeter);
                return (
                  <li
                    key={entry.component}
                    className="flex min-w-0 items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="wrap-anywhere text-sm font-medium text-foreground">
                        {entry.component}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <EquipmentActivityBadge activity={entry.activity} />
                        <span className="tabular-nums">
                          {formatDateHuman(
                            `${entry.performedDate}T12:00:00`,
                            "d MMM yyyy",
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                      {quantity && (
                        <span className="text-sm font-medium text-foreground tabular-nums">
                          {quantity}
                        </span>
                      )}
                      {hourMeter && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {hourMeter}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <Frame spacing="default">
        <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle><h2>Riwayat perawatan</h2></FrameTitle>
            <FrameDescription className="wrap-anywhere text-xs">
              Aktivitas yang sudah terlaksana tanpa identitas petugas.
            </FrameDescription>
          </div>
          <Badge variant="outline">
            {detail.maintenance.length} catatan
          </Badge>
        </FrameHeader>
        <FramePanel className="p-0">
          {detail.maintenance.length === 0 ? (
            <EmptyState
              icon={History}
              title="Belum ada riwayat"
              description="Catatan perawatan yang dipublikasikan akan tampil di sini."
              action={<PublicRefreshButton />}
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {detail.maintenance.map((entry) => {
                const quantity = formatEquipmentQuantity(
                  entry.quantity,
                  entry.unit,
                );
                const hourMeter = formatEquipmentHourMeter(entry.hourMeter);
                return (
                  <li
                    key={entry.id}
                    className="flex min-w-0 flex-col gap-2 px-4 py-4 sm:px-5"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <EquipmentActivityBadge activity={entry.activity} />
                      <p className="min-w-0 wrap-anywhere text-sm font-medium text-foreground">
                        {entry.component}
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <CalendarDays
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {formatDateHuman(
                          `${entry.performedDate}T12:00:00`,
                          "d MMM yyyy",
                        )}
                      </span>
                      {quantity && (
                        <span className="tabular-nums">{quantity}</span>
                      )}
                      {hourMeter && (
                        <span className="tabular-nums">{hourMeter}</span>
                      )}
                    </div>
                    {entry.description && (
                      <p className="wrap-anywhere whitespace-pre-line text-sm text-muted-foreground">
                        {entry.description}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </FramePanel>
      </Frame>
    </PublicShell>
  );
}
