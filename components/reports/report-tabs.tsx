"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Clock3, Hammer, ListChecks, Wrench } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_TAB = "checklist";

const TABS = [
  { value: "checklist", label: "Checklist", icon: ListChecks },
  { value: "tindak-lanjut", label: "Tindak lanjut", icon: Wrench },
  { value: "pekerjaan", label: "Pekerjaan harian", icon: Hammer },
  { value: "lembur", label: "Lembur", icon: Clock3 },
];

/** Real navigation remains available if URL-dependent tabs suspend. */
export function ReportTabsFallback() {
  return (
    <Tabs value={null} className="no-print">
      <TabsList
        aria-label="Jenis laporan"
        className="no-scrollbar w-full max-w-full overflow-x-auto overflow-y-hidden"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              nativeButton={false}
              render={
                <Link
                  href={
                    tab.value === DEFAULT_TAB
                      ? "/laporan"
                      : `/laporan?tab=${tab.value}`
                  }
                />
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

export function ReportTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("tab") ?? DEFAULT_TAB;

  function change(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === DEFAULT_TAB) params.delete("tab");
    else params.set("tab", value);
    params.delete("page");
    params.delete("size");
    params.delete("print");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <Tabs
      value={TABS.some((tab) => tab.value === current) ? current : DEFAULT_TAB}
      onValueChange={(value) => change(value as string)}
      className="no-print"
    >
      <TabsList
        aria-label="Jenis laporan"
        className="no-scrollbar w-full max-w-full overflow-x-auto overflow-y-hidden"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.value} value={tab.value}>
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
