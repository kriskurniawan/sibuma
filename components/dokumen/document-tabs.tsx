"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkDocumentTab } from "@/lib/work-document-types";

const TABS: Array<{
  value: WorkDocumentTab;
  label: string;
  compactLabel?: string;
}> = [
  { value: "saya", label: "Dokumen saya" },
  {
    value: "dibagikan",
    label: "Dibagikan kepada saya",
    compactLabel: "Dibagikan",
  },
  { value: "sampah", label: "Sampah" },
];

export function DocumentTabs({
  tab,
  counts,
}: {
  tab: WorkDocumentTab;
  counts?: { saya: number; dibagikan: number; sampah: number } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function change(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "saya") params.delete("tab");
    else params.set("tab", next);
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <div className="no-scrollbar -mx-1 min-w-0 overflow-x-auto px-1">
      <Tabs value={tab} onValueChange={change}>
        <TabsList className="w-full justify-start sm:w-fit">
          {TABS.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              aria-label={counts ? `${item.label}, ${counts[item.value]} dokumen` : item.label}
            >
              <span className={item.compactLabel ? "sm:hidden" : undefined}>
                {item.compactLabel ?? item.label}
              </span>
              {item.compactLabel && (
                <span className="hidden sm:inline">{item.label}</span>
              )}
              {counts ? (
                <Badge variant="outline" className="tabular-nums">
                  {counts[item.value]}
                </Badge>
              ) : counts === undefined ? <Skeleton className="h-4 w-5 rounded-full" /> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
