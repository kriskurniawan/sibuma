"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_SETTINGS_TAB, SETTINGS_TABS } from "@/lib/settings-tabs";

export function SettingsTabs({ children }: { children: ReactNode }) {
  return (
    <Tabs defaultValue={DEFAULT_SETTINGS_TAB} className="gap-4">
      <TabsList
        variant="line"
        aria-label="Bagian pengaturan"
        className="max-w-full overflow-x-auto"
      >
        {SETTINGS_TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
