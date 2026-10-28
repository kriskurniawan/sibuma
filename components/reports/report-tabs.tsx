"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "lembur", label: "Lembur" },
  { value: "checklist", label: "Checklist" },
  { value: "tindak-lanjut", label: "Tindak lanjut" },
];

export function ReportTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("tab") ?? "lembur";

  function change(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "lembur") params.delete("tab");
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
      value={TABS.some((tab) => tab.value === current) ? current : "lembur"}
      onValueChange={(value) => change(value as string)}
      className="no-print"
    >
      <TabsList variant="line">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
