"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  MapPin,
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
import { Badge, EmptyState } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { EquipmentFormDialog } from "@/components/checklist/equipment-dialogs";
import { EquipmentActivityBadge } from "@/components/checklist/equipment-badges";
import { isReadOnly } from "@/lib/access";
import {
  type ChecklistEquipmentListItem,
  type ChecklistEquipmentSetup,
} from "@/lib/checklist-types";
import { formatDateHuman } from "@/lib/time";

const EQUIPMENT_NEW_HASH = "#peralatan-baru";

export function ChecklistEquipmentView({
  setup,
}: {
  setup: ChecklistEquipmentSetup;
}) {
  const router = useRouter();
  const user = useSessionUser();
  const canManage = user.role === "atasan" && !isReadOnly(user);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistEquipmentListItem | null>(
    null,
  );

  useEffect(() => {
    if (!canManage) return;
    function openFromHash() {
      if (window.location.hash !== EQUIPMENT_NEW_HASH) return;
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      setEditing(null);
      setOpen(true);
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [canManage]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(equipment: ChecklistEquipmentListItem) {
    setEditing(equipment);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    if (window.location.hash === EQUIPMENT_NEW_HASH) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }

  return (
    <>
      <Frame spacing="default" className="min-w-0">
        <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Daftar peralatan</FrameTitle>
            <FrameDescription className="text-xs">
              Satu unit per kode. Riwayat tiap unit tidak tercampur.
            </FrameDescription>
          </div>
          <Badge variant="outline">{setup.equipment.length} peralatan</Badge>
        </FrameHeader>
        <FramePanel className="p-0">
          {setup.equipment.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="Belum ada peralatan"
              description="Tambahkan unit seperti genset, pompa air, atau kompresor agar riwayat perawatannya tercatat per kode."
              action={
                canManage ? (
                  <div className="max-md:hidden">
                    <Button
                      size="sm"
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={open && !editing}
                      data-dialog-intent="equipment-new"
                      onClick={openCreate}
                    >
                      <Plus aria-hidden="true" />
                      Tambah peralatan
                    </Button>
                  </div>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {setup.equipment.map((equipment) => {
                const last = equipment.lastMaintenance;
                return (
                  <li key={equipment.id}>
                    <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                      <Link
                        href={`/checklist/peralatan/${equipment.id}`}
                        className="group flex min-w-0 flex-1 items-start gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Wrench
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="wrap-anywhere text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                              {equipment.name}
                            </span>
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
                          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            {equipment.category && (
                              <span className="wrap-anywhere">
                                {equipment.category}
                              </span>
                            )}
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <MapPin
                                className="size-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="wrap-anywhere">
                                {equipment.locationPath}
                              </span>
                            </span>
                          </p>
                          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="tabular-nums">
                              {equipment.maintenanceCount} riwayat
                            </span>
                            {last ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <EquipmentActivityBadge
                                  activity={last.activity}
                                />
                                <span className="wrap-anywhere">
                                  {last.component} ·{" "}
                                  {formatDateHuman(
                                    `${last.performedDate}T12:00:00`,
                                    "d MMM yyyy",
                                  )}
                                </span>
                              </>
                            ) : (
                              <span>· Belum ada perawatan</span>
                            )}
                          </p>
                        </div>
                      </Link>
                      <div className="flex shrink-0 items-center gap-1">
                        {canManage && (
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() => openEdit(equipment)}
                            aria-label={`Ubah ${equipment.name}`}
                          >
                            Ubah
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          nativeButton={false}
                          render={
                            <Link
                              href={`/checklist/peralatan/${equipment.id}`}
                              aria-label={`Buka ${equipment.name}`}
                            />
                          }
                        >
                          <ChevronRight aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </FramePanel>
      </Frame>

      {canManage && (
        <EquipmentFormDialog
          open={open}
          onClose={close}
          equipment={editing}
          locations={setup.locations}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
}
