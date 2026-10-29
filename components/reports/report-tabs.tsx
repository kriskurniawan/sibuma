"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_TAB = "checklist";

const TABS = [
  { value: "checklist", label: "Checklist" },
  { value: "tindak-lanjut", label: "Tindak lanjut" },
  { value: "pekerjaan", label: "Pekerjaan harian" },
  { value: "lembur", label: "Lembur" },
];

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
      <TabsList variant="line" className="max-w-full overflow-x-auto">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
