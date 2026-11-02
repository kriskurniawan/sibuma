"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChecklistStatusBadge } from "@/components/checklist/checklist-badges";
import type { ChecklistInspectionStatus } from "@/lib/checklist-types";
import { cn } from "@/lib/utils";

const INITIAL_VISIBLE = 5;

export interface PublicHistoryListItem {
  id: string;
  href: string;
  dateLabel: string;
  meta: string;
  counts: string;
  status: ChecklistInspectionStatus;
  selected: boolean;
}

export function PublicHistoryList({ items }: { items: PublicHistoryListItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, INITIAL_VISIBLE);
  const hidden = items.length - visible.length;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ul className="divide-y divide-border">
        {visible.map((entry) => (
          <li key={entry.id}>
            <Link
              href={entry.href}
              aria-current={entry.selected ? "page" : undefined}
              className="relative flex min-w-0 flex-col gap-2 py-3 pl-3 transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {entry.selected && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
                />
              )}
              <div className="flex min-w-0 items-start gap-2">
                <History
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {entry.dateLabel}
                  </p>
                  <p className="wrap-anywhere text-xs text-muted-foreground">
                    {entry.meta}
                  </p>
                  <p className="wrap-anywhere text-xs text-muted-foreground tabular-nums">
                    {entry.counts}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ChecklistStatusBadge status={entry.status} />
                {entry.selected && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-primary"
                    />
                    Sedang ditampilkan
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {items.length > INITIAL_VISIBLE && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Ringkas riwayat" : `Lihat ${hidden} lainnya`}
          <ChevronDown
            className={cn(expanded && "rotate-180")}
            aria-hidden="true"
          />
        </Button>
      )}
    </div>
  );
}
