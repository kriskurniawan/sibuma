"use client";

import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { useSessionUser } from "@/components/session-user-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { isReadOnly } from "@/lib/access";

function EquipmentRowSkeleton() {
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Skeleton className="mt-0.5 size-4 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-52 max-w-full" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-8 w-16 shrink-0" />
    </li>
  );
}

export function ChecklistEquipmentSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-w-0 flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat daftar peralatan…</span>
      <Frame spacing="default" className="min-w-0">
        <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Daftar peralatan</FrameTitle>
            <FrameDescription className="text-xs">
              Satu unit per kode. Riwayat tiap unit tidak tercampur.
            </FrameDescription>
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </FrameHeader>
        <FramePanel className="p-0">
          <ul className="divide-y divide-border/70">
            {Array.from({ length: 4 }, (_, index) => (
              <EquipmentRowSkeleton key={index} />
            ))}
          </ul>
        </FramePanel>
      </Frame>
    </div>
  );
}

export function ChecklistEquipmentDetailSkeleton() {
  const user = useSessionUser();
  const canManage = user.role === "atasan" && !isReadOnly(user);
  const canRecordMaintenance =
    !isReadOnly(user) && (user.role === "atasan" || user.role === "pekerja");

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-w-0 flex-col gap-6 lg:gap-8"
    >
      <span className="sr-only">Memuat detail peralatan…</span>
      <div className="hidden flex-col gap-4 md:flex xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-7 w-72 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          {canManage && <Skeleton className="h-8 w-24" />}
          {canRecordMaintenance && <Skeleton className="h-8 w-32" />}
        </div>
      </div>
      <Frame className="md:hidden">
        <FramePanel className="flex flex-col gap-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-48 max-w-full" />
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && <Skeleton className="h-8 w-24" />}
            {canRecordMaintenance && <Skeleton className="h-8 w-32" />}
          </div>
        </FramePanel>
      </Frame>
      <Frame spacing="default" className="min-w-0">
        <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-52 max-w-full" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </FrameHeader>
        <FramePanel>
          <ul className="divide-y divide-border/70">
            {Array.from({ length: 3 }, (_, index) => (
              <li
                key={index}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Skeleton className="h-4 w-24" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </li>
            ))}
          </ul>
        </FramePanel>
      </Frame>
      <Frame spacing="default" className="min-w-0">
        <FrameHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </FrameHeader>
        <FramePanel className="p-0">
          <ul className="divide-y divide-border/70">
            {Array.from({ length: 3 }, (_, index) => (
              <li key={index} className="flex flex-col gap-2 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  {(canManage || canRecordMaintenance) && (
                    <Skeleton className="h-8 w-16" />
                  )}
                </div>
                <Skeleton className="h-3 w-44 max-w-full" />
                <Skeleton className="h-4 w-3/4 max-w-full" />
                <Skeleton className="h-3 w-52 max-w-full" />
              </li>
            ))}
          </ul>
        </FramePanel>
      </Frame>
    </div>
  );
}
