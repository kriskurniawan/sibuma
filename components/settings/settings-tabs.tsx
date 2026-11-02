"use client";

import type { ReactNode } from "react";
import { FolderLock, Images, ListChecks, MapPinned, ScrollText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_SETTINGS_TAB, SETTINGS_TABS, type SettingsTab } from "@/lib/settings-tabs";

const TAB_ICONS: Record<SettingsTab, typeof ScrollText> = {
  kebijakan: ScrollText,
  lokasi: MapPinned,
  checklist: ListChecks,
  dokumen: FolderLock,
  media: Images,
};

export function SettingsTabs({ children, interactive = true }: { children: ReactNode; interactive?: boolean }) {
  return (
    <Tabs value={interactive ? undefined : DEFAULT_SETTINGS_TAB} defaultValue={DEFAULT_SETTINGS_TAB} className="gap-4">
      <TabsList
        aria-label="Bagian pengaturan"
        className="no-scrollbar w-full max-w-full overflow-x-auto overflow-y-hidden"
      >
        {SETTINGS_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.value];
          return (
            <TabsTrigger key={tab.value} value={tab.value} disabled={!interactive}>
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {children}
    </Tabs>
  );
}
