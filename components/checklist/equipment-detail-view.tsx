"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  MapPin,
  Pencil,
  Plus,
  Wrench,
} from "lucide-react";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { useSessionUser } from "@/components/session-user-provider";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { EquipmentActivityBadge } from "@/components/checklist/equipment-badges";
import {
  EquipmentFormDialog,
  MaintenanceFormDialog,
} from "@/components/checklist/equipment-dialogs";
import { isReadOnly } from "@/lib/access";
import {
  formatEquipmentHourMeter,
  formatEquipmentQuantity,
  type ChecklistEquipmentDetail,
  type ChecklistEquipmentMaintenance,
} from "@/lib/checklist-types";
import { formatDateHuman, formatDateTime } from "@/lib/time";

export function ChecklistEquipmentDetailView({
  detail,
}: {
  detail: ChecklistEquipmentDetail;
}) {
  const router = useRouter();
  const user = useSessionUser();
  const canManage = user.role === "atasan" && !isReadOnly(user);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [editingMaintenance, setEditingMaintenance] =
    useState<ChecklistEquipmentMaintenance | null>(null);
  const equipment = detail.equipment;

  const headerActions = canManage ? (
    <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setEquipmentOpen(true)}
      >
        <Pencil aria-hidden="true" />
        Ubah
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setEditingMaintenance(null);
          setMaintenanceOpen(true);
        }}
      >
        <Plus aria-hidden="true" />
        Catat perawatan
      </Button>
    </div>
  ) : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-6 lg:gap-8">
      <div className="hidden md:block">
        <PageHeader
          eyebrow={
            equipment.category
              ? `${equipment.category} · ${equipment.code}`
              : equipment.code
          }
          title={equipment.name}
          description={
            <span className="inline-flex min-w-0 items-start gap-1">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="wrap-anywhere">{equipment.locationPath}</span>
            </span>
          }
          descriptionClassName="hidden md:block"
          action={headerActions}
        />
      </div>

      <Frame className="md:hidden">
        <FramePanel className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {equipment.category
                ? `${equipment.category} · ${equipment.code}`
                : equipment.code}
            </p>
            <h1 className="wrap-anywhere text-xl font-semibold tracking-tight text-foreground">
              {equipment.name}
            </h1>
            <p className="flex min-w-0 items-start gap-1 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="wrap-anywhere">{equipment.locationPath}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{equipment.code}</Badge>
            {equipment.publicEnabled ? (
              <Badge variant="success-light">Publik</Badge>
            ) : (
              <Badge variant="outline">Internal</Badge>
            )}
            {!equipment.active && (
              <Badge variant="warning-light">Nonaktif</Badge>
            )}
          </div>
          {headerActions}
        </FramePanel>
      </Frame>

      <div className="hidden flex-wrap items-center gap-1.5 md:flex">
        <Badge variant="outline">{equipment.code}</Badge>
        {equipment.publicEnabled ? (
          <Badge variant="success-light">Publik</Badge>
        ) : (
          <Badge variant="outline">Internal</Badge>
        )}
        {!equipment.active && <Badge variant="warning-light">Nonaktif</Badge>}
      </div>

      <Frame spacing="default" className="min-w-0">
        <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Ringkasan komponen</FrameTitle>
            <FrameDescription className="text-xs">
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
              description="Catat penggantian, pengisian, perbaikan, atau servis pertama untuk unit ini."
              action={
                canManage ? (
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => {
                      setEditingMaintenance(null);
                      setMaintenanceOpen(true);
                    }}
                  >
                    <Plus aria-hidden="true" />
                    Catat perawatan
                  </Button>
                ) : undefined
              }
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

      <Frame spacing="default" className="min-w-0">
        <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Riwayat perawatan</FrameTitle>
            <FrameDescription className="text-xs">
              Catatan aktivitas yang sudah terlaksana.
            </FrameDescription>
          </div>
          <Badge variant="outline">
            {detail.maintenance.length} catatan
          </Badge>
        </FrameHeader>
        <FramePanel className="p-0">
          {detail.maintenance.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="Belum ada riwayat"
              description="Riwayat penggantian aki, oli, coolant, penambahan BBM, dan perbaikan akan tampil di sini."
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
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <EquipmentActivityBadge activity={entry.activity} />
                        <p className="min-w-0 wrap-anywhere text-sm font-medium text-foreground">
                          {entry.component}
                        </p>
                        {!entry.publicVisible && (
                          <Badge variant="outline">Internal</Badge>
                        )}
                      </div>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() => {
                            setEditingMaintenance(entry);
                            setMaintenanceOpen(true);
                          }}
                        >
                          <Pencil aria-hidden="true" />
                          Ubah
                        </Button>
                      )}
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
                    <p className="text-xs text-muted-foreground">
                      Dicatat oleh {entry.performedByName ?? "petugas"} ·{" "}
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </FramePanel>
      </Frame>

      {canManage && (
        <>
          <EquipmentFormDialog
            open={equipmentOpen}
            onClose={() => setEquipmentOpen(false)}
            equipment={equipment}
            locations={detail.locations}
            onSaved={() => router.refresh()}
          />
          <MaintenanceFormDialog
            open={maintenanceOpen}
            onClose={() => setMaintenanceOpen(false)}
            equipmentId={equipment.id}
            equipmentName={equipment.name}
            maintenance={editingMaintenance}
            onSaved={() => router.refresh()}
          />
        </>
      )}
    </div>
  );
}
