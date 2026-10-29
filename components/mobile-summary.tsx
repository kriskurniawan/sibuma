import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Frame, FramePanel } from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { SUMMARY_TONES, type SummaryTone } from "@/components/summary-tones";
import { cn } from "@/lib/utils";

export interface MobileSummaryItem {
  label: ReactNode;
  value: ReactNode;
  icon?: ComponentType;
  href?: string;
  ariaLabel?: string;
  tone?: SummaryTone;
}

/** Ringkasan mobile sekaligus pintu masuk ke daftar terkait. */
export function MobileSummary({
  items,
  columns = 2,
  className,
}: {
  items: MobileSummaryItem[];
  columns?: 2 | 3;
  className?: string;
}) {
  return (
    <Frame spacing="sm" className={cn("min-w-0", className)}>
      <div
        className={cn(
          "grid gap-1",
          columns === 2 ? "grid-cols-2" : "grid-cols-3",
        )}
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          const tone = SUMMARY_TONES[item.tone ?? "primary"];

          return (
            <FramePanel
              key={index}
              className={cn(
                "flex min-w-0 flex-col gap-2",
                tone.surface,
                item.href && cn("transition-colors", tone.hover),
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </span>
                {Icon && (
                  <IconTile
                    size="sm"
                    variant="soft"
                    className={tone.icon}
                    aria-hidden="true"
                  >
                    <Icon />
                  </IconTile>
                )}
              </div>
              <div className="flex min-w-0 items-end justify-between gap-1">
                <span className="flex min-w-0 flex-wrap items-baseline gap-1 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                  {item.value}
                </span>
                {item.href && (
                  <Link
                    href={item.href}
                    aria-label={item.ariaLabel}
                    className="shrink-0 text-muted-foreground after:absolute after:inset-0 transition-colors hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                    <span className="sr-only">Buka {item.label}</span>
                  </Link>
                )}
              </div>
            </FramePanel>
          );
        })}
      </div>
    </Frame>
  );
}
