"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Region-local error: keep the page shell and other loaded sections intact. */
export function DataLoadError({
  message = "Data gagal dimuat. Coba lagi.",
}: {
  message?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3" role="alert">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        {message}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RotateCcw aria-hidden="true" />
        {pending ? "Memuat ulang…" : "Coba lagi"}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {pending ? "Memuat ulang data…" : ""}
      </span>
    </div>
  );
}
