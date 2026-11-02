"use client";

import { ChevronRight, ScanLine } from "lucide-react";
import { QrScanButton } from "@/components/checklist/qr-scanner";

/**
 * Baris menu yang membuka pemindai QR area tanpa berpindah halaman. Bentuknya
 * mengikuti baris MenuGroup: ikon, label, deskripsi, lalu chevron.
 */
export function MenuScanRow() {
  return (
    <QrScanButton
      trigger={(openScanner) => (
        <button
          type="button"
          onClick={openScanner}
          className="group flex w-full min-w-0 items-center gap-3 py-3 text-left transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ScanLine
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium">Scan QR area</span>
            <span className="hidden text-xs text-muted-foreground md:block">
              Buka halaman area langsung dari QR yang terpasang.
            </span>
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
            aria-hidden="true"
          />
        </button>
      )}
    />
  );
}
