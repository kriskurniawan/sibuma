"use client";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function FilterPending({
  pending,
  label = "Memperbarui…",
  className,
}: {
  pending: boolean;
  label?: string;
  className?: string;
}) {
  if (!pending) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <Spinner className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
