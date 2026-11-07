"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ListChecks, MapPinned, Plus, ScrollText } from "lucide-react";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { useSessionUser } from "@/components/session-user-provider";
import { IconTile } from "@/components/reui/icon-tile";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import { can } from "@/lib/access";
import { SETTINGS_TABS, type SettingsTab } from "@/lib/settings-tabs";

const TITLES: Record<SettingsTab, string> = {
  kebijakan: "Kebijakan lembur",
  lokasi: "Titik lokasi absensi",
  checklist: "Status checklist",
  dokumen: "Dokumen kerja",
  media: "Batas foto dan video dokumentasi",
};

export function SettingsFormSkeleton({ tab }: { tab: SettingsTab }) {
  return (
    <Frame spacing="default">
      <FrameHeader><FrameTitle>{TITLES[tab]}</FrameTitle></FrameHeader>
      <FramePanel aria-busy="true" aria-live="polite">
        <span className="sr-only">Memuat {TITLES[tab].toLowerCase()}…</span>
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: tab === "kebijakan" ? 9 : 4 }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-border/70 pt-4"><Skeleton className="h-8 w-36" /></div>
        </div>
      </FramePanel>
    </Frame>
  );
}

/** List-management tabs keep their real header, creation control, and row
 * shape while only the stored rows are pending. */
function SettingsListSkeleton({ tab }: { tab: "lokasi" | "checklist" }) {
  const locations = tab === "lokasi";
  const Icon = locations ? MapPinned : ListChecks;
  const title = locations ? "Titik lokasi absensi" : "Status checklist";
  const description = locations
    ? "Setiap titik punya radius absen sendiri. Atasan hanya dapat memilih titik aktif dari daftar ini saat membuat SPKL. Titik nonaktif tetap tersimpan pada riwayat."
    : "Status nonaktif hanya tersimpan di riwayat, bukan pengisian baru.";
  return (
    <Frame spacing="default">
      <FrameHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconTile variant="soft" size="sm" className="text-primary" aria-hidden="true">
              <Icon />
            </IconTile>
            <div className="flex min-w-0 flex-col gap-0.5">
              <FrameTitle>{title}</FrameTitle>
            </div>
          </div>
          <Button type="button" size="sm" disabled>
            <Plus aria-hidden="true" />
            {locations ? "Tambah titik" : "Tambah status"}
          </Button>
        </div>
        <FrameDescription className="hidden md:block">{description}</FrameDescription>
      </FrameHeader>
      <FramePanel className="p-0" aria-busy="true" aria-live="polite">
        <span className="sr-only">Memuat {title.toLowerCase()}…</span>
        <ul className="divide-y divide-border/70">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-start gap-3">
                {locations ? (
                  <Skeleton className="size-8 shrink-0 rounded-md" />
                ) : (
                  <div className="flex shrink-0 flex-col gap-1">
                    <Skeleton className="size-6 rounded-md" />
                    <Skeleton className="size-6 rounded-md" />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Skeleton className="h-4 w-40 max-w-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-56 max-w-full" />
                  {locations && <Skeleton className="h-3 w-44 max-w-full" />}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
                <Skeleton className="hidden h-3 w-8 sm:block" />
                <Skeleton className="h-5 w-9 rounded-full" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </li>
          ))}
        </ul>
      </FramePanel>
    </Frame>
  );
}

export function SettingsDataSkeleton({ tab }: { tab: SettingsTab }) {
  return tab === "lokasi" || tab === "checklist"
    ? <SettingsListSkeleton tab={tab} />
    : <SettingsFormSkeleton tab={tab} />;
}

export function SettingsPageShell({ panels, interactive = true }: { panels?: Record<SettingsTab, ReactNode>; interactive?: boolean }) {
  const user = useSessionUser();
  const allowed = can(user.role, "policy.manage");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        mobileCompact
        eyebrow="Kelola"
        title="Pengaturan."
        description="Kebijakan, lokasi, checklist, dan batas dokumentasi."
        descriptionClassName="hidden md:block"
        action={allowed ? <Button size="sm" variant="outline" className="max-md:w-fit" nativeButton={false} render={<Link href="/audit" />}><ScrollText aria-hidden="true" />Lihat log audit</Button> : undefined}
      />
      {allowed && <div className="w-full max-w-4xl">
        <SettingsTabs interactive={interactive}>
          {SETTINGS_TABS.map((tab) => <TabsContent key={tab.value} value={tab.value} keepMounted>{panels?.[tab.value] ?? <SettingsDataSkeleton tab={tab.value} />}</TabsContent>)}
        </SettingsTabs>
      </div>}
    </div>
  );
}
